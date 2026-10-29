/**
 * Every number of the rule set in one place (docs/plan/engine-rules.md, sections 3, 5, 7 and 16).
 * Change a number here and bump `ENGINE_VERSION`.
 */
import type { EventDuration, Level, Phase, Purpose, SessionKind } from "./types";

export const PLAN_WEEKS = 12;
export const START_FRACTION = 0.75;
export const START_FROM_HISTORY = { factor: 1.1, minFraction: 0.6, maxFraction: 0.9 };
export const LOADING_GROWTH = 1.08;
export const HOURS_GROWTH_CAP = 1.1;
export const LOAD_GROWTH_CAP = 1.15;
export const LONG_RIDE_GROWTH_CAP = 1.1;
export const DEFAULT_RECOVERY_EVERY = 4;
export const RECOVERY_FRACTION = 0.7;
/** In a recovery week the long ride is at most this part of the previous loading week's long ride. */
export const RECOVERY_LONG_FRACTION = 0.65;
export const RECOVERY_EASY_MAX_MIN = 60;
export const RECOVERY_Q1_EXTRA_MIN = 15;
/** Shortest long ride in a recovery week, whatever the level minimum. */
export const RECOVERY_LONG_MIN = 45;
/** Minutes per ride used to get the number of rides: `round(H / 1.6)`. */
export const HOURS_PER_RIDE = 1.6;
export const QUALITY_PERCENT = 88;
export const ABOVE_THRESHOLD_PERCENT = 105;
export const TAPER_FRACTIONS = { one: [0.5], two: [0.75, 0.45] } as const;
export const MIN_EVENT_PLAN_WEEKS = 4;
export const MIN_RECOVERY_PLAN_WEEKS = 5;
export const MIN_AVAILABLE_DAYS = 2;
export const DEFAULT_WEIGHT_RATE_CAP_PERCENT = 0.5;
export const MAX_WEIGHT_RATE_CAP_PERCENT = 0.75;
export const OPENERS_MINUTES = 40;
export const TEST_MINUTES = { "twenty-minute": 70, ramp: 45 } as const;
export const DEFAULT_EVENT_DURATION: EventDuration = "3-to-6h";
/** Expected event time in minutes, shown on the event session only (not counted in the week). */
export const EVENT_MINUTES: Record<EventDuration, number> = {
  "under-3h": 150,
  "3-to-6h": 270,
  "over-6h": 420,
};

export const TAPER_WEEKS: Record<EventDuration, number> = {
  "under-3h": 1,
  "3-to-6h": 2,
  "over-6h": 2,
};

export type Range = readonly [min: number, max: number];

export type LevelSettings = {
  hours: Range;
  rides: Range;
  structuredBudget: number;
  long: Range;
  structured: Range;
  easy: Range;
  warmUp: number;
  coolDown: number;
  /** Percent of the week's minutes. */
  qualityCap: number;
  aboveThresholdCap: number;
  sprintAllowed: boolean;
  /** Weights for sharing the week's minutes (section 6). */
  longWeight: number;
  easyWeight: number;
  /** Hours gate: smallest H for this level (section 3). */
  minHoursForLevel: number;
};

export const LEVEL_SETTINGS: Record<Level, LevelSettings> = {
  amateur: {
    hours: [3, 6],
    rides: [3, 4],
    structuredBudget: 1,
    long: [90, 180],
    structured: [45, 90],
    easy: [30, 90],
    warmUp: 10,
    coolDown: 5,
    qualityCap: 0.15,
    aboveThresholdCap: 0.05,
    sprintAllowed: false,
    longWeight: 2.2,
    easyWeight: 1.2,
    minHoursForLevel: 0,
  },
  committed: {
    hours: [6, 10],
    rides: [4, 5],
    structuredBudget: 2,
    long: [120, 270],
    structured: [60, 120],
    easy: [45, 120],
    warmUp: 15,
    coolDown: 10,
    qualityCap: 0.2,
    aboveThresholdCap: 0.07,
    sprintAllowed: true,
    longWeight: 2.8,
    easyWeight: 1,
    minHoursForLevel: 6,
  },
  "semi-pro": {
    hours: [10, 16],
    rides: [5, 6],
    structuredBudget: 3,
    long: [150, 330],
    structured: [90, 150],
    easy: [45, 150],
    warmUp: 15,
    coolDown: 10,
    qualityCap: 0.25,
    aboveThresholdCap: 0.09,
    sprintAllowed: true,
    longWeight: 2.8,
    easyWeight: 1,
    minHoursForLevel: 10,
  },
};

