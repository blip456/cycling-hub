/**
 * Adapters from real data (database rows, the profile, the weight log) to the structural input types of
 * `plan/export` (R11 summaries, R10 calendar file). Pure and deterministic: nothing here reads the clock
 * or the network. The database spells session kinds in snake_case (`long_ride`, `vo2max`); they are mapped
 * to the engine's `SessionKind` here, at the data boundary.
 *
 * Rules chosen where the specification is open:
 * - `dropped` sessions (removed by the engine) are not part of any summary or calendar file.
 * - A recovery week is stored with phase `recovery`, which hides the phase underneath, so a recovery week
 *   has `phase` null and `recovery` true.
 * - Stored steps are the engine's `Step[]`. A step that cannot be read is left out. Alternating work and
 *   rest steps of the same shape (3 x 10 min with 5 min rests) are shown as repeated blocks, the way the
 *   plan writes them.
 * - Heart rate zones, power zones and normalised power come from the ride stream; intervals per work
 *   block are not derived (`intervalWatts` stays null), because stream and step times do not line up.
 */
import { z } from "zod";
import {
  diffDays,
  addDays,
  brusselsDate,
  type IsoDate,
  type Weekday,
  type WeightEntry,
} from "@/features/athlete";
import { weightRateCap, type Level, type SessionKind } from "@/features/plan/engine";
import type { RidingEnvironment, TrainingPurpose } from "@/features/plan/schemas";
import type {
  ExportRide,
  ExportStep,
  MatchFlag,
  MatchInfo,
  MonthSummaryInput,
  PlannedRecord,
  PlannedSessionInput,
  Range,
  SessionStatus,
  SessionSummaryInput,
  SessionTarget,
  SummaryContext,
  SummaryGoals,
  WeekInfo,
  WeekSummaryInput,
} from "../export";
import type { PlanChangeRow, PlanData, PlanSessionRow, RideMetrics } from "./types";

// ---- session kinds ------------------------------------------------------------------------------------

const KIND_FROM_DB: Record<string, SessionKind> = {
  recovery: "recovery",
  endurance: "endurance",
  long_ride: "long",
  tempo: "tempo",
  sweet_spot: "sweet-spot",
  threshold: "threshold",
  vo2max: "vo2",
  sprint: "sprint",
  torque: "torque",
  openers: "openers",
  test: "test",
  event: "event",
};

/** The engine kind for a stored one; endurance for a value this version does not know. */
export function kindFromDb(kind: string): SessionKind {
  return KIND_FROM_DB[kind] ?? "endurance";
}

const KIND_WORDS: Record<SessionKind, string> = {
  recovery: "easy recovery",
  endurance: "steady endurance",
  long: "long steady endurance",
  tempo: "tempo",
  "sweet-spot": "sweet spot intervals",
  threshold: "threshold intervals",
  vo2: "VO2max intervals",
  sprint: "sprints",
  torque: "low-cadence torque work",
  openers: "openers",
  test: "FTP test",
  event: "event",
};

// ---- steps --------------------------------------------------------------------------------------------

const numberOrNull = z.number().nullable().catch(null);

const storedStep = z.object({
  kind: z.string().catch("work"),
  label: z.string(),
  durationSec: z.number().positive(),
  target: z
    .object({
      percentFtp: z.number().catch(0),
      minPercent: numberOrNull,
      maxPercent: numberOrNull,
      watts: z
        .object({ target: numberOrNull, min: numberOrNull, max: numberOrNull })
        .catch({ target: null, min: null, max: null }),
      powerZone: numberOrNull,
    })
    .nullable()
    .catch(null),
  heartRate: z
    .object({ zoneFrom: z.number(), zoneTo: z.number(), min: z.number(), max: numberOrNull })
    .nullable()
    .catch(null),
});

type StoredStep = z.infer<typeof storedStep>;

function roundMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

