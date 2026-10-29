/**
 * Turns the engine's fresh plan into the future sessions the PO should have now (docs/plan/engine-rules.md,
 * sections 12 and 13): a missed session is moved once or dropped (never made up, never doubled), extra rides
 * shorten the rest of the week, a week without rides ramps back, and a hard ride or a frozen hard session
 * never sits next to another hard day. Pure and deterministic: the same plan, sessions and rides always give
 * the same result, and it always starts from the engine's plan, never from its own earlier output.
 */
import { weekdayIndex, type IsoDate } from "@/features/athlete";
import {
  INDOOR_EASY_MAX,
  LEVEL_SETTINGS,
  RECOVERY_LONG_MIN,
  STRUCTURED_KINDS,
  floor5,
  sessionLoad,
  sessionReason,
  sessionSteps,
  sessionTitle,
  stepContext,
  type ChangeReason,
  type FtpTestKind,
  type Plan,
  type SessionKind,
  type Week,
} from "../engine";
import { between, dayLabel, mondayOf, plus } from "./dates";
import { isFrozen, sessionData } from "./merge";
import { isIgnoredRide } from "./match";
import type { AdaptRide, SessionData, StoredSession } from "./types";

/** A week may hold up to this share over its planned hours when extra rides were added (section 13). */
export const EXTRA_RIDE_TOLERANCE = 1.1;
/** After a week without rides: this share of the last ridden week, then +8 % a week (`RAMP_BACK_FRACTION`). */
export const RAMP_BACK_FRACTION = 0.8;
export const RAMP_BACK_GROWTH = 1.08;
/** A ride at this share of FTP or more counts as a hard day for the no-back-to-back rule. */
export const HARD_RIDE_SHARE = 0.8;
/** Two structured sessions missed within this many days lower next week's structured budget by one. */
export const MISSED_PAIR_DAYS = 7;

/** Why a future session changed, as the "Plan changes" screen shows it. */
export type Cause = { code: ChangeReason; reason: string };

export type RebuildInput = {
  /** The engine's plan for the current inputs and adjustments. */
  plan: Plan;
  /** Stored sessions with their statuses and matches already updated. */
  stored: readonly StoredSession[];
  rides: readonly AdaptRide[];
  /** Rides that fit no session. */
  extraRides: readonly AdaptRide[];
  today: IsoDate;
  /** Available days of the profile, 0 = Monday. */
  availableDays: ReadonlySet<number>;
  ftp: number;
  lthr?: number | null | undefined;
  maxHr?: number | null | undefined;
  ftpTest: FtpTestKind;
};

export type Rebuilt = {
  /** The future sessions, ordered by date (not yet merged with the stored ones). */
  sessions: SessionData[];
  /** Reason per date for the sessions this step changed on purpose. */
  causes: Map<IsoDate, Cause>;
  /** Dates of missed sessions that were moved: they are not "missed" for the ladder any more. */
  movedFrom: Set<IsoDate>;
};

/** A hard session: structured, or a long ride with blocks. */
export function isHardSession(kind: SessionKind, mainSet: string | null): boolean {
  return STRUCTURED_KINDS.includes(kind) || (kind === "long" && mainSet !== null);
}

const KIND_WORDS: Record<SessionKind, string> = {
  recovery: "recovery ride",
  endurance: "endurance ride",
  long: "long ride",
  tempo: "tempo session",
  "sweet-spot": "sweet spot session",
  threshold: "threshold session",
  vo2: "VO2 max session",
  sprint: "sprint session",
  torque: "torque session",
  openers: "openers",
  test: "FTP test",
  event: "event",
};

/** Plain words for a kind in a sentence, e.g. "sweet spot session". */
export function kindWords(kind: SessionKind): string {
  return KIND_WORDS[kind];
}

function weekMinutes(sessions: Iterable<SessionData>): number {
  let sum = 0;
  for (const s of sessions) if (s.kind !== "event") sum += s.durationMin;
  return sum;
}

