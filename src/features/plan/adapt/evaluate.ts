/**
 * Re-evaluation of the plan (docs/plan/engine-rules.md, sections 11 to 14). Pure and deterministic: it takes
 * the stored sessions, the rides, the weight log and the profile inputs, and returns what to write. Only the
 * input fingerprint decides if anything is recalculated; the clock (`today`) only decides what is past.
 */
import { weekdayIndex, type IsoDate, type Weekday, type WeightEntry } from "@/features/athlete";
import {
  buildPlan,
  inputFingerprint,
  resolveInput,
  ENGINE_VERSION,
  STRUCTURED_KINDS,
  type ChangeReason,
  type Intake,
  type Plan,
  type PlanAdjustments,
  type PlanInput,
  type PlanUpdate,
  type SessionChange,
  type SessionKind,
  type Warning,
} from "../engine";
import { between, dayLabel, plus } from "./dates";
import { hashText } from "./hash";
import { matchRides } from "./match";
import {
  applyDiff,
  describeChange,
  diffStored,
  invertDiff,
  isEmptyDiff,
  mergePlan,
  sameSession,
  sessionData,
} from "./merge";
import { noPowerWarning, type NoPowerWarning } from "./no-power";
import {
  countedRides,
  kindWords,
  rebuildFuture,
  riddenMinutes,
  type Cause,
  type Rebuilt,
} from "./rebuild";
import { applyStatuses, markStatuses } from "./status";
import type {
  AdaptChange,
  AdaptRide,
  Match,
  PlanDiff,
  StatusUpdate,
  StoredSession,
  UndoPlan,
} from "./types";
import { STALLED_NO_ROOM_NOTICE, weightState, type WeightState } from "./weight-state";

/** No ride for this many days: the plan is not changed and a notice offers a new plan (section 13). */
export const INACTIVE_DAYS = 21;
/** A loading week this far above its plan is an overload: the next week is not raised (section 13). */
export const OVERLOAD_FACTOR = 1.25;

/** What the stored plan was built from, to name the reason of a change (all optional). */
export type PreviousInputs = {
  ftp?: number | null;
  lthr?: number | null;
  maxHr?: number | null;
  intake?: Intake;
};

export type EvaluateInput = {
  /** The stored plan: its start date (the calendar skeleton stays) and what it was built from. */
  plan: { startDate: IsoDate; previous?: PreviousInputs };
  /** All stored sessions of the plan (past and future), with their statuses and matches. */
  sessions: readonly StoredSession[];
  rides: readonly AdaptRide[];
  weightEntries: readonly WeightEntry[];
  /**
   * Intake and baseline (FTP, LTHR, max HR) as they are now. `adjustments.recentAverageHours` is kept from
   * plan creation; the other adjustments are computed here. Its `today` and `intake.startDate` are ignored.
   */
  profileInput: PlanInput;
  today: IsoDate;
  /** The fingerprint stored with the plan; null when there is none. */
  lastFingerprint: string | null;
  /** The fingerprint an Undo pinned; null when none. */
  undoneFingerprint: string | null;
  /**
   * True when the PO just edited the plan's answers: the sessions that change are given the reason
   * "plan-edited" ("you edited your plan") instead of a guess from what differs.
   */
  edited?: boolean;
};

export type EvaluateOutcome =
  /** The fingerprint equals the stored one: nothing is written, nothing is shown. */
  | "unchanged"
  /** The fingerprint equals the undone one: the same inputs are not recalculated. */
  | "pinned"
  /** The inputs changed: store `fingerprint`, apply `diff`; `update` is set when something is announced. */
  | "recalculated"
  /** The plan cannot be built (no FTP, too few days): nothing changes. */
  | "blocked";

/** The "Plan updated" notice: the engine's `PlanUpdate`, with a reason per change and the trigger. */
export type AdaptationUpdate = Omit<PlanUpdate, "changes"> & {
  changes: AdaptChange[];
  /** The notice text of the status card (R3). */
  message: string;
};