function zoneOf(step: StoredStep): number | string | null {
  const power = step.target?.powerZone ?? null;
  if (power !== null) return power;
  const hr = step.heartRate;
  return hr !== null && hr.zoneFrom !== hr.zoneTo ? `${hr.zoneFrom} to ${hr.zoneTo}` : null;
}

function toExportStep(step: StoredStep, ftp: number | null): ExportStep {
  const target = step.target;
  const percent: Range | null =
    target !== null && target.minPercent !== null
      ? { min: target.minPercent, max: target.maxPercent }
      : null;
  let watts: Range | null = null;
  if (target !== null) {
    const w = target.watts;
    if (w.min !== null) watts = { min: w.min, max: w.max };
    else if (w.target !== null) watts = { min: w.target, max: w.target };
    else if (percent !== null && ftp !== null) {
      watts = {
        min: Math.round((ftp * percent.min) / 100),
        max: percent.max === null ? null : Math.round((ftp * percent.max) / 100),
      };
    }
  }
  return {
    // The engine numbers repeats ("Threshold 1 of 2"); the summary says "2 x 12 min Threshold".
    label: step.label.replace(/\s+\d+ of \d+$/, ""),
    minutes: roundMinutes(step.durationSec),
    percentFtp: percent,
    watts,
    zone: zoneOf(step),
    bpm: step.heartRate === null ? null : { min: step.heartRate.min, max: step.heartRate.max },
  };
}

function sameShape(a: ExportStep, b: ExportStep): boolean {
  return (
    JSON.stringify({ ...a, repeats: undefined }) === JSON.stringify({ ...b, repeats: undefined })
  );
}

/** Collapses repeated blocks: `W R W R W` becomes `3 x W` and `2 x R`; a run of identical steps becomes one step. */
function collapse(steps: readonly ExportStep[]): ExportStep[] {
  const out: ExportStep[] = [];
  let i = 0;
  while (i < steps.length) {
    const work = steps[i] as ExportStep;
    const rest = steps[i + 1];
    if (rest !== undefined) {
      let works = 1;
      let rests = 0;
      let j = i + 1;
      while (j < steps.length && sameShape(steps[j] as ExportStep, rest)) {
        rests += 1;
        const nextWork = steps[j + 1];
        if (nextWork !== undefined && sameShape(nextWork, work)) {
          works += 1;
          j += 2;
        } else {
          j += 1;
          break;
        }
      }
      if (works >= 2 && !sameShape(work, rest)) {
        out.push({ ...work, repeats: works });
        if (rests > 0) out.push({ ...rest, repeats: rests });
        i = j;
        continue;
      }
    }
    const previous = out[out.length - 1];
    if (previous !== undefined && sameShape(previous, work)) {
      out[out.length - 1] = { ...previous, repeats: (previous.repeats ?? 1) + 1 };
    } else {
      out.push(work);
    }
    i += 1;
  }
  return out;
}

/** The steps stored with a session as export steps; steps that cannot be read are left out. `ftp` fills in missing watts. */
export function stepsFromJson(json: unknown, ftp: number | null): ExportStep[] {
  if (!Array.isArray(json)) return [];
  const steps: ExportStep[] = [];
  for (const raw of json as unknown[]) {
    const parsed = storedStep.safeParse(raw);
    if (parsed.success) steps.push(toExportStep(parsed.data, ftp));
  }
  return collapse(steps);
}

/** The main target of a session: the longest block (repeats included) that is work, else the longest step. */
export function mainTarget(steps: readonly ExportStep[]): SessionTarget | null {
  if (steps.length === 0) return null;
  const length = (s: ExportStep) => s.minutes * (s.repeats ?? 1);
  const isWork = (s: ExportStep) => !/warm|cool|rest|easy/i.test(s.label);
  const pool = steps.some(isWork) ? steps.filter(isWork) : steps;
  const main = pool.reduce((best, s) => (length(s) > length(best) ? s : best));
  return { zone: main.zone, watts: main.watts, bpm: main.bpm };
}

