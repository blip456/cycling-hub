/**
 * `buildPlan`: the whole plan from an input (docs/plan/engine-rules.md). Pure and deterministic: the same
 * input always gives the same plan, and `today` is the only clock.
 */
import { weekdayIndex, type IsoDate } from "@/features/athlete";
import { allocateMinutes, assignDays, type AllocationItem, type Slot } from "./allocate";
import { floor5, initialBudgetState, weekBudget, type BudgetState } from "./budget";
import { plusDays, type WeekSkeleton } from "./calendar";
import {
  EVENT_MINUTES,
  HOURS_PER_RIDE,
  INDOOR_EASY_MAX,
  INDOOR_SESSION_MAX,
  LADDERS,
  LEVEL_SETTINGS,
  LONG_RIDE_GROWTH_CAP,
  LOAD_GROWTH_CAP,
  OPENERS_MINUTES,
  Q1_WEIGHT,
  Q2_WEIGHT,
  RECOVERY_EASY_MAX_MIN,
  RECOVERY_LONG_FRACTION,
  RECOVERY_LONG_MIN,
  RECOVERY_Q1_EXTRA_MIN,
  STRENGTH_NOTE,
  STRENGTH_NOTE_LIGHT,
  type LadderKind,
} from "./constants";
import { inputFingerprint } from "./fingerprint";
import {
  aboveThresholdMinutes,
  isLadderKind,
  qualityMinutes,
  sessionLoad,
  sessionReason,
  sessionSteps,
  minimumMinutes,
  sessionTitle,
  stepContext,
  testMinutes,
} from "./library";
import { hardMix, hasSecondSlot, longRideHasBlocks } from "./mix";
import { resolveInput, hasUsableFtp } from "./resolve";
import {
  ENGINE_VERSION,
  STRUCTURED_KINDS,
  type Notice,
  type Plan,
  type PlanInput,
  type PlannedSession,
  type Purpose,
  type SessionKind,
  type SessionSlot,
  type Warning,
  type Week,
} from "./types";
import { weightPlan } from "./weight-loss";

/** A session before its steps are built: the week builder and the cap fixes edit these. */
type Draft = {
  slot: SessionSlot;
  date: IsoDate;
  week: number;
  kind: SessionKind;
  minutes: number;
  /** Ladder step wanted (0-based); the library goes lower when the set does not fit. */
  wantedStep: number | null;
  /** Tempo ladder step of the blocks inside a semi-pro long ride; null for a plain long ride. */
  longBlocks: number | null;
  purpose: Purpose | null;
  indoor: boolean;
  held: boolean;
  /** A cap fix lowered the set. */
  loweredByCap: boolean;
};

type State = {
  budget: BudgetState;
  ladderCounts: Record<LadderKind, number>;
  lastLoading: { long: number; load: number } | null;
};

const initialCounts = (): Record<LadderKind, number> => ({
  tempo: 0,
  "sweet-spot": 0,
  threshold: 0,
  vo2: 0,
  torque: 0,
  sprint: 0,
});

function isHard(kind: SessionKind, mainSet: string | null): boolean {
  return STRUCTURED_KINDS.includes(kind) || (kind === "long" && mainSet !== null);
}

type Metrics = {
  minutes: number;
  load: number;
  quality: number;
  above: number;
  hard: number;
};