/** Rides that count as ridden volume: not ignored (commute, under 20 minutes), or linked by the PO. */
export function countedRides(
  rides: readonly AdaptRide[],
  stored: readonly StoredSession[],
): AdaptRide[] {
  const linked = new Set(stored.map((s) => s.activityId).filter((id): id is string => id !== null));
  return rides.filter((ride) => !isIgnoredRide(ride) || linked.has(ride.id));
}

/** Minutes ridden in a plan week: the counted rides, plus sessions the PO marked done without a ride. */
export function riddenMinutes(
  week: Pick<Week, "startDate">,
  counted: readonly AdaptRide[],
  stored: readonly StoredSession[],
): number {
  const end = plus(week.startDate, 6);
  const rideMinutes = counted
    .filter((r) => r.date >= week.startDate && r.date <= end)
    .reduce((sum, r) => sum + r.movingMinutes, 0);
  const byHand = stored
    .filter(
      (s) =>
        s.status === "done" &&
        s.activityId === null &&
        s.date >= week.startDate &&
        s.date <= end &&
        s.kind !== "event",
    )
    .reduce((sum, s) => sum + s.durationMin, 0);
  return rideMinutes + byHand;
}

export function rebuildFuture(input: RebuildInput): Rebuilt {
  const { plan, stored, today } = input;
  const settings = LEVEL_SETTINGS[plan.level];
  const causes = new Map<IsoDate, Cause>();
  const movedFrom = new Set<IsoDate>();
  const startedToday = input.rides.some((ride) => ride.date === today);
  const weekOfDate = (date: IsoDate): Week | undefined =>
    plan.weeks.find((w) => date >= w.startDate && date <= plus(w.startDate, 6));

  // What is frozen stays; the engine's sessions fill the rest of the future.
  const frozen = stored.filter((s) => isFrozen(s, today, startedToday));
  const frozenDates = new Set(frozen.map((s) => s.date));
  const working = new Map<IsoDate, SessionData>();
  for (const s of plan.sessions) {
    if (s.date >= today && !frozenDates.has(s.date)) {
      working.set(s.date, { ...sessionData({ ...s, movedFrom: null }) });
    }
  }
  const setCause = (date: IsoDate, cause: Cause): void => {
    if (!causes.has(date)) causes.set(date, cause);
  };

  // Rides ridden in a plan week, counting every ride that is not ignored.
  const counted = countedRides(input.rides, stored);
  const riddenIn = (week: Week): number => riddenMinutes(week, counted, stored);

  const hardRideDates = new Set(
    input.extraRides
      .filter((r) => r.avgPowerW !== null && r.avgPowerW >= HARD_RIDE_SHARE * input.ftp)
      .map((r) => r.date),
  );
  const rideNear = (date: IsoDate): boolean =>
    counted.some((r) => Math.abs(between(date, r.date)) <= 1);
  const hardOn = (date: IsoDate): boolean => {
    if (hardRideDates.has(date)) return true;
    const own = working.get(date);
    if (own) return isHardSession(own.kind, own.mainSet);
    const fixed = frozen.find((s) => s.date === date);
    return (
      fixed !== undefined &&
      (fixed.status === "planned" || fixed.status === "done") &&
      isHardSession(fixed.kind, fixed.mainSet)
    );
  };
  const occupied = (date: IsoDate): boolean =>
    working.has(date) || frozenDates.has(date) || counted.some((r) => r.date === date);

  const context = (indoor: boolean) =>
    stepContext({ ftp: input.ftp, lthr: input.lthr, maxHr: input.maxHr, indoor });

  /** The session with another kind and/or length, steps and title rebuilt by the engine's library. */
  const reshape = (
    s: SessionData,
    change: { kind?: SessionKind; durationMin?: number },
    note: string,
  ): SessionData => {
    const kind = change.kind ?? s.kind;
    const durationMin = change.durationMin ?? s.durationMin;
    const blocks = kind === "long" && s.mainSet !== null;
    const result = sessionSteps({
      kind,
      level: plan.level,
      durationMin,
      ...(s.ladderStep !== null && kind === s.kind ? { ladderStep: s.ladderStep } : {}),
      longBlocks: blocks ? s.ladderStep : null,
      ftpTest: input.ftpTest,
      context: context(s.indoor),
    });
    const week = plan.weeks[s.week - 1];
    const demoted = change.kind !== undefined && change.kind !== s.kind;
    return {
      ...s,
      kind: result.kind,
      slot: demoted ? "easy" : s.slot,
      title: sessionTitle({
        kind: result.kind,
        mainSet: result.mainSet,
        longBlocks: result.kind === "long" && result.mainSet !== null,
        ftpTest: input.ftpTest,
      }),
      durationMin,
      steps: result.steps,
      reason: `${
        demoted
          ? sessionReason({
              kind: result.kind,
              weekType: week?.type ?? "loading",
              indoor: s.indoor,
            })
          : s.reason
      } ${note}`,
      load: sessionLoad(result.steps),
      mainSet: result.mainSet,
      ladderStep: result.ladderStep,
      strengthNote: demoted ? null : s.strengthNote,
    };
  };

  // 1. Missed sessions: moved once, or dropped (section 13). Never made up, never doubled.
  const missed = stored
    .filter(
      (s) =>
        s.status === "missed" &&
        s.movedFrom === null &&
        s.date >= mondayOf(today) &&
        (STRUCTURED_KINDS.includes(s.kind) || s.kind === "long"),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const m of missed) {
    const copy = stored.find((s) => s.movedFrom === m.date);
    if (copy && (copy.status !== "planned" || isFrozen(copy, today, startedToday))) continue;
    const week = weekOfDate(m.date);
    if (!week) continue;
    const sunday = plus(week.startDate, 6);
    const long = m.kind === "long";
    let target: IsoDate | null = null;
    if (long) {
      for (let d = plus(m.date, 1); d <= sunday; d = plus(d, 1)) {
        if (d < today || !input.availableDays.has(weekdayIndex(d) ?? 0)) continue;
        if (occupied(d) || rideNear(d)) continue;
        target = d;
        break;
      }
    } else {
      const next = [plus(m.date, 1), plus(m.date, 2)].find((d) =>
        input.availableDays.has(weekdayIndex(d) ?? 0),
      );
      if (
        next !== undefined &&
        next <= sunday &&
        next >= today &&
        !occupied(next) &&
        !rideNear(next)
      ) {
        target = next;
      }
    }
    if (target === null) continue;
    const hardLong = long && m.mainSet !== null;
    const before = hardOn(plus(target, -1));
    const after = long && !hardLong ? false : hardOn(plus(target, 1));
    if (before || after) continue;
    const fresh = plan.sessions.find((s) => s.date === m.date && s.kind === m.kind);
    const base = sessionData({ ...(fresh ?? m), movedFrom: null });
    const moved: SessionData = {
      ...base,
      date: target,
      week: week.number,
      status: "planned",
      movedFrom: m.date,
      reason: `${base.reason} Moved from ${dayLabel(m.date)}, which was missed.`,
    };
    const inWeek = [...working.values()].filter((s) => s.week === week.number);
    if (riddenIn(week) + weekMinutes(inWeek) + moved.durationMin > week.targetMinutes) continue;
    working.set(target, moved);
    movedFrom.add(m.date);
    setCause(target, {
      code: "missed-session",
      reason: `The missed ${kindWords(m.kind)} from ${dayLabel(m.date)} moves here, to a free day that is not next to another hard session.`,
    });
  }

  // 2. Two or more structured sessions missed within 7 days: next week has one hard session fewer.
  const gone = stored
    .filter(
      (s) =>
        (s.status === "missed" || s.status === "skipped") &&
        STRUCTURED_KINDS.includes(s.kind) &&
        !movedFrom.has(s.date),
    )
    .filter((s) => {
      const copy = stored.find((c) => c.movedFrom === s.date);
      return !copy || (copy.status !== "planned" && copy.status !== "done");
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const trimmed = new Set<string>();
  gone.forEach((later, i) => {
    const paired = gone
      .slice(0, i)
      .some((earlier) => between(earlier.date, later.date) <= MISSED_PAIR_DAYS - 1);
    if (!paired) return;
    const start = plus(mondayOf(later.date), 7);
    if (trimmed.has(start) || start < today) return;
    trimmed.add(start);
    const hard = [...working.values()]
      .filter(
        (s) => s.date >= start && s.date <= plus(start, 6) && isHardSession(s.kind, s.mainSet),
      )
      .filter((s) => s.kind !== "test" && s.kind !== "long")
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const all = [...working.values()].filter(
      (s) => s.date >= start && s.date <= plus(start, 6) && isHardSession(s.kind, s.mainSet),
    );
    const last = hard[0];
    if (all.length >= 2 && last) {
      working.set(
        last.date,
        reshape(
          last,
          { kind: "endurance", durationMin: Math.min(last.durationMin, settings.easy[1]) },
          "Two hard sessions were missed lately, so this week has one hard session fewer.",
        ),
      );
      setCause(last.date, {
        code: "missed-session",
        reason:
          "Two hard sessions were missed within a week, so this week has one hard session fewer.",
      });
    }
  });

  // 3. Rides ridden and ramping back: shorten what has not happened yet (section 13).
  const rampCaps = rampBackCaps(plan, counted, today);
  const shortenWeek = (week: Week): void => {
    const ridden = riddenIn(week);
    const isCurrent = today >= week.startDate && today <= plus(week.startDate, 6);
    const extraCap = isCurrent
      ? Math.floor(week.plannedMinutes * EXTRA_RIDE_TOLERANCE + 1e-9)
      : Number.POSITIVE_INFINITY;
    const rampCap = rampCaps.get(week.number) ?? Number.POSITIVE_INFINITY;
    const cap = Math.min(extraCap, rampCap);
    if (!Number.isFinite(cap)) return;
    const code: ChangeReason = rampCap < extraCap ? "ramp-back" : "extra-ride";
    const inWeek = [...working.values()].filter((s) => s.week === week.number);
    const fixed = weekMinutes(
      inWeek.filter((s) => s.kind !== "endurance" && s.kind !== "recovery" && s.kind !== "long"),
    );
    const easy = inWeek
      .filter((s) => s.kind === "endurance" || s.kind === "recovery")
      .sort((a, b) => b.durationMin - a.durationMin || (a.date < b.date ? -1 : 1));
    const long = inWeek.find((s) => s.kind === "long");
    const total = ridden + fixed + weekMinutes(easy) + (long ? long.durationMin : 0);
    let over = total - cap;
    if (over <= 0) return;
    const lead =
      code === "ramp-back"
        ? "You did not ride for a week and the hours build up again step by step"
        : "You have already ridden more than planned this week";
    const shorten = (s: SessionData, to: number): void => {
      working.set(s.date, reshape(s, { durationMin: to }, `${lead}.`));
      setCause(s.date, { code, reason: `${lead}, so this ${kindWords(s.kind)} is shorter.` });
    };
    const drop = (s: SessionData): void => {
      working.delete(s.date);
      setCause(s.date, { code, reason: `${lead}, so this ${kindWords(s.kind)} is dropped.` });
    };
    const room = new Map<IsoDate, number>();
    for (const s of easy) {
      const min = Math.min(s.durationMin, s.kind === "recovery" ? 30 : settings.easy[0]);
      room.set(s.date, s.durationMin - min);
    }
    for (const s of easy) {
      if (over <= 0) break;
      const cut = floor5(Math.min(room.get(s.date) ?? 0, Math.ceil(over / 5) * 5));
      if (cut > 0) {
        shorten(s, s.durationMin - cut);
        over -= cut;
      }
    }
    if (over > 0) {
      for (const s of [...easy].sort((a, b) => (a.date < b.date ? 1 : -1))) {
        if (over <= 0) break;
        const now = working.get(s.date);
        if (!now) continue;
        over -= now.durationMin;
        drop(now);
      }
    }
    if (over > 0 && long) {
      const min = Math.min(
        long.durationMin,
        week.type === "loading" ? settings.long[0] : RECOVERY_LONG_MIN,
      );
      const cut = floor5(Math.min(long.durationMin - min, Math.ceil(over / 5) * 5));
      if (cut > 0) {
        shorten(long, long.durationMin - cut);
        over -= cut;
      }
      if (over > 0) {
        const now = working.get(long.date);
        if (now) drop(now);
      }
    }
  };
  for (const week of plan.weeks) {
    if (plus(week.startDate, 6) >= today) shortenWeek(week);
  }

  // 4. No hard days back to back, also next to frozen sessions and hard rides (section 13, C8).
  const dates = new Set<IsoDate>([...working.keys(), ...hardRideDates]);
  for (const s of frozen) if (hardOn(s.date)) dates.add(s.date);
  const ordered = [...dates].sort();
  for (const date of ordered) {
    const next = plus(date, 1);
    if (!hardOn(date) || !hardOn(next)) continue;
    const pick = [working.get(next), working.get(date)].find(
      (s): s is SessionData =>
        s !== undefined && s.kind !== "test" && isHardSession(s.kind, s.mainSet),
    );
    if (!pick) continue;
    const note = "A hard day came right before or after it, so this one is an easy ride.";
    working.set(
      pick.date,
      reshape(
        pick,
        {
          kind: "endurance",
          durationMin: Math.min(
            pick.durationMin,
            settings.easy[1],
            pick.indoor ? INDOOR_EASY_MAX : Number.POSITIVE_INFINITY,
          ),
        },
        note,
      ),
    );
    setCause(pick.date, {
      code: hardRideDates.has(date) || hardRideDates.has(next) ? "extra-ride" : "settings-changed",
      reason:
        hardRideDates.has(date) || hardRideDates.has(next)
          ? "You rode hard the day before, so this session is an easy ride: no hard days back to back."
          : "A hard day came right before or after it, so this session is an easy ride.",
    });
  }

  return {
    sessions: [...working.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    causes,
    movedFrom,
  };
}

/**
 * Minute ceilings of the weeks after a week without rides (section 13): 80 % of the last week with rides,
 * then +8 % a week; weeks that are already planned lighter, and taper and event weeks, are left alone.
 */
export function rampBackCaps(
  plan: Plan,
  counted: readonly AdaptRide[],
  today: IsoDate,
): Map<number, number> {
  const caps = new Map<number, number>();
  const past = plan.weeks.filter((w) => plus(w.startDate, 6) < today);
  const ridden = (week: Week): number =>
    counted
      .filter((r) => r.date >= week.startDate && r.date <= plus(week.startDate, 6))
      .reduce((sum, r) => sum + r.movingMinutes, 0);
  const empty = [...past].reverse().find((w) => ridden(w) === 0);
  if (!empty) return caps;
  const base = [...past].reverse().find((w) => w.number < empty.number && ridden(w) > 0);
  if (!base) return caps;
  const baseMinutes = ridden(base);
  plan.weeks
    .filter((w) => w.number > empty.number)
    .forEach((week, k) => {
      const cap = Math.floor(baseMinutes * RAMP_BACK_FRACTION * RAMP_BACK_GROWTH ** k + 1e-9);
      const eventHere =
        plan.event !== null &&
        plan.event.date >= week.startDate &&
        plan.event.date <= plus(week.startDate, 6);
      if (week.type === "taper" || eventHere) return;
      if (cap < week.plannedMinutes) caps.set(week.number, cap);
    });
  return caps;
}