/** Time-weighted planned average in percent of FTP over all steps; null when no step has a target. */
export function plannedAveragePercent(steps: readonly ExportStep[]): number | null {
  let minutes = 0;
  let weighted = 0;
  for (const step of steps) {
    const range = step.percentFtp;
    if (range === null) continue;
    const mid = range.max === null ? range.min : (range.min + range.max) / 2;
    const length = step.minutes * (step.repeats ?? 1);
    minutes += length;
    weighted += mid * length;
  }
  return minutes === 0 ? null : weighted / minutes;
}

// ---- sessions -----------------------------------------------------------------------------------------

const STATUSES: readonly SessionStatus[] = ["planned", "done", "missed", "skipped"];

function statusOf(status: string): SessionStatus | null {
  return STATUSES.find((s) => s === status) ?? null;
}

/** A stored session as the export input; null for a dropped session or one with an unknown status. */
export function sessionFromRow(
  row: PlanSessionRow,
  ftp: number | null,
): PlannedSessionInput | null {
  const status = statusOf(row.status);
  if (status === null) return null;
  const kind = kindFromDb(row.kind);
  const steps = stepsFromJson(row.steps, ftp);
  return {
    id: row.id,
    date: row.session_date,
    title: row.title,
    minutes: row.duration_min,
    status,
    hard: row.quality_min > 0,
    description: KIND_WORDS[kind],
    reason: row.reason.trim() === "" ? null : row.reason,
    target: mainTarget(steps),
    steps,
  };
}

/** Where a plan week sits: number, plan length and phase (null in a recovery week, see the file header). */
export function weekInfoFromRow(
  row: Pick<PlanSessionRow, "week_number" | "phase">,
  weeks: number,
): WeekInfo {
  const recovery = row.phase === "recovery";
  return { number: row.week_number, of: weeks, phase: recovery ? null : row.phase, recovery };
}

// ---- rides --------------------------------------------------------------------------------------------

/** The columns of a ride row the summaries read (a subset of `Ride` in `features/rides/api`). */
export type RideRow = {
  id: string;
  start_local: string;
  distance_m: number;
  moving_time_s: number;
  elevation_m: number;
  average_watts: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
};

/** The Brussels calendar date of a ride (`start_local` is local time, `YYYY-MM-DDTHH:mm:ss`). */
export function rideDate(row: Pick<RideRow, "start_local">): IsoDate {
  return row.start_local.slice(0, 10);
}

function positive(value: number | null): number | null {
  return value !== null && value > 0 ? value : null;
}

/** A ride row and its stream results as an export ride. The ride's name is left out on purpose (R11-PO4). */
export function rideFromRow(row: RideRow, metrics: RideMetrics | null): ExportRide {
  const minutes = row.moving_time_s / 60;
  const km = row.distance_m / 1000;
  return {
    id: row.id,
    date: rideDate(row),
    movingMinutes: minutes > 0 ? minutes : null,
    distanceKm: km > 0 ? km : null,
    climbingM: row.elevation_m > 0 ? row.elevation_m : null,
    avgSpeedKmh:
      row.moving_time_s > 0 && row.distance_m > 0 ? (km / row.moving_time_s) * 3600 : null,
    avgPowerW: positive(row.average_watts),
    normalizedPowerW: metrics?.normalizedPowerW ?? null,
    avgHr: positive(row.average_heartrate),
    maxHr: positive(row.max_heartrate),
    powerZoneMinutes: metrics?.powerZoneMinutes ?? null,
    hrZoneMinutes: metrics?.hrZoneMinutes ?? null,
    intervalWatts: null,
  };
}