export const Q1_WEIGHT = 1.5;
export const Q2_WEIGHT = 1.3;

/** Indoor limits (section 10), minutes. */
export const INDOOR_SESSION_MAX = { amateur: 90, committed: 120, "semi-pro": 120 } as const;
export const INDOOR_EASY_MAX = 90;
export const INDOOR_WARM_UP_EXTRA = 5;

/** Ladder of main sets: `[repeats, minutes]` (sprints: seconds) per step (section 7.3). */
export type MainSet = readonly [repeats: number, length: number];
export type LadderKind = "tempo" | "sweet-spot" | "threshold" | "vo2" | "torque" | "sprint";

export const LADDERS: Record<Level, Record<LadderKind, readonly MainSet[]>> = {
  amateur: {
    tempo: [
      [2, 10],
      [2, 15],
      [3, 10],
      [3, 12],
    ],
    "sweet-spot": [
      [2, 10],
      [2, 12],
      [2, 15],
      [3, 10],
    ],
    threshold: [
      [2, 8],
      [2, 10],
      [2, 12],
      [3, 8],
    ],
    vo2: [
      [4, 2],
      [3, 3],
      [4, 3],
    ],
    torque: [
      [3, 5],
      [4, 5],
      [4, 6],
      [3, 8],
    ],
    sprint: [],
  },
  committed: {
    tempo: [
      [2, 15],
      [3, 12],
      [3, 15],
      [3, 20],
    ],
    "sweet-spot": [
      [2, 15],
      [3, 12],
      [3, 15],
      [2, 25],
    ],
    threshold: [
      [2, 12],
      [3, 10],
      [2, 20],
      [3, 12],
    ],
    vo2: [
      [5, 3],
      [5, 4],
      [6, 4],
      [5, 5],
    ],
    torque: [
      [4, 6],
      [4, 8],
      [5, 8],
      [5, 10],
    ],
    sprint: [
      [6, 8],
      [6, 10],
      [8, 10],
      [8, 10],
    ],
  },
  "semi-pro": {
    tempo: [
      [3, 15],
      [3, 20],
      [2, 30],
      [3, 25],
    ],
    "sweet-spot": [
      [3, 15],
      [3, 20],
      [4, 15],
      [3, 25],
    ],
    threshold: [
      [3, 12],
      [3, 15],
      [4, 12],
      [3, 20],
    ],
    vo2: [
      [5, 4],
      [6, 4],
      [5, 5],
      [6, 5],
    ],
    torque: [
      [4, 8],
      [5, 8],
      [5, 10],
      [6, 10],
    ],
    sprint: [
      [8, 10],
      [10, 10],
      [8, 15],
      [10, 15],
    ],
  },
};

/** Rest between repeats in minutes: 5 for tempo, sweet spot, threshold and torque; VO2 as long as the work. */
export const REST_MINUTES = 5;
export const VO2_MIN_REST_MINUTES = 2;
export const SPRINT_CYCLE_MINUTES = 3;

/** Q1 and Q2 per purpose and phase (section 8). `null`: plain endurance. */
export type PhaseMix = Record<Exclude<Phase, "taper">, SessionKind | null>;
export const PURPOSE_MIX: Record<Purpose, { q1: PhaseMix; q2: PhaseMix }> = {
  endurance: {
    q1: { base: "tempo", build: "sweet-spot", peak: "threshold" },
    q2: { base: "sweet-spot", build: "threshold", peak: "sweet-spot" },
  },
  speed: {
    q1: { base: "sweet-spot", build: "vo2", peak: "vo2" },
    q2: { base: "tempo", build: "threshold", peak: "sprint" },
  },
  "muscle-building": {
    q1: { base: "torque", build: "torque", peak: "torque" },
    q2: { base: "tempo", build: "sweet-spot", peak: "threshold" },
  },
  "weight-loss": {
    q1: { base: "tempo", build: "sweet-spot", peak: "sweet-spot" },
    q2: { base: null, build: null, peak: null },
  },
};

/** Amateur Q1 follows the secondary purpose in these weeks (3rd loading week of each block). */
export const AMATEUR_SECONDARY_WEEKS: readonly number[] = [3, 7, 11];

export const STRENGTH_NOTE =
  "Strength, 20 to 40 minutes, off the bike. Legs and core, 2 to 3 sets of 6 to 10 repetitions with a weight you can control. Choose your own exercises.";
export const STRENGTH_NOTE_LIGHT =
  "Light strength, 20 minutes, off the bike. Legs and core, 2 sets of 6 to 8 repetitions, easy. Choose your own exercises.";