function metrics(sessions: readonly PlannedSession[]): Metrics {
  const own = sessions.filter((s) => s.kind !== "event");
  return {
    minutes: own.reduce((sum, s) => sum + s.durationMin, 0),
    load: own.reduce((sum, s) => sum + s.load, 0),
    quality: own.reduce((sum, s) => sum + qualityMinutes(s.steps), 0),
    above: own.reduce((sum, s) => sum + aboveThresholdMinutes(s.steps), 0),
    hard: own.filter((s) => isHard(s.kind, s.mainSet)).length,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Number of rides: `round(H / 1.6)` within the level range and the available days (section 6). */
export function rideCount(input: {
  level: keyof typeof LEVEL_SETTINGS;
  hoursPerWeek: number;
  availableDays: number;
  main: Purpose;
}): number {
  const [min, max] = LEVEL_SETTINGS[input.level].rides;
  const wanted =
    input.main === "weight-loss"
      ? max
      : Math.min(max, Math.max(min, Math.round(input.hoursPerWeek / HOURS_PER_RIDE)));
  return Math.max(2, Math.min(wanted, input.availableDays));
}

/** The plan for an input. A plan that cannot be built is `status: "blocked"` with the reasons in `warnings`. */
export function buildPlan(input: PlanInput): Plan {
  const resolved = resolveInput(input);
  const { levelResult, hoursPerWeek, purposes, structure } = resolved;
  const { intake } = input;
  const level = levelResult.level;
  const settings = LEVEL_SETTINGS[level];
  const fingerprint = inputFingerprint(input);
  const warnings: Warning[] = [...resolved.blocked, ...structure.warnings];
  const notices: Notice[] = [...resolved.notices, ...structure.notices];
  const event = structure.event ? { ...structure.event, taperWeeks: structure.taperWeeks } : null;

  const base = {
    engineVersion: ENGINE_VERSION,
    fingerprint,
    level,
    levelScore: levelResult.score,
    hoursPerWeek,
    purposes,
    startDate: structure.startDate,
    endDate: structure.endDate,
    environment: intake.environment,
    ftp: hasUsableFtp(input.ftp) ? input.ftp : null,
    event,
  };
  if (resolved.blocked.length > 0 || !hasUsableFtp(input.ftp)) {
    return { ...base, status: "blocked", weeks: [], sessions: [], weight: null, notices, warnings };
  }

  const ftp: number = input.ftp;
  const adjustments = input.adjustments ?? {};
  const holdWeeks = new Set(adjustments.holdWeeks ?? []);
  const noSecond = new Set(adjustments.noSecondHardWeeks ?? []);
  const extraEasy = new Set(adjustments.extraEasyRideWeeks ?? []);
  const missed = new Set((adjustments.missedStructured ?? []).map((m) => `${m.week}:${m.kind}`));
  const ftpTest = intake.ftpTest ?? "twenty-minute";
  const eventDate = structure.event?.date ?? null;
  const openersDate =
    eventDate !== null && plusDays(eventDate, -1) >= structure.startDate
      ? plusDays(eventDate, -1)
      : null;
  const templateQ2 = hasSecondSlot(level, purposes);
  const longHardTemplate =
    level === "semi-pro" && (purposes.main === "endurance" || purposes.main === "muscle-building");
  const rides = rideCount({
    level,
    hoursPerWeek,
    availableDays: resolved.days.length,
    main: purposes.main,
  });
  if (adjustments.recentAverageHours !== undefined && adjustments.recentAverageHours > 0) {
    notices.push({
      code: "history-start",
      message: "Week 1 starts from the hours you rode recently, not from the hours you asked for.",
    });
  }

  const flags = { indoorLimited: false, hrMissing: false };

  function isIndoor(date: IsoDate, kind: SessionKind): boolean {
    if (kind === "event") return false;
    if (intake.environment === "indoor") return true;
    if (intake.environment === "outdoor") return false;
    return STRUCTURED_KINDS.includes(kind) && (weekdayIndex(date) ?? 0) < 5;
  }

  function materialize(d: Draft): PlannedSession {
    const sk = structure.weeks[d.week - 1];
    const weekType = sk?.type ?? "loading";
    const context = stepContext({
      ftp,
      lthr: input.lthr,
      maxHr: input.maxHr,
      indoor: d.indoor,
    });
    if (context.heartRate === null) flags.hrMissing = true;
    if (d.kind === "event") {
      return {
        date: d.date,
        week: d.week,
        slot: "event",
        kind: "event",
        title: sessionTitle({
          kind: "event",
          mainSet: null,
          eventName: structure.event?.name ?? "",
        }),
        durationMin: d.minutes,
        steps: [],
        reason: sessionReason({ kind: "event", weekType }),
        indoor: false,
        status: "planned",
        load: 0,
        mainSet: null,
        ladderStep: null,
        strengthNote: null,
      };
    }
    const result = sessionSteps({
      kind: d.kind,
      level,
      durationMin: d.minutes,
      ...(d.wantedStep !== null ? { ladderStep: d.wantedStep } : {}),
      longBlocks: d.longBlocks,
      ftpTest,
      context,
    });
    const kind = result.kind;
    const structured = STRUCTURED_KINDS.includes(kind);
    const blocks = kind === "long" && result.mainSet !== null;
    const slot: SessionSlot =
      d.slot === "q1" || d.slot === "q2" ? (structured ? d.slot : "easy") : d.slot;
    const minutes =
      kind === "test"
        ? testMinutes(ftpTest)
        : kind === "openers"
          ? Math.max(d.minutes, OPENERS_MINUTES)
          : d.minutes;
    const lowered =
      d.loweredByCap ||
      (result.ladderStep !== null &&
        d.wantedStep !== null &&
        result.ladderStep < d.wantedStep &&
        !d.held);
    return {
      date: d.date,
      week: d.week,
      slot,
      kind,
      title: sessionTitle({
        kind,
        mainSet: result.mainSet,
        longBlocks: blocks,
        ftpTest,
      }),
      durationMin: minutes,
      steps: result.steps,
      reason: sessionReason({
        kind,
        weekType,
        hasTest: sk?.hasTest ?? false,
        purpose: structured || blocks ? d.purpose : null,
        longBlocks: blocks,
        steppedDown: lowered,
        held: d.held && structured,
        indoor: d.indoor,
      }),
      indoor: d.indoor,
      status: "planned",
      load: sessionLoad(result.steps),
      mainSet: result.mainSet,
      ladderStep: result.ladderStep,
      strengthNote: null,
    };
  }

  function wantedStep(kind: SessionKind, state: State, hold: boolean): number | null {
    if (!isLadderKind(kind)) return null;
    const length = LADDERS[level][kind].length;
    if (length === 0) return null;
    const step = Math.min(state.ladderCounts[kind], length - 1);
    return hold ? Math.max(0, step - 1) : step;
  }

  function buildWeek(
    sk: WeekSkeleton,
    state: State,
  ): { drafts: Draft[]; ceiling: number; chain: number; grew: boolean } {
    const hold = holdWeeks.has(sk.number) || noSecond.has(sk.number);
    const weightHold = holdWeeks.has(sk.number);
    const budget = weekBudget({
      week: sk,
      taperWeeks: structure.taperWeeks,
      hoursPerWeek,
      recentAverageHours: adjustments.recentAverageHours,
      hold: sk.type === "loading" && hold,
      state: state.budget,
    });
    const ceiling = budget.minutes;
    const dates = Array.from({ length: 7 }, (_, i) => plusDays(sk.startDate, i));
    const eventHere = eventDate !== null && dates.includes(eventDate);
    const openersHere = openersDate !== null && dates.includes(openersDate);
    const cutoff = eventHere ? (openersDate ?? eventDate) : null;
    const days = resolved.days.filter((d) => {
      const date = dates[d] ?? "";
      if (date === openersDate && openersHere) return false;
      if (eventHere && cutoff !== null && date >= cutoff) return false;
      return true;
    });

    // What each slot is this week.
    const taperLast = sk.taperIndex !== null && sk.taperIndex === structure.taperWeeks - 1;
    const mix = hardMix({
      level,
      purposes,
      phase: sk.phase === "taper" ? "peak" : sk.phase,
      week: sk.type === "loading" ? sk.number : 0,
    });
    let q1Kind: SessionKind;
    let q1Purpose: Purpose | null = mix.q1.purpose;
    let q1Step: number | null;
    let q2Kind: SessionKind | null = null;
    let q2Purpose: Purpose | null = null;
    if (sk.hasTest) {
      q1Kind = "test";
      q1Purpose = null;
      q1Step = null;
    } else if (sk.type === "recovery") {
      q1Kind = purposes.main === "muscle-building" ? "torque" : "tempo";
      q1Purpose = purposes.main;
      q1Step = 0;
    } else if (sk.type === "taper") {
      q1Kind = mix.q1.kind;
      const length = isLadderKind(q1Kind) ? LADDERS[level][q1Kind].length : 0;
      q1Step = length === 0 ? null : taperLast ? 0 : Math.max(0, length - 2);
    } else {
      q1Kind = mix.q1.kind;
      q1Step = wantedStep(q1Kind, state, weightHold);
      if (mix.q2 !== null && !noSecond.has(sk.number)) {
        q2Kind = mix.q2.kind;
        q2Purpose = mix.q2.purpose;
      }
    }
    const q2Step = q2Kind === null ? null : wantedStep(q2Kind, state, weightHold);
    const blocks =
      sk.type === "loading" && longRideHasBlocks(level, purposes.main, sk.phase)
        ? sk.phase === "build"
          ? 0
          : 1
        : null;

    // Days and the number of rides.
    const reserved = (eventHere ? 1 : 0) + (openersHere ? 1 : 0);
    let rideTarget = Math.max(0, rides - reserved);
    const bounds = (slot: Slot, kind: SessionKind, date: IsoDate): AllocationItem => {
      const indoor = isIndoor(date, kind);
      const recovery = sk.type === "recovery";
      const relaxedLong = sk.type !== "loading";
      if (slot === "long") {
        const prevLong = state.lastLoading?.long ?? settings.long[0];
        let max = settings.long[1];
        let min = relaxedLong ? RECOVERY_LONG_MIN : settings.long[0];
        if (recovery) max = Math.min(max, floor5(prevLong * RECOVERY_LONG_FRACTION));
        if (sk.type === "loading" && state.lastLoading) {
          max = Math.min(max, floor5(state.lastLoading.long * LONG_RIDE_GROWTH_CAP));
        }
        if (indoor) max = Math.min(max, Math.max(INDOOR_SESSION_MAX[level], min));
        max = Math.max(max, min);
        min = Math.min(min, max);
        return { weight: settings.longWeight, min, max };
      }
      if (kind === "test") {
        const fixed = testMinutes(ftpTest);
        return { weight: 1, min: fixed, max: fixed };
      }
      if (STRUCTURED_KINDS.includes(kind)) {
        const [levelMin, max] = settings.structured;
        const min = Math.max(levelMin, minimumMinutes({ kind, level, indoor }) ?? 0);
        const top = recovery ? Math.max(levelMin + RECOVERY_Q1_EXTRA_MIN, min) : max;
        return {
          weight: slot === "q2" ? Q2_WEIGHT : Q1_WEIGHT,
          min,
          max: indoor
            ? Math.max(min, Math.min(top, INDOOR_SESSION_MAX[level]))
            : Math.max(min, top),
        };
      }
      if (recovery || kind === "recovery") {
        return { weight: settings.easyWeight, min: 30, max: RECOVERY_EASY_MAX_MIN };
      }
      const [min, max] = settings.easy;
      return {
        weight: settings.easyWeight,
        min,
        max: indoor ? Math.min(max, INDOOR_EASY_MAX) : max,
      };
    };

    const hasLong = !eventHere;
    let layout = assignDays({
      days,
      rides: rideTarget,
      hasLong,
      hasQ1: true,
      hasQ2: templateQ2,
      longIsHard: longHardTemplate,
    });
    const kindFor = (slot: Slot): SessionKind => {
      if (slot === "long") return "long";
      if (slot === "q1") return q1Kind;
      if (slot === "q2") return q2Kind ?? (sk.type === "recovery" ? "recovery" : "endurance");
      return sk.type === "recovery" ? "recovery" : "endurance";
    };
    const fixedMinutes = openersHere ? OPENERS_MINUTES : 0;
    const itemsFor = (current: typeof layout): AllocationItem[] =>
      current.map((a) => bounds(a.slot, kindFor(a.slot), dates[a.day] ?? ""));
    // Drop easy rides, then others, while the minimum lengths do not fit the ceiling.
    for (;;) {
      const items = itemsFor(layout);
      const need = items.reduce((sum, item) => sum + item.min, 0) + fixedMinutes;
      if (need <= ceiling || rideTarget <= 1 || layout.length <= 1) break;
      rideTarget -= 1;
      layout = assignDays({
        days,
        rides: rideTarget,
        hasLong,
        hasQ1: true,
        hasQ2: templateQ2,
        longIsHard: longHardTemplate,
      });
    }
    let items = itemsFor(layout);
    if (items.reduce((sum, item) => sum + item.min, 0) + fixedMinutes > ceiling) {
      items = items.map((item) => ({ ...item, min: Math.min(item.min, 30) }));
    }
    const minutes = allocateMinutes(items, Math.max(0, ceiling - fixedMinutes));

    const drafts: Draft[] = layout.map((a, i) => {
      const kind = kindFor(a.slot);
      const date = dates[a.day] ?? sk.startDate;
      const item = items[i];
      const indoor = isIndoor(date, kind);
      const longBlock = a.slot === "long" ? blocks : null;
      const planned = minutes[i] ?? 0;
      if (indoor && item && planned === item.max) {
        const structured = STRUCTURED_KINDS.includes(kind);
        const cap = a.slot === "long" || structured ? INDOOR_SESSION_MAX[level] : INDOOR_EASY_MAX;
        const normal =
          a.slot === "long"
            ? settings.long[1]
            : structured
              ? settings.structured[1]
              : settings.easy[1];
        if (item.max === cap && cap < normal) flags.indoorLimited = true;
      }
      return {
        slot: a.slot,
        date,
        week: sk.number,
        kind,
        minutes: planned,
        wantedStep: a.slot === "q1" ? q1Step : a.slot === "q2" ? q2Step : null,
        longBlocks: longBlock,
        purpose:
          a.slot === "q1"
            ? q1Purpose
            : a.slot === "q2"
              ? q2Purpose
              : a.slot === "long"
                ? purposes.main
                : null,
        indoor,
        held: weightHold && (a.slot === "q1" || a.slot === "q2"),
        loweredByCap: false,
      };
    });
    if (openersHere) {
      drafts.push({
        slot: "openers",
        date: openersDate,
        week: sk.number,
        kind: "openers",
        minutes: OPENERS_MINUTES,
        wantedStep: null,
        longBlocks: null,
        purpose: null,
        indoor: false,
        held: false,
        loweredByCap: false,
      });
    }
    if (eventHere && structure.event) {
      drafts.push({
        slot: "event",
        date: eventDate,
        week: sk.number,
        kind: "event",
        minutes: EVENT_MINUTES[structure.event.duration],
        wantedStep: null,
        longBlocks: null,
        purpose: null,
        indoor: false,
        held: false,
        loweredByCap: false,
      });
    }

    // One extra easy ride in a week where the weight stalled (section 9).
    if (extraEasy.has(sk.number) && sk.type === "loading") {
      const used = new Set(drafts.map((d) => d.date));
      const total = drafts.filter((d) => d.kind !== "event").reduce((s, d) => s + d.minutes, 0);
      const spare = floor5(hoursPerWeek * 60) - total;
      const day = resolved.days.find((d) => {
        const date = dates[d] ?? "";
        return !used.has(date);
      });
      const length = Math.min(45, spare, settings.easy[1]);
      if (day !== undefined && length >= 30) {
        drafts.push({
          slot: "easy",
          date: dates[day] ?? sk.startDate,
          week: sk.number,
          kind: "endurance",
          minutes: floor5(length),
          wantedStep: null,
          longBlocks: null,
          purpose: null,
          indoor: isIndoor(dates[day] ?? sk.startDate, "endurance"),
          held: false,
          loweredByCap: false,
        });
      }
    }
    drafts.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { drafts, ceiling, chain: budget.chain, grew: budget.grew };
  }

  // Caps C3, C5 and C6: lower the longest main set one step (section 5); never below step 1.
  function applyCaps(
    drafts: Draft[],
    sk: WeekSkeleton,
    state: State,
  ): { sessions: PlannedSession[]; changed: boolean } {
    let sessions = drafts.map(materialize);
    let changed = false;
    for (let guard = 0; guard < 40; guard += 1) {
      const m = metrics(sessions);
      const overQuality = m.quality > settings.qualityCap * m.minutes + 1e-9;
      const overAbove = m.above > settings.aboveThresholdCap * m.minutes + 1e-9;
      const overLoad =
        sk.type === "loading" &&
        state.lastLoading !== null &&
        m.load > state.lastLoading.load * LOAD_GROWTH_CAP + 1e-9;
      if (!overQuality && !overAbove && !overLoad) break;
      const score = (s: PlannedSession): number =>
        overAbove ? aboveThresholdMinutes(s.steps) : overQuality ? qualityMinutes(s.steps) : s.load;
      const candidates = sessions
        .filter(
          (s) =>
            (s.slot === "q1" || s.slot === "q2" || (s.slot === "long" && s.mainSet !== null)) &&
            s.kind !== "test",
        )
        .sort((a, b) => score(b) - score(a));
      let fixed = false;
      const lowerable = candidates.find((s) => score(s) > 0 && (s.ladderStep ?? 0) > 0);
      const lowerDraft = lowerable ? drafts.find((d) => d.date === lowerable.date) : undefined;
      if (lowerable && lowerDraft) {
        if (lowerDraft.slot === "long") lowerDraft.longBlocks = (lowerable.ladderStep ?? 1) - 1;
        else lowerDraft.wantedStep = (lowerable.ladderStep ?? 1) - 1;
        lowerDraft.loweredByCap = true;
        fixed = true;
      } else if (!overLoad) {
        // The lowest step still breaks the cap: the session becomes endurance.
        const top = candidates.find((s) => s.slot !== "long" && score(s) > 0);
        const topDraft = top ? drafts.find((d) => d.date === top.date) : undefined;
        if (topDraft) {
          topDraft.kind = "endurance";
          topDraft.wantedStep = null;
          topDraft.loweredByCap = true;
          fixed = true;
        }
      }
      if (!fixed) {
        // Load only: shorten the longest easy ride, 5 minutes at a time, down to its minimum.
        const easy = drafts
          .filter((d) => (d.kind === "endurance" || d.kind === "recovery") && d.slot === "easy")
          .sort((a, b) => b.minutes - a.minutes)[0];
        const floor = easy?.kind === "recovery" ? 30 : settings.easy[0];
        if (!easy || easy.minutes - 5 < floor) break;
        easy.minutes -= 5;
      }
      changed = true;
      sessions = drafts.map(materialize);
    }
    return { sessions, changed };
  }

  // Build all weeks.
  let state: State = {
    budget: initialBudgetState,
    ladderCounts: initialCounts(),
    lastLoading: null,
  };
  const draftsByWeek: Draft[][] = [];
  const sessionsByWeek: PlannedSession[][] = [];
  const ceilings: number[] = [];
  const capNotices: Notice[] = [];
  for (const sk of structure.weeks) {
    const built = buildWeek(sk, state);
    const { sessions, changed } = applyCaps(built.drafts, sk, state);
    draftsByWeek.push(built.drafts);
    sessionsByWeek.push(sessions);
    ceilings.push(built.ceiling);
    if (changed) {
      capNotices.push({
        code: "caps-applied",
        message: `Week ${sk.number}: a main set is one step easier than the normal build, to stay within the weekly limits.`,
        week: sk.number,
      });
    }
    if (sk.type === "loading") {
      const m = metrics(sessions);
      const counts = { ...state.ladderCounts };
      const seen = new Set<LadderKind>();
      for (const s of sessions) {
        if (isLadderKind(s.kind) && !seen.has(s.kind) && s.slot !== "openers") {
          seen.add(s.kind);
          if (!missed.has(`${sk.number}:${s.kind}`)) counts[s.kind] += 1;
        }
      }
      const longSession = sessions.find((s) => s.kind === "long");
      state = {
        budget: { chain: built.chain, lastLoadingPlanned: m.minutes },
        ladderCounts: counts,
        lastLoading: {
          long: longSession?.durationMin ?? state.lastLoading?.long ?? settings.long[0],
          load: m.load,
        },
      };
    }
  }

  // No hard sessions on consecutive days (C8), across week borders. The later one becomes endurance.
  const flat = sessionsByWeek.flat().sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 1; i < flat.length; i += 1) {
    const prev = flat[i - 1];
    const current = flat[i];
    if (!prev || !current) continue;
    if (
      plusDays(prev.date, 1) === current.date &&
      isHard(prev.kind, prev.mainSet) &&
      isHard(current.kind, current.mainSet)
    ) {
      const draft = draftsByWeek[current.week - 1]?.find((d) => d.date === current.date);
      if (draft && current.kind !== "test") {
        if (draft.slot === "long") draft.longBlocks = null;
        else {
          draft.kind = "endurance";
          draft.wantedStep = null;
        }
        const weekIndex = current.week - 1;
        const list = sessionsByWeek[weekIndex];
        if (list) {
          const at = list.findIndex((s) => s.date === current.date);
          const rebuilt = materialize(draft);
          list[at] = rebuilt;
          flat[i] = rebuilt;
        }
      }
    }
  }

  // Strength notes (muscle building): after the ride, on hard-session days (section 8).
  const muscleMain = purposes.main === "muscle-building";
  const muscleSecond = purposes.secondary === "muscle-building";
  if (muscleMain || muscleSecond) {
    const kindOnDate = new Map(flat.map((s) => [s.date, s.kind]));
    structure.weeks.forEach((sk, w) => {
      const sessions = sessionsByWeek[w] ?? [];
      if (sk.type === "taper") return;
      const hard = sessions.filter(
        (s) => (s.slot === "q1" || s.slot === "q2") && s.kind !== "test",
      );
      const ok = (s: PlannedSession): boolean => {
        const next = kindOnDate.get(plusDays(s.date, 1));
        return next !== "test" && next !== "event";
      };
      const q1 = hard.find((s) => s.slot === "q1");
      const q2 = hard.find((s) => s.slot === "q2");
      const picks: PlannedSession[] = [];
      let text = STRENGTH_NOTE;
      if (sk.type === "recovery") {
        text = STRENGTH_NOTE_LIGHT;
        if (q1) picks.push(q1);
      } else if (muscleMain) {
        if (q1) picks.push(q1);
        if (q2 && level !== "amateur") picks.push(q2);
      } else {
        const one = q2 ?? q1;
        if (one) picks.push(one);
      }
      for (const pick of picks) {
        if (ok(pick)) pick.strengthNote = text;
      }
    });
  }

  // Weeks.
  const weeks: Week[] = structure.weeks.map((sk, w) => {
    const sessions = sessionsByWeek[w] ?? [];
    const m = metrics(sessions);
    const target = ceilings[w] ?? 0;
    return {
      number: sk.number,
      startDate: sk.startDate,
      phase: sk.phase,
      type: sk.type,
      hasTest: sk.hasTest,
      targetMinutes: target,
      targetHours: Math.round((target / 60) * 100) / 100,
      plannedMinutes: m.minutes,
      plannedHours: Math.round((m.minutes / 60) * 100) / 100,
      load: round1(m.load),
      qualityMinutes: Math.round(m.quality * 100) / 100,
      aboveThresholdMinutes: Math.round(m.above * 100) / 100,
      structuredCount: m.hard,
      sessions,
    };
  });

  // Weight loss: only when weight loss is in the top two and a weight and goal are known.
  let weight: Plan["weight"] = null;
  const weightInTop = purposes.main === "weight-loss" || purposes.secondary === "weight-loss";
  if (weightInTop && intake.weightKg !== undefined && intake.weightGoal !== undefined) {
    const result = weightPlan({
      startKg: intake.weightKg,
      goal: intake.weightGoal,
      startDate: structure.startDate,
      weeks: structure.weeks.length,
      capPercent: intake.weightRateCapPercent,
    });
    weight = result.plan;
    warnings.push(...result.warnings);
    if (result.plan?.capped) {
      notices.push({ code: "weight-capped", message: result.plan.message });
    }
  }

  if (flags.indoorLimited) {
    notices.push({
      code: "indoor-limit",
      message: `Indoor sessions are limited to ${INDOOR_SESSION_MAX[level]} minutes and easy rides to ${INDOOR_EASY_MAX} minutes, so some weeks hold fewer hours than the target.`,
    });
  }
  if (flags.hrMissing) {
    notices.push({
      code: "no-heart-rate",
      message: "No heart rate reference is set, so sessions show watts only.",
    });
  }
  notices.push(...capNotices);

  return {
    ...base,
    status: "ok",
    weeks,
    sessions: weeks.flatMap((week) => week.sessions).sort((a, b) => (a.date < b.date ? -1 : 1)),
    weight,
    notices,
    warnings,
  };
}