/** Engine rules section 11: short below 0.85 of the planned time; easier below 0.80 and harder above 1.25 of the planned power. */
export function matchInfo(
  row: Pick<PlanSessionRow, "match_source">,
  session: PlannedSessionInput,
  ride: ExportRide,
  ftp: number | null,
): MatchInfo {
  const flags: MatchFlag[] = [];
  let shortBy: number | null = null;
  if (
    ride.movingMinutes !== null &&
    session.minutes > 0 &&
    ride.movingMinutes / session.minutes < 0.85
  ) {
    flags.push("short");
    shortBy = Math.round(session.minutes - ride.movingMinutes);
  }
  const planned = plannedAveragePercent(session.steps);
  if (ftp !== null && planned !== null && ride.avgPowerW !== null) {
    const ratio = ride.avgPowerW / ftp / (planned / 100);
    if (ratio < 0.8) flags.push("easier");
    else if (ratio > 1.25) flags.push("harder");
  }
  return {
    by: row.match_source === "manual" ? "manual" : "automatic",
    flags,
    shortByMinutes: shortBy,
  };
}

// ---- profile and weight -------------------------------------------------------------------------------

/** What the summaries read from the profile. */
export type ProfileFacts = {
  trainingPurposes: readonly TrainingPurpose[];
  level: Level | null;
  weeklyHours: number | null;
  ridingEnvironment: RidingEnvironment | null;
  availableDays: readonly Weekday[];
  eventName: string | null;
  eventDate: IsoDate | null;
  goal: string | null;
};

const PURPOSE_WORDS: Record<TrainingPurpose, string> = {
  muscle_building: "muscle building",
  weight_loss: "weight loss",
  endurance: "endurance",
  speed: "speed",
};

const ENVIRONMENT_WORDS: Record<RidingEnvironment, NonNullable<SummaryGoals["environment"]>> = {
  indoor: "indoors",
  outdoor: "outdoors",
  both: "both",
};

/** The profile and the active weight goal as the goals of a summary. */
export function goalsFrom(
  profile: ProfileFacts,
  weightGoal: { targetKg: number; targetDate: IsoDate } | null,
): SummaryGoals {
  return {
    purposes: profile.trainingPurposes.map((p) => PURPOSE_WORDS[p]),
    level: profile.level,
    targetWeightKg: weightGoal?.targetKg ?? null,
    targetWeightDate: weightGoal?.targetDate ?? null,
    eventName: profile.eventName,
    eventDate: profile.eventDate,
    hoursPerWeek: profile.weeklyHours,
    environment:
      profile.ridingEnvironment === null ? null : ENVIRONMENT_WORDS[profile.ridingEnvironment],
    availableDays: profile.availableDays,
    goalText: profile.goal,
  };
}

/**
 * The context of a summary. The weekly cap is the plan's default cap (0.5 % of the latest weigh-in), so
 * the summary can say how the target pace compares with it; null without a weigh-in.
 */
export function contextFrom(input: {
  madeAt: Date;
  ftp: number | null;
  lthr: number | null;
  maxHr: number | null;
  goals: SummaryGoals | null;
  weight: readonly WeightEntry[];
}): SummaryContext {
  const latest = [...input.weight].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return {
    madeAt: input.madeAt,
    ftp: input.ftp,
    lthr: input.lthr,
    maxHr: input.maxHr,
    goals: input.goals,
    weight: input.weight,
    weightRateCapKgPerWeek:
      latest === undefined ? null : Math.round(weightRateCap(latest.kg) * 100) / 100,
  };
}

// ---- plan changes -------------------------------------------------------------------------------------

/** The change-log lines of a date range ("Plan updated: ..."), undone changes left out. */
export function changeLines(
  changes: readonly PlanChangeRow[],
  from: IsoDate,
  to: IsoDate,
): string[] {
  return changes
    .filter((c) => c.undone_at === null)
    .filter((c) => {
      const day = brusselsDate(new Date(c.created_at));
      return day !== null && day >= from && day <= to;
    })
    .map((c) => c.reason.trim())
    .filter((line) => line !== "");
}

// ---- building the summary inputs ------------------------------------------------------------------------