export type EvaluateResult = {
  outcome: EvaluateOutcome;
  /** Fingerprint of the evaluated state: store it when the outcome is "recalculated". */
  fingerprint: string;
  /** What to store as the undone fingerprint: the incoming one, or null once an input changed. */
  undoneFingerprint: string | null;
  /** Links of rides to sessions after matching. */
  matches: Match[];
  /** Rides that fit no session. */
  extraRides: AdaptRide[];
  /** Status and match changes to write (also with outcome "unchanged"; normally empty then). */
  statusUpdates: StatusUpdate[];
  /** Future sessions to insert, update and delete. */
  diff: PlanDiff;
  /** The notice for the "Plan updated" card, or null when no session changed in a way to announce. */
  update: AdaptationUpdate | null;
  /** How to undo the update, or null without one. */
  undo: UndoPlan | null;
  weight: WeightState | null;
  noPower: NoPowerWarning | null;
  /** Set after 21 days without a ride: the plan is not changed, the notice offers a new plan. */
  inactivity: { days: number; message: string } | null;
  warnings: Warning[];
};

const REASON_PRIORITY: readonly ChangeReason[] = [
  "missed-session",
  "extra-ride",
  "ramp-back",
  "weight-faster-than-cap",
  "weight-stalled",
  "plan-edited",
  "days-changed",
  "event-changed",
  "new-ftp",
  "new-heart-rate-zones",
  "settings-changed",
];

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function dayIndices(days: readonly Weekday[]): Set<number> {
  const names: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return new Set(days.map((day) => names.indexOf(day)));
}

/** The weeks after an overload week: hours are not raised and the second hard session is endurance. */
function overloadWeeks(
  plan: Plan,
  counted: readonly AdaptRide[],
  stored: readonly StoredSession[],
  today: IsoDate,
): number[] {
  const weeks: number[] = [];
  for (const week of plan.weeks) {
    if (week.startDate > today || week.type !== "loading" || week.plannedMinutes <= 0) continue;
    if (riddenMinutes(week, counted, stored) > OVERLOAD_FACTOR * week.plannedMinutes) {
      if (week.number + 1 <= plan.weeks.length) weeks.push(week.number + 1);
    }
  }
  return weeks;
}

type Missed = { week: number; kind: SessionKind };

