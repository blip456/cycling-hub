/**
 * Structural input types for the plan summaries (P67) and the calendar file (P63).
 *
 * These are deliberately minimal and independent of the plan engine's own types and of the database
 * rows: the screens adapt real data to them (a plan session to `PlannedSessionInput`, a ride row and its
 * stream-derived zone minutes to `ExportRide`, the profile to `SummaryGoals`). Everything is plain data,
 * so the functions in this folder stay pure and deterministic.
 *
 * Conventions: dates are `YYYY-MM-DD` Brussels calendar dates, durations are minutes, power is watts,
 * heart rate is bpm, distance is km, weight is kg (P6). `null` means "not known"; the text output then
 * leaves the value out or says plainly that the data is missing.
 */
import type { IsoDate, Weekday, WeightEntry } from "@/features/athlete";

export type { IsoDate, Weekday, WeightEntry };

/** An inclusive range. `max` null means "and up" (the top zone). */
export type Range = { min: number; max: number | null };

/** One step of a planned session. Repeated blocks use `repeats` (3 x 10 min threshold: `minutes` 10, `repeats` 3). */
export type ExportStep = {
  /** "Warm-up", "Threshold", "Rest", "Endurance", "Cool-down". */
  label: string;
  /** Minutes of one repeat. */
  minutes: number;
  /** Number of repeats, 1 when omitted. */
  repeats?: number | undefined;
  percentFtp: Range | null;
  watts: Range | null;
  /** Power zone number, or text such as "3 to 4" for a step that spans two zones. */
  zone: number | string | null;
  bpm: Range | null;
};

/** The main target of a session, for the one-line "Planned" text. */
export type SessionTarget = {
  zone: number | string | null;
  watts: Range | null;
  bpm: Range | null;
};

/** `planned` is still to do (today or later), `skipped` was dropped on purpose by the PO. */
export type SessionStatus = "planned" | "done" | "missed" | "skipped";

/** A planned session, as the plan stores it. */
export type PlannedSessionInput = {
  /** Stable id; the calendar file derives the event UID from it, so it must never change. */
  id: string;
  date: IsoDate;
  /** Name with the main set, e.g. "Threshold 3 x 10 min" or "Long ride". */
  title: string;
  /** Planned length. */
  minutes: number;
  status: SessionStatus;
  /** A quality session (88 % FTP and up in the engine's terms). Used for the month's "hard sessions" line. */
  hard: boolean;
  /** Short words for the kind, e.g. "steady endurance". Falls back to the title. */
  description: string | null;
  /** The engine's reason line. */
  reason: string | null;
  target: SessionTarget | null;
  steps: readonly ExportStep[];
};

/** A ride. Its name is deliberately not part of the input: summaries leave ride names out (R11-PO4). */
export type ExportRide = {
  id: string;
  date: IsoDate;
  movingMinutes: number | null;
  distanceKm: number | null;
  climbingM: number | null;
  avgSpeedKmh: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  avgHr: number | null;
  maxHr: number | null;
  /** Minutes per power zone, index 0 is Z1. Null when the ride has no power stream. */
  powerZoneMinutes: readonly number[] | null;
  /** Minutes per heart rate zone, index 0 is Z1. Null when the ride has no heart rate stream. */
  hrZoneMinutes: readonly number[] | null;
  /** Average power of each work interval, in order. Null when not known. */
  intervalWatts: readonly number[] | null;
};

export type MatchFlag = "short" | "easier" | "harder";

/** How a ride was matched to a session. */
export type MatchInfo = {
  by: "automatic" | "manual";
  flags: readonly MatchFlag[];
  /** For a short session: how many minutes short of the target. */
  shortByMinutes: number | null;
};

/** A planned session with what came of it. `ride` is null for missed, skipped and still-to-do sessions. */
export type PlannedRecord = {
  session: PlannedSessionInput;
  ride: ExportRide | null;
  match: MatchInfo | null;
};

/** Where a week sits in the plan. */
export type WeekInfo = {
  number: number;
  /** Total weeks of the plan. */
  of: number | null;
  phase: string | null;
  recovery: boolean;
};

/** The profile's goals (R11: purposes in order, level, target, event, hours, days). */
export type SummaryGoals = {
  /** Purposes in rank order, e.g. ["weight loss", "endurance"]. */
  purposes: readonly string[];
  level: string | null;
  targetWeightKg: number | null;
  targetWeightDate: IsoDate | null;
  eventName: string | null;
  eventDate: IsoDate | null;
  hoursPerWeek: number | null;
  environment: "indoors" | "outdoors" | "both" | null;
  availableDays: readonly Weekday[];
  /** The profile's free-text goal, in the PO's words. */
  goalText: string | null;
};

/** What every summary needs besides the training data. */
export type SummaryContext = {
  /** The moment the summary is made (printed in Brussels time, and decides what "today" is). */
  madeAt: Date;
  ftp: number | null;
  lthr: number | null;
  maxHr: number | null;
  goals: SummaryGoals | null;
  /** All weigh-ins; the summary picks what it needs. */
  weight: readonly WeightEntry[];
  /** The plan's weight loss cap in kg a week, shown next to the target pace. */
  weightRateCapKgPerWeek: number | null;
};

/** The three switches of R11 and the optional instruction line. */
export type SummaryOptions = {
  includeWeight: boolean;
  includeGoals: boolean;
  /** The instruction line at the top; null or blank leaves it out. */
  promptLine: string | null;
};

export type SessionSummaryInput = {
  /** Null for a ride that is not part of the plan. */
  session: PlannedSessionInput | null;
  ride: ExportRide | null;
  match: MatchInfo | null;
  week: WeekInfo | null;
};

export type WeekSummaryInput = {
  /** The Monday of the week. */
  start: IsoDate;
  /** Null when the week is not part of a plan. */
  week: WeekInfo | null;
  records: readonly PlannedRecord[];
  /** Every ride of the week, matched or not. */
  rides: readonly ExportRide[];
  /** Next week, for the "Coming week" block. */
  next: { week: WeekInfo; start: IsoDate; sessions: readonly PlannedSessionInput[] } | null;
  /** Plan changes in this week with their reasons ("Plan updated" notices). */
  changes: readonly string[];
};

export type MonthWeekInput = {
  week: WeekInfo;
  /** The Monday of the plan week. */
  start: IsoDate;
  /** All sessions of the plan week; the summary keeps the ones inside the month. */
  records: readonly PlannedRecord[];
};

export type MonthSummaryInput = {
  year: number;
  /** 1 to 12. A calendar month, not a plan month (R11-PO5). */
  month: number;
  weeks: readonly MonthWeekInput[];
  /** Every ride of the month, matched or not. */
  rides: readonly ExportRide[];
  changes: readonly string[];
};
