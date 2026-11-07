/**
 * Shared types of the plan engine (docs/plan/engine-rules.md). Pure data: no React, no Supabase.
 * Other parts of the app (intake form, plan pages, adaptation, calendar, summaries) build on these.
 */
import type { IsoDate, Weekday } from "@/features/athlete";

/** Bump when a rule or number changes the plan an input produces. It is part of the fingerprint. */
export const ENGINE_VERSION = "1.0.0";

/** The four purposes (P65). The intake ranks them; the engine uses the top two. */
export const PURPOSES = ["endurance", "speed", "muscle-building", "weight-loss"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const LEVELS = ["amateur", "committed", "semi-pro"] as const;
export type Level = (typeof LEVELS)[number];

/** One answer of the five level questions: 0 to 3 (section 3). */
export type LevelScore = 0 | 1 | 2 | 3;

/** L1 to L5 of section 3, each 0 to 3. */
export type LevelAnswers = {
  /** L1: how long riding regularly (under 1 year ... more than 5 years). */
  experience: LevelScore;
  /** L2: hours a week in the last 3 months (under 4 ... 12 or more). */
  weeklyHours: LevelScore;
  /** L3: how often training with intervals (never ... every week, by a plan). */
  intervals: LevelScore;
  /** L4: longest ride in the last 3 months (under 2 h ... over 5 h). */
  longestRide: LevelScore;
  /** L5: hard sessions a week handled comfortably (none ... three or more). */
  hardSessions: LevelScore;
};

export const ENVIRONMENTS = ["indoor", "outdoor", "both"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Expected event duration (intake, P66). It decides the taper length. */
export const EVENT_DURATIONS = ["under-3h", "3-to-6h", "over-6h"] as const;
export type EventDuration = (typeof EVENT_DURATIONS)[number];

export type PlanEvent = {
  name: string;
  date: IsoDate;
  /** Default when missing: "3-to-6h" (a two week taper, the safe side). */
  duration?: EventDuration;
};

export type WeightGoal = { targetKg: number; targetDate: IsoDate };

/** FTP test kind (P39). Default: the 20-minute test. */
export type FtpTestKind = "twenty-minute" | "ramp";

/** What the PO fills in on the intake (and what the profile holds). */
export type Intake = {
  /** Ranked, most important first. Only the first two are used. Empty: endurance. */
  purposes: readonly Purpose[];
  levelAnswers: LevelAnswers;
  /** Level the PO picked instead of the scored one (the intake summary lets the PO change it). */
  levelOverride?: Level;
  /** H: hours per week for a full normal week. Clamped to the level range. */
  hoursPerWeek: number;
  /** Days the PO can ride. Fewer than 2: no plan. */
  availableDays: readonly Weekday[];
  environment: Environment;
  event?: PlanEvent;
  /** Plan start. Default: the next Monday (today when it is a Monday). Rolled forward to a Monday. */
  startDate?: IsoDate;
  /** Weight on the start date (trend value). Needed for the weight loss rules. */
  weightKg?: number;
  weightGoal?: WeightGoal;
  /** Setting: weekly weight loss cap in percent of the start weight (default 0.5, at most 0.75). */
  weightRateCapPercent?: number;
  /** Setting: a recovery week every 4th (default) or every 3rd week. */
  recoveryEvery?: 3 | 4;
  ftpTest?: FtpTestKind;
};

/** The session library (section 7). "event" is the event itself (not counted in hours). */
export const SESSION_KINDS = [
  "recovery",
  "endurance",
  "long",
  "tempo",
  "sweet-spot",
  "threshold",
  "vo2",
  "sprint",
  "torque",
  "openers",
  "test",
  "event",
] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Hard sessions (section "How to read"): they count against the structured budget and the caps. */
export const STRUCTURED_KINDS: readonly SessionKind[] = [
  "tempo",
  "sweet-spot",
  "threshold",
  "vo2",
  "sprint",
  "torque",
  "test",
];

/** Hold, stalled and missed-session state the adaptation part feeds back in (sections 9, 12, 13). */
export type PlanAdjustments = {
  /** Average weekly riding hours of the last 4 weeks, when at least 2 of them have rides. */
  recentAverageHours?: number;
  /** Weeks (1-based) where the weight is falling faster than the cap: hours held, sets a step down. */
  holdWeeks?: readonly number[];
  /** Weeks where the weight is stalled: one extra easy ride of up to 45 minutes, when a day is free. */
  extraEasyRideWeeks?: readonly number[];
  /** Weeks after an overload week: hours not raised and the second hard session becomes endurance. */
  noSecondHardWeeks?: readonly number[];
  /** Structured sessions that were missed or skipped: that week does not count for the ladder step. */
  missedStructured?: readonly { week: number; kind: SessionKind }[];
};

/** Everything `buildPlan` needs. `today` is the only clock (Brussels date). */
export type PlanInput = {
  intake: Intake;
  today: IsoDate;
  /** Watts. Missing or unusable: no plan ("Plan needs a baseline"). */
  ftp: number | null;
  /** Heart rate references. Without either, sessions show watts only. */
  lthr?: number | null;
  maxHr?: number | null;
  adjustments?: PlanAdjustments;
};

export type StepKind = "warm-up" | "work" | "rest" | "easy" | "cool-down";

export type StepTarget = {
  /** Percent of FTP the step aims for (all-out sprints: 150). */
  percentFtp: number;
  minPercent: number;
  /** Null: no upper limit (all-out). */
  maxPercent: number | null;
  /** Watts from the FTP and the zone code. Indoor: min and max equal the target (exact). */
  watts: { target: number | null; min: number | null; max: number | null };
  /** Power zone (1 to 7) of the target from `powerZones`; null for all-out work. */
  powerZone: number | null;
  /** True when the target is a fixed number (indoor), false when it is a band (outdoor). */
  exact: boolean;
};

export type StepHeartRate = {
  /** Heart rate zones (1 to 5) the step covers, e.g. 3 to 4 for sweet spot. */
  zoneFrom: number;
  zoneTo: number;
  min: number;
  /** Null for the top zone. */
  max: number | null;
  reference: "lthr" | "max-hr";
};

export type Step = {
  kind: StepKind;
  label: string;
  durationSec: number;
  /** `durationSec / 60`, rounded to 2 decimals. */
  durationMin: number;
  target: StepTarget;
  /** Null without heart rate references, and for efforts too short for heart rate (sprints). */
  heartRate: StepHeartRate | null;
  /** True when heart rate lags (steps under 3 minutes, VO2): follow the power. */
  powerLeads: boolean;
  /** Cadence advice, e.g. "85 to 95 rpm"; null when free. */
  cadence: string | null;
};

export const SESSION_STATUSES = ["planned", "done", "missed", "skipped"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Which slot of the week a session fills (section 6). */
export type SessionSlot = "long" | "q1" | "q2" | "easy" | "openers" | "event";

export type PlannedSession = {
  /** One session per date, so the date identifies the session in a plan. */
  date: IsoDate;
  /** 1-based week of the plan. */
  week: number;
  slot: SessionSlot;
  kind: SessionKind;
  title: string;
  /** Total minutes. For the event: the expected duration (not counted in the week). */
  durationMin: number;
  steps: Step[];
  /** Templated plain English: why this session is here. */
  reason: string;
  indoor: boolean;
  status: SessionStatus;
  /** Planned load of the steps (section 2). 0 for the event. */
  load: number;
  /** Main set as written in the plan, e.g. "3x15" (seconds for sprints: "6x8s"); null if none. */
  mainSet: string | null;
  /** 0-based step on the ladder of this type (section 7.3); null if the kind has no ladder. */
  ladderStep: number | null;
  /** Off-bike strength note on this day (not counted in hours or load); null if none. */
  strengthNote: string | null;
};

export type Phase = "base" | "build" | "peak" | "taper";
export type WeekType = "loading" | "recovery" | "taper";

export type Week = {
  /** 1-based. */
  number: number;
  /** Monday of the week. */
  startDate: IsoDate;
  phase: Phase;
  type: WeekType;
  /** True for the FTP test week (week 12 without an event). */
  hasTest: boolean;
  /** The week's ceiling in minutes (hours are a ceiling, section 5). */
  targetMinutes: number;
  targetHours: number;
  /** Sum of the sessions without the event. Never above `targetMinutes`. */
  plannedMinutes: number;
  plannedHours: number;
  load: number;
  /** Minutes of work steps at 88 % FTP and up. */
  qualityMinutes: number;
  /** Minutes of work steps above 105 % FTP. */
  aboveThresholdMinutes: number;
  /** Hard sessions in the week (structured, long ride with blocks counts). */
  structuredCount: number;
  sessions: PlannedSession[];
};

export type NoticeCode =
  | "hours-clamped"
  | "level-gated"
  | "level-overridden"
  | "start-moved"
  | "event-start-moved"
  | "weight-capped"
  | "indoor-limit"
  | "no-heart-rate"
  | "history-start"
  | "caps-applied";

/** A plain fact about how the plan was built. Shown on the intake summary or plan overview. */
export type Notice = { code: NoticeCode; message: string; week?: number };

export type WarningCode =
  | "too-few-days"
  | "no-ftp"
  | "invalid-input"
  | "event-past"
  | "event-too-soon"
  | "event-far"
  | "weight-target-not-below"
  | "weight-date-passed"
  | "no-power-data";

/** Something the PO should look at: the plan was built differently from what was asked, or not built. */
export type Warning = { code: WarningCode; message: string };

/** Reason codes of a "Plan updated" notice (section 12). The adaptation part uses them. */
export const CHANGE_REASONS = [
  "missed-session",
  "extra-ride",
  "ramp-back",
  "new-ftp",
  "new-heart-rate-zones",
  "settings-changed",
  "weight-faster-than-cap",
  "weight-stalled",
  "days-changed",
  "event-changed",
  /** The PO edited the plan's answers (the intake questions) and saved. */
  "plan-edited",
] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

export type SessionChange = {
  date: IsoDate;
  /** What differs between the old and the new future session. */
  change: "added" | "removed" | "kind" | "minutes" | "main-set" | "day" | "targets";
  before: { kind: SessionKind; durationMin: number; mainSet: string | null } | null;
  after: { kind: SessionKind; durationMin: number; mainSet: string | null } | null;
};

/** A stored "Plan updated" notice: what changed and why. Built by the adaptation part from two plans. */
export type PlanUpdate = {
  reasons: ChangeReason[];
  changes: SessionChange[];
  message: string;
  /** Fingerprint of the plan this update replaced, for Undo. */
  previousFingerprint: string;
};

export type WeightPlanPoint = { week: number; date: IsoDate; kg: number };

/** The weight loss target and the planned line (section 9). No calories, no advice. */
export type WeightPlan = {
  startKg: number;
  targetKg: number;
  targetDate: IsoDate;
  capKgPerWeek: number;
  neededKgPerWeek: number;
  /** The rate the plan uses: the needed rate, never above the cap. */
  plannedKgPerWeek: number;
  capped: boolean;
  /** Earliest date the target is reached at the planned rate. */
  earliestDate: IsoDate;
  /** Plan week (1-based, from the start date) that contains `earliestDate`. */
  earliestWeek: number;
  /** Planned weight at the end of each plan week. */
  line: WeightPlanPoint[];
  message: string;
};

export type LevelResult = {
  score: number;
  /** Level of the score alone. */
  band: Level;
  /** Level after the hours gate. */
  gated: Level;
  /** Final level: the override, else the gated level. */
  level: Level;
};

export type Plan = {
  engineVersion: string;
  /** Result of `inputFingerprint`: equal fingerprints give equal plans. */
  fingerprint: string;
  /** "blocked": no sessions; `warnings` says why (too few days, no FTP). */
  status: "ok" | "blocked";
  level: Level;
  levelScore: number;
  /** H after clamping to the level range. */
  hoursPerWeek: number;
  purposes: { main: Purpose; secondary: Purpose | null };
  /** Monday of week 1. */
  startDate: IsoDate;
  /** Last day of the plan: the event date, else the Sunday of the last week. */
  endDate: IsoDate;
  environment: Environment;
  ftp: number | null;
  event: { name: string; date: IsoDate; duration: EventDuration; taperWeeks: number } | null;
  weeks: Week[];
  /** All sessions, ordered by date. */
  sessions: PlannedSession[];
  weight: WeightPlan | null;
  notices: Notice[];
  warnings: Warning[];
};