function missedStructured(
  sessions: readonly StoredSession[],
  moved: ReadonlySet<IsoDate>,
): Missed[] {
  const seen = new Set<string>();
  const list: Missed[] = [];
  for (const s of sessions) {
    if (
      (s.status !== "missed" && s.status !== "skipped") ||
      !STRUCTURED_KINDS.includes(s.kind) ||
      moved.has(s.date)
    ) {
      continue;
    }
    const copy = sessions.find((c) => c.movedFrom === s.date);
    if (copy && (copy.status === "planned" || copy.status === "done")) continue;
    const key = `${s.week}:${s.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ week: s.week, kind: s.kind });
  }
  return list.sort((a, b) => a.week - b.week || (a.kind < b.kind ? -1 : 1));
}

function plural(count: number): string {
  return count === 1 ? "1 session" : `${count} sessions`;
}

/** The text of the "Plan updated" card (R3) for the main reason of an update. */
function noticeMessage(input: {
  code: ChangeReason;
  count: number;
  lastMissed: IsoDate | null;
  /** The ride behind an "extra ride" update; `asLongRide` when it counts as the week's long ride. */
  extraRide: { ride: AdaptRide; asLongRide: boolean } | null;
  weight: WeightState | null;
  onlyTargets: boolean;
}): string {
  const { code, count } = input;
  switch (code) {
    case "missed-session":
      return input.lastMissed
        ? `${plural(count)} changed because ${dayLabel(input.lastMissed)} was not ridden.`
        : `${plural(count)} changed because a session was not ridden.`;
    case "extra-ride":
      if (!input.extraRide) return `${plural(count)} changed because you rode more than planned.`;
      return `${plural(count)} changed because ${
        input.extraRide.asLongRide
          ? `your ${Math.round(input.extraRide.ride.movingMinutes)}-minute ride on ${dayLabel(input.extraRide.ride.date)} counts as this week's long ride`
          : `of your ${Math.round(input.extraRide.ride.movingMinutes)}-minute ride on ${dayLabel(input.extraRide.ride.date)}`
      }.`;
    case "ramp-back":
      return `${plural(count)} changed to ease you back in after a week without riding.`;
    case "weight-faster-than-cap":
      return (
        input.weight?.notice ??
        "Your weight trend is falling faster than the weekly limit. The plan holds your training hours."
      );
    case "weight-stalled":
      return "Your weight trend has been flat for 3 weeks. The plan adds one easy ride.";
    case "new-ftp":
      return input.onlyTargets
        ? "Targets updated for your new FTP."
        : `${plural(count)} changed. Targets updated for your new FTP.`;
    case "new-heart-rate-zones":
      return input.onlyTargets
        ? "Targets updated for your new heart rate zones."
        : `${plural(count)} changed. Targets updated for your new heart rate zones.`;
    case "days-changed":
      return `${plural(count)} changed because your riding days changed.`;
    case "event-changed":
      return `${plural(count)} changed because your event changed.`;
    case "plan-edited":
      return `${plural(count)} changed because you edited your plan.`;
    case "settings-changed":
      return `${plural(count)} changed because your settings changed.`;
  }
}

/** One evaluation of one list of stored sessions: matching, statuses, adjustments, the rebuilt future. */
type Pass = {
  matches: Match[];
  extraRides: AdaptRide[];
  statusUpdates: StatusUpdate[];
  /** The input sessions with the new statuses and matches. */
  current: StoredSession[];
  startedToday: boolean;
  plan: Plan;
  adjustments: PlanAdjustments;
  rebuilt: Rebuilt;
  weight: WeightState | null;
  weekNumber: number | undefined;
  fingerprint: string;
  inactivity: { days: number; message: string } | null;
  noPower: NoPowerWarning | null;
  blocked: boolean;
  warnings: Warning[];
  missedList: Missed[];
  noSecond: number[];
  make: (adjustments: PlanAdjustments) => PlanInput;
};

function runPass(input: EvaluateInput, sessions: readonly StoredSession[]): Pass {
  const { today, profileInput } = input;
  const intake: Intake = { ...profileInput.intake, startDate: input.plan.startDate };
  const ftp = profileInput.ftp;
  const recent = profileInput.adjustments?.recentAverageHours;
  const base: PlanAdjustments = recent === undefined ? {} : { recentAverageHours: recent };
  const make = (adjustments: PlanAdjustments): PlanInput => ({
    ...profileInput,
    intake,
    today,
    adjustments,
  });

  // Matching and statuses.
  const { matches, extraRides } = matchRides(sessions, input.rides, today, { ftp });
  const statusUpdates = markStatuses(sessions, matches, today);
  const current = applyStatuses(sessions, statusUpdates);
  const noPower = noPowerWarning(current, input.rides, today);
  const counted = countedRides(input.rides, current);
  const startedToday = input.rides.some((ride) => ride.date === today);

  const skeleton = buildPlan(make(base));
  const idle = {
    matches,
    extraRides,
    statusUpdates,
    current,
    startedToday,
    noPower,
    warnings: skeleton.warnings,
    inactivity: null,
    weight: null,
    weekNumber: undefined,
    missedList: [] as Missed[],
    noSecond: [] as number[],
    make,
    plan: skeleton,
    adjustments: base,
    rebuilt: { sessions: [], causes: new Map<IsoDate, Cause>(), movedFrom: new Set<IsoDate>() },
  };
  if (skeleton.status === "blocked" || ftp === null) {
    return { ...idle, blocked: true, fingerprint: inputFingerprint(make(base)) };
  }

  // Weight state (section 9): only with weight loss in the top two and a start weight.
  const purposes = resolveInput(make(base)).purposes;
  const weightOn =
    (purposes.main === "weight-loss" || purposes.secondary === "weight-loss") &&
    intake.weightKg !== undefined;
  const weightRaw: WeightState | null =
    weightOn && intake.weightKg !== undefined
      ? weightState(
          input.weightEntries,
          {
            startKg: intake.weightKg,
            capPercent: intake.weightRateCapPercent,
            planStart: input.plan.startDate,
            weekTypes: skeleton.weeks.map((w) => w.type),
          },
          today,
        )
      : null;

  const rideDates = input.rides.map((r) => r.date).sort();
  const lastRide = rideDates[rideDates.length - 1];
  const sinceRide =
    lastRide !== undefined
      ? between(lastRide, today)
      : today >= input.plan.startDate
        ? between(input.plan.startDate, today)
        : 0;
  const inactive = sinceRide >= INACTIVE_DAYS;
  const inactivity = inactive
    ? {
        days: sinceRide,
        message: `You have not ridden for ${sinceRide} days. Your plan is not changed. You can start a new plan.`,
      }
    : null;

  // The adjustments and the rebuilt future settle together (a move changes what counts as missed, an
  // overload depends on the plan's own weekly minutes).
  let noSecond: number[] = [];
  let moved = new Set<IsoDate>();
  let adjustments: PlanAdjustments = base;
  let plan: Plan = skeleton;
  let rebuilt: Rebuilt = idle.rebuilt;
  let missedList: Missed[] = [];
  for (let round = 0; round < 4; round += 1) {
    missedList = missedStructured(current, moved);
    adjustments = {
      ...base,
      ...(weightRaw && weightRaw.holdWeeks.length > 0 ? { holdWeeks: weightRaw.holdWeeks } : {}),
      ...(weightRaw && weightRaw.extraEasyRideWeeks.length > 0
        ? { extraEasyRideWeeks: weightRaw.extraEasyRideWeeks }
        : {}),
      ...(noSecond.length > 0 ? { noSecondHardWeeks: noSecond } : {}),
      ...(missedList.length > 0 ? { missedStructured: missedList } : {}),
    };
    plan = buildPlan(make(adjustments));
    rebuilt = inactive
      ? rebuilt
      : rebuildFuture({
          plan,
          stored: current,
          rides: input.rides,
          extraRides,
          today,
          availableDays: dayIndices(intake.availableDays),
          ftp,
          lthr: profileInput.lthr,
          maxHr: profileInput.maxHr,
          ftpTest: intake.ftpTest ?? "twenty-minute",
        });
    const nextSecond = overloadWeeks(plan, counted, current, today);
    const stable = sameNumbers(nextSecond, noSecond) && sameDates(rebuilt.movedFrom, moved);
    noSecond = nextSecond;
    moved = rebuilt.movedFrom;
    if (stable) break;
  }

  // The fingerprint of this state.
  const weekStart = plus(today, -(weekdayIndex(today) ?? 0));
  const thisWeek = plan.weeks.find((w) => w.startDate === weekStart);
  const ridden = thisWeek
    ? riddenMinutes(thisWeek, counted, current)
    : counted
        .filter((r) => r.date >= weekStart && r.date <= plus(weekStart, 6))
        .reduce((sum, r) => sum + r.movingMinutes, 0);
  const hardExtra = extraRides
    .filter((r) => r.avgPowerW !== null && r.avgPowerW >= 0.8 * ftp && r.date >= plus(today, -1))
    .map((r) => r.date);
  const fingerprint = `${ENGINE_VERSION}-${hashText(
    JSON.stringify({
      engine: inputFingerprint(make(adjustments)),
      // Only what the statuses and matches say: a plain planned session carries no information of its own.
      sessions: current
        .filter((s) => s.status !== "planned" || s.activityId !== null || s.matchSource !== null)
        .map((s) => `${s.date}:${s.status}:${s.activityId ?? ""}:${s.matchSource ?? ""}`)
        .sort(),
      week: weekStart,
      ridden: Math.round(ridden / 15),
      today: startedToday,
      hardExtra,
      inactive,
    }),
  )}`;
  return {
    ...idle,
    blocked: false,
    plan,
    adjustments,
    rebuilt,
    missedList,
    noSecond,
    inactivity,
    fingerprint,
    weekNumber: thisWeek?.number,
    weight:
      weightRaw === null
        ? null
        : withRoomNotice(weightRaw, plan, adjustments, make, thisWeek?.number),
  };
}

const NO_DIFF: PlanDiff = { insert: [], update: [], delete: [] };

/**
 * The re-evaluation (section 12).
 *
 * 1. Match rides to sessions and mark done and missed (section 11, R5-PO1). The weight state, the missed
 *    structured sessions and overload weeks become `PlanInput.adjustments`.
 * 2. Fingerprint of the evaluated state: the engine's input fingerprint plus the statuses and matches, the
 *    minutes ridden this week rounded to 15 and the week. Equal to the stored one: stop, write nothing.
 *    Equal to the undone one: stop (the Undo pin).
 * 3. Otherwise rebuild with `buildPlan`, replace only the sessions that have not happened (never past
 *    sessions, never a started session of today, never locked matches), handle missed sessions (moved once
 *    or dropped), shorten the week after extra rides, ramp back, and return the diff, the notice and Undo.
 *    The result is settled: matching runs again on the new sessions until it no longer changes, so
 *    evaluating the applied result again changes nothing.
 *
 * After 21 days without a ride the plan is not changed.
 */
export function evaluatePlan(input: EvaluateInput): EvaluateResult {
  const { today, profileInput } = input;
  const first = runPass(input, input.sessions);
  const common = (state: Pass) => ({
    matches: state.matches,
    extraRides: state.extraRides,
    noPower: state.noPower,
    weight: state.weight,
    inactivity: state.inactivity,
    warnings: state.plan.warnings.length > 0 ? state.plan.warnings : state.warnings,
    fingerprint: state.fingerprint,
  });
  const quiet = {
    diff: NO_DIFF,
    update: null,
    undo: null,
  };
  if (first.blocked || profileInput.ftp === null) {
    return {
      ...common(first),
      ...quiet,
      outcome: "blocked",
      statusUpdates: first.statusUpdates,
      undoneFingerprint: input.undoneFingerprint,
    };
  }
  if (input.lastFingerprint === first.fingerprint) {
    return {
      ...common(first),
      ...quiet,
      outcome: "unchanged",
      statusUpdates: first.statusUpdates,
      undoneFingerprint: input.undoneFingerprint === first.fingerprint ? first.fingerprint : null,
    };
  }
  if (input.undoneFingerprint === first.fingerprint) {
    return {
      ...common(first),
      ...quiet,
      outcome: "pinned",
      statusUpdates: first.statusUpdates,
      undoneFingerprint: first.fingerprint,
    };
  }

  // Settle: merge the rebuilt future, match again on the result, and repeat until the matches stay.
  let state = first;
  let settled: StoredSession[] = state.current;
  const causes = new Map<IsoDate, Cause>(state.rebuilt.causes);
  for (let round = 0; round < 4; round += 1) {
    const diff = state.inactivity
      ? NO_DIFF
      : mergePlan(state.current, state.rebuilt.sessions, {
          today,
          startedToday: state.startedToday,
        });
    settled = applyDiff(state.current, diff, (s) => `new:${s.date}`);
    const again = runPass(input, settled);
    if (again.statusUpdates.length === 0) break;
    state = again;
    settled = again.current;
    for (const [date, cause] of again.rebuilt.causes)
      if (!causes.has(date)) causes.set(date, cause);
  }

  // Everything relative to the stored rows: a row that was replaced on its date keeps its id, the statuses
  // are those of the rows that exist, and the diff is what is left.
  const origByDate = new Map(input.sessions.map((s) => [s.date, s]));
  const settledIds = new Set(settled.map((s) => s.id));
  settled = settled.map((s) => {
    const old = origByDate.get(s.date);
    return s.id.startsWith("new:") && old && !settledIds.has(old.id) ? { ...s, id: old.id } : s;
  });
  const finalById = new Map(settled.map((s) => [s.id, s]));
  const withStatuses = input.sessions.map((s): StoredSession => {
    const final = finalById.get(s.id);
    return final
      ? { ...s, status: final.status, activityId: final.activityId, matchSource: final.matchSource }
      : s;
  });
  const statusUpdates = markStatusChanges(input.sessions, withStatuses);
  const diff = diffStored(withStatuses, settled);
  const result: EvaluateResult = {
    ...common(state),
    matches: state.matches,
    statusUpdates,
    diff,
    update: null,
    undo: null,
    outcome: "recalculated",
    undoneFingerprint: null,
  };
  if (isEmptyDiff(diff)) return result;
  return withUpdate(result, input, state, settled, causes);
}

function markStatusChanges(
  before: readonly StoredSession[],
  after: readonly StoredSession[],
): StatusUpdate[] {
  const updates: StatusUpdate[] = [];
  after.forEach((s, i) => {
    const was = before[i];
    if (
      was &&
      (was.status !== s.status ||
        was.activityId !== s.activityId ||
        was.matchSource !== s.matchSource)
    ) {
      updates.push({
        id: s.id,
        status: s.status,
        activityId: s.activityId,
        matchSource: s.matchSource,
      });
    }
  });
  return updates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The "Plan updated" notice and Undo for a non-empty diff. */
function withUpdate(
  result: EvaluateResult,
  input: EvaluateInput,
  state: Pass,
  settled: readonly StoredSession[],
  causes: ReadonlyMap<IsoDate, Cause>,
): EvaluateResult {
  const { today, profileInput } = input;
  const { plan, adjustments, make, weight } = state;
  const intake: Intake = { ...profileInput.intake, startDate: input.plan.startDate };
  const ftp = profileInput.ftp ?? 0;
  const diff = result.diff;

  const edited = input.edited === true;
  const previous = input.plan.previous ?? {};
  const daysChanged =
    previous.intake !== undefined &&
    [...previous.intake.availableDays].sort().join() !== [...intake.availableDays].sort().join();
  const eventChanged =
    previous.intake !== undefined &&
    JSON.stringify(previous.intake.event ?? null) !== JSON.stringify(intake.event ?? null);
  const ftpChanged =
    previous.ftp !== undefined &&
    previous.ftp !== null &&
    Math.round(previous.ftp) !== Math.round(ftp);
  const hrChanged =
    (previous.lthr !== undefined && (previous.lthr ?? null) !== (profileInput.lthr ?? null)) ||
    (previous.maxHr !== undefined && (previous.maxHr ?? null) !== (profileInput.maxHr ?? null));

  // Which dates does each adjustment move? Rebuild without it and compare: the rigorous way to name a cause.
  type Owner = "missed" | "overload" | "hold" | "extra";
  const owners = new Map<IsoDate, Owner>();
  const groups: [Owner, keyof PlanAdjustments][] = [
    ["missed", "missedStructured"],
    ["overload", "noSecondHardWeeks"],
    ["hold", "holdWeeks"],
    ["extra", "extraEasyRideWeeks"],
  ];
  const mine = new Map(plan.sessions.map((s) => [s.date, s]));
  for (const [owner, key] of groups) {
    if (adjustments[key] === undefined) continue;
    const copy = Object.fromEntries(
      Object.entries(adjustments).filter(([name]) => name !== key),
    ) as PlanAdjustments;
    const other = buildPlan(make(copy));
    const theirs = new Map(other.sessions.map((s) => [s.date, s]));
    for (const date of new Set([...mine.keys(), ...theirs.keys()])) {
      const a = mine.get(date);
      const b = theirs.get(date);
      const same =
        a !== undefined &&
        b !== undefined &&
        sameSession(sessionData({ ...a, movedFrom: null }), sessionData({ ...b, movedFrom: null }));
      if (!same && !owners.has(date)) owners.set(date, owner);
    }
  }

  const classify = (change: SessionChange): Cause => {
    const cause = causes.get(change.date);
    if (cause) return cause;
    const owner = change.change === "targets" ? undefined : owners.get(change.date);
    const kind = change.after?.kind ?? change.before?.kind;
    if (owner === "overload") {
      return {
        code: "extra-ride",
        reason:
          "Last week was more than 25 % above its plan, so this week's hours are not raised and the second hard session is an easy ride.",
      };
    }
    if (owner === "hold") {
      return {
        code: "weight-faster-than-cap",
        reason:
          "Your weight trend is falling faster than the weekly limit, so the hours are held and the main set is one step easier.",
      };
    }
    if (owner === "extra") {
      return {
        code: "weight-stalled",
        reason:
          change.change === "added"
            ? "Your weight trend has been flat for 3 weeks, so one easy ride is added."
            : "Your weight trend has been flat for 3 weeks, so one easy ride is added and the week is trimmed to stay within its limits.",
      };
    }
    if (owner === "missed") {
      return {
        code: "missed-session",
        reason:
          kind !== undefined && STRUCTURED_KINDS.includes(kind)
            ? `A missed session is not made up, so the build of this ${kindWords(kind)} stays one step behind.`
            : "A missed session is not made up, so the build stays one step behind.",
      };
    }
    if (edited && change.change !== "targets") {
      return {
        code: "plan-edited",
        reason: "You edited your plan, so this session was recalculated.",
      };
    }
    if (daysChanged && change.change !== "targets") {
      return {
        code: "days-changed",
        reason: "Your riding days changed, so the week was laid out again.",
      };
    }
    if (eventChanged && change.change !== "targets") {
      return {
        code: "event-changed",
        reason: "Your event changed, so the weeks were laid out again.",
      };
    }
    if (change.change === "targets" && ftpChanged) {
      return { code: "new-ftp", reason: "Targets updated for your new FTP." };
    }
    if (change.change === "targets" && hrChanged) {
      return {
        code: "new-heart-rate-zones",
        reason: "Targets updated for your new heart rate zones.",
      };
    }
    if (edited) {
      return {
        code: "plan-edited",
        reason: "You edited your plan, so this session was recalculated.",
      };
    }
    return {
      code: "settings-changed",
      reason: "Your settings changed, so this session was recalculated.",
    };
  };

  const changes: AdaptChange[] = [];
  for (const entry of diff.insert) {
    const change = describeChange(null, entry.session);
    if (change) changes.push(withReason(change, classify(change)));
  }
  for (const entry of diff.delete) {
    const change = describeChange(entry.session, null);
    if (change) changes.push(withReason(change, classify(change)));
  }
  for (const entry of diff.update) {
    const change = describeChange(entry.before, entry.after);
    if (change) changes.push(withReason(change, classify(change)));
  }
  changes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (changes.length === 0) return result;

  const codes = new Set(changes.map((c) => c.reasonCode));
  // An edit names itself in the notice, also when a missed session changes other sessions in the same run.
  const primary =
    edited && codes.has("plan-edited")
      ? "plan-edited"
      : (REASON_PRIORITY.find((code) => codes.has(code)) ?? "settings-changed");
  const missedDates = settled
    .filter((s) => s.status === "missed" && s.date < today)
    .map((s) => s.date)
    .sort();
  const ridesById = new Map(input.rides.map((r) => [r.id, r]));
  const early = state.matches
    .filter((m) => m.doneEarly && between(m.rideDate, m.sessionDate) > 1)
    .map((m) => ridesById.get(m.rideId))
    .filter((r): r is AdaptRide => r !== undefined);
  const trigger = [...state.extraRides, ...early].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const extraRide = trigger
    ? { ride: trigger, asLongRide: early.some((r) => r.id === trigger.id) }
    : null;
  const message = noticeMessage({
    code: primary,
    count: changes.length,
    lastMissed: missedDates[missedDates.length - 1] ?? null,
    extraRide,
    weight,
    onlyTargets: changes.every((c) => c.change === "targets"),
  });
  const update: AdaptationUpdate = {
    reasons: REASON_PRIORITY.filter((code) => codes.has(code)),
    changes,
    message,
    previousFingerprint: input.lastFingerprint ?? "",
  };
  // The pin is the fingerprint the restored state evaluates to: exactly what the next evaluation computes
  // after an Undo (matching on the restored sessions can differ from matching on the new ones).
  const inverse = invertDiff(diff);
  const restored = applyDiff(settled, inverse, (s) => `new:${s.date}`);
  const undo: UndoPlan = {
    description: `Restores the plan as it was before ${dayLabel(today)}.${
      codes.has("missed-session") ? " The missed session stays missed." : ""
    }`,
    diff: inverse,
    restoreFingerprint: input.lastFingerprint,
    undoneFingerprint: runPass(input, restored).fingerprint,
  };
  return { ...result, update, undo };
}

function sameDates(a: ReadonlySet<IsoDate>, b: ReadonlySet<IsoDate>): boolean {
  return a.size === b.size && [...a].every((date) => b.has(date));
}

function withReason(change: SessionChange, cause: Cause): AdaptChange {
  return { ...change, reasonCode: cause.code, reason: cause.reason };
}

/** A flat trend that adds an easy ride only says so when the engine found a free day; else it says why not. */
function withRoomNotice(
  weight: WeightState,
  plan: Plan,
  adjustments: PlanAdjustments,
  make: (adjustments: PlanAdjustments) => PlanInput,
  week: number | undefined,
): WeightState {
  if (week === undefined || !weight.extraEasyRideWeeks.includes(week)) return weight;
  const without = buildPlan(make({ ...adjustments, extraEasyRideWeeks: [] }));
  const withRide = plan.weeks[week - 1]?.sessions.length ?? 0;
  const noRide = without.weeks[week - 1]?.sessions.length ?? 0;
  return withRide > noRide ? weight : { ...weight, notice: STALLED_NO_ROOM_NOTICE };
}