/** The Monday of the week that contains `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  const index = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -index) ?? date;
}

type Lookups = {
  plan: PlanData;
  ftp: number | null;
  rides: ReadonlyMap<string, ExportRide>;
};

function recordOf(row: PlanSessionRow, lookups: Lookups): PlannedRecord | null {
  const session = sessionFromRow(row, lookups.ftp);
  if (session === null) return null;
  const ride = row.activity_id === null ? null : (lookups.rides.get(row.activity_id) ?? null);
  return {
    session,
    ride,
    match: ride === null ? null : matchInfo(row, session, ride, lookups.ftp),
  };
}

function weeksOf(plan: PlanData): number {
  return plan.plan?.weeks ?? 12;
}

/** The plan week (1-based) for a Monday, by the plan start date; null before the plan or without one. */
export function planWeekAt(plan: PlanData, monday: IsoDate): number | null {
  if (plan.plan === null) return null;
  const days = diffDays(plan.plan.start_date, monday);
  if (days === null || days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  return week <= weeksOf(plan) ? week : null;
}

function rowsOfWeek(plan: PlanData, week: number): PlanSessionRow[] {
  return plan.sessions
    .filter((s) => s.week_number === week)
    .sort((a, b) =>
      a.session_date === b.session_date
        ? a.id.localeCompare(b.id)
        : a.session_date < b.session_date
          ? -1
          : 1,
    );
}

function weekInfoOf(plan: PlanData, week: number): WeekInfo {
  const first = rowsOfWeek(plan, week)[0];
  return weekInfoFromRow({ week_number: week, phase: first?.phase ?? "" }, weeksOf(plan));
}

/** Input of a session summary; null when the session is not in the plan (or dropped). */
export function sessionInput(row: PlanSessionRow, lookups: Lookups): SessionSummaryInput | null {
  const record = recordOf(row, lookups);
  if (record === null) return null;
  return {
    session: record.session,
    ride: record.ride,
    match: record.match,
    week: weekInfoOf(lookups.plan, row.week_number),
  };
}

/** Input of a week summary for the week that contains `date`; works without a plan (rides only). */
export function weekInput(
  date: IsoDate,
  lookups: Lookups & { changes: readonly PlanChangeRow[] },
): WeekSummaryInput {
  const start = mondayOf(date);
  const end = addDays(start, 6) ?? start;
  const number = planWeekAt(lookups.plan, start);
  const records =
    number === null
      ? []
      : rowsOfWeek(lookups.plan, number).flatMap((row) => recordOf(row, lookups) ?? []);
  const nextNumber = number === null || number + 1 > weeksOf(lookups.plan) ? null : number + 1;
  const nextSessions =
    nextNumber === null
      ? []
      : rowsOfWeek(lookups.plan, nextNumber).flatMap(
          (row) => sessionFromRow(row, lookups.ftp) ?? [],
        );
  return {
    start,
    week: number === null ? null : weekInfoOf(lookups.plan, number),
    records,
    rides: [...lookups.rides.values()].filter((r) => r.date >= start && r.date <= end),
    next:
      nextNumber === null || nextSessions.length === 0
        ? null
        : {
            week: weekInfoOf(lookups.plan, nextNumber),
            start: addDays(start, 7) ?? start,
            sessions: nextSessions,
          },
    changes: changeLines(lookups.changes, start, end),
  };
}

/** Input of a month summary: every plan week that touches the calendar month, and the rides and changes in it. */
export function monthInput(
  year: number,
  month: number,
  lookups: Lookups & { changes: readonly PlanChangeRow[] },
): MonthSummaryInput {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last =
    addDays(
      `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`,
      -1,
    ) ?? first;
  const weeks: MonthSummaryInput["weeks"][number][] = [];
  const firstMonday = mondayOf(first);
  for (let monday = firstMonday; monday <= last; monday = addDays(monday, 7) ?? "9999-12-31") {
    const number = planWeekAt(lookups.plan, monday);
    if (number === null) continue;
    weeks.push({
      week: weekInfoOf(lookups.plan, number),
      start: monday,
      records: rowsOfWeek(lookups.plan, number).flatMap((row) => recordOf(row, lookups) ?? []),
    });
  }
  return {
    year,
    month,
    weeks,
    rides: [...lookups.rides.values()].filter((r) => r.date >= first && r.date <= last),
    changes: changeLines(lookups.changes, first, last),
  };
}
