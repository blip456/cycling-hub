/**
 * Test fixtures: the example week and month of the wireframe (R11), as input data. Numbers are the
 * wireframe's own where the rules allow it; the golden texts in the tests are the output of these inputs.
 */
import type {
  ExportRide,
  ExportStep,
  MatchInfo,
  MonthSummaryInput,
  PlannedRecord,
  PlannedSessionInput,
  SessionSummaryInput,
  SummaryContext,
  SummaryGoals,
  SummaryOptions,
  WeekSummaryInput,
} from "./types";

export const GOALS: SummaryGoals = {
  purposes: ["weight loss", "endurance"],
  level: "committed",
  targetWeightKg: 73,
  targetWeightDate: "2026-12-13",
  eventName: "Winter sportive",
  eventDate: "2026-12-12",
  hoursPerWeek: 6,
  environment: "both",
  availableDays: ["tue", "thu", "sat", "sun"],
  goalText: null,
};

export const WEEK_WEIGHT = [
  { date: "2026-09-26", kg: 75.76 },
  { date: "2026-10-24", kg: 75.2 },
];

export const MONTH_WEIGHT = [
  { date: "2026-10-01", kg: 75.7 },
  { date: "2026-10-03", kg: 75.6 },
  { date: "2026-10-06", kg: 75.6 },
  { date: "2026-10-08", kg: 75.5 },
  { date: "2026-10-10", kg: 75.5 },
  { date: "2026-10-13", kg: 75.4 },
  { date: "2026-10-15", kg: 75.4 },
  { date: "2026-10-17", kg: 75.3 },
  { date: "2026-10-20", kg: 75.2 },
  { date: "2026-10-22", kg: 75.1 },
  { date: "2026-10-24", kg: 75.1 },
  { date: "2026-10-26", kg: 75.1 },
  { date: "2026-10-27", kg: 75.1 },
  { date: "2026-10-28", kg: 75.1 },
];

/** Mon 26 Oct 2026, 07:40 in Brussels (06:40 UTC, after the clocks went back on 25 Oct). */
export const MADE_AT_WEEK = new Date(Date.UTC(2026, 9, 26, 6, 40));
/** Wed 28 Oct 2026, 10:05 in Brussels. */
export const MADE_AT_MONTH = new Date(Date.UTC(2026, 9, 28, 9, 5));

export function context(overrides: Partial<SummaryContext> = {}): SummaryContext {
  return {
    madeAt: MADE_AT_WEEK,
    ftp: 250,
    lthr: 165,
    maxHr: null,
    goals: GOALS,
    weight: WEEK_WEIGHT,
    weightRateCapKgPerWeek: 0.37,
    ...overrides,
  };
}

export const ALL_ON: SummaryOptions = {
  includeWeight: true,
  includeGoals: true,
  promptLine: "Analyse this, please.",
};
export const ALL_OFF: SummaryOptions = {
  includeWeight: false,
  includeGoals: false,
  promptLine: null,
};

export function ride(overrides: Partial<ExportRide> & Pick<ExportRide, "id" | "date">): ExportRide {
  return {
    movingMinutes: null,
    distanceKm: null,
    climbingM: null,
    avgSpeedKmh: null,
    avgPowerW: null,
    normalizedPowerW: null,
    avgHr: null,
    maxHr: null,
    powerZoneMinutes: null,
    hrZoneMinutes: null,
    intervalWatts: null,
    ...overrides,
  };
}

export function session(
  overrides: Partial<PlannedSessionInput> & Pick<PlannedSessionInput, "id" | "date" | "title">,
): PlannedSessionInput {
  return {
    minutes: 60,
    status: "planned",
    hard: false,
    description: null,
    reason: null,
    target: null,
    steps: [],
    ...overrides,
  };
}

export const AUTO_MATCH: MatchInfo = { by: "automatic", flags: [], shortByMinutes: null };

export const LONG_RIDE_STEPS: ExportStep[] = [
  {
    label: "Endurance",
    minutes: 150,
    percentFtp: { min: 56, max: 75 },
    watts: { min: 140, max: 187 },
    zone: 2,
    bpm: { min: 125, max: 142 },
  },
];

export const THRESHOLD_STEPS: ExportStep[] = [
  {
    label: "Warm-up",
    minutes: 15,
    percentFtp: { min: 50, max: 70 },
    watts: { min: 125, max: 175 },
    zone: "1 to 2",
    bpm: null,
  },
  {
    label: "Threshold",
    minutes: 10,
    repeats: 3,
    percentFtp: { min: 95, max: 105 },
    watts: { min: 238, max: 263 },
    zone: 4,
    bpm: { min: 156, max: 168 },
  },
  {
    label: "Rest",
    minutes: 5,
    repeats: 2,
    percentFtp: { min: 50, max: 50 },
    watts: { min: 125, max: 125 },
    zone: 1,
    bpm: null,
  },
  {
    label: "Cool-down",
    minutes: 10,
    percentFtp: { min: 50, max: 50 },
    watts: { min: 125, max: 125 },
    zone: 1,
    bpm: null,
  },
];

export const SAT_SESSION = session({
  id: "s-sat",
  date: "2026-10-24",
  title: "Long ride",
  minutes: 150,
  status: "done",
  description: "steady endurance",
  reason: "long easy volume for the endurance purpose.",
  target: { zone: 2, watts: { min: 140, max: 187 }, bpm: { min: 125, max: 142 } },
  steps: LONG_RIDE_STEPS,
});

export const SAT_RIDE = ride({
  id: "r-sat",
  date: "2026-10-24",
  movingMinutes: 142,
  distanceKm: 68.4,
  climbingM: 410,
  avgSpeedKmh: 28.9,
  avgPowerW: 158,
  normalizedPowerW: 171,
  avgHr: 137,
  maxHr: 158,
  powerZoneMinutes: [0, 130, 6, 0, 6, 0, 0],
  hrZoneMinutes: [8, 118, 12, 4, 0],
});

export const SESSION_INPUT: SessionSummaryInput = {
  session: SAT_SESSION,
  ride: SAT_RIDE,
  match: AUTO_MATCH,
  week: { number: 5, of: 12, phase: "build", recovery: false },
};

const TUE_SESSION = session({
  id: "s-tue",
  date: "2026-10-20",
  title: "Threshold 3 x 10 min",
  minutes: 75,
  status: "done",
  hard: true,
  target: { zone: 4, watts: { min: 228, max: 262 }, bpm: null },
  steps: THRESHOLD_STEPS,
});
const TUE_RIDE = ride({
  id: "r-tue",
  date: "2026-10-20",
  movingMinutes: 74,
  avgPowerW: 178,
  normalizedPowerW: 205,
  avgHr: 148,
  maxHr: 171,
  intervalWatts: [241, 238, 236],
  powerZoneMinutes: [18, 20, 6, 30, 0, 0, 0],
  hrZoneMinutes: [6, 22, 10, 30, 6],
});
const THU_SESSION = session({
  id: "s-thu",
  date: "2026-10-22",
  title: "Endurance",
  minutes: 60,
  status: "done",
});
const THU_RIDE = ride({
  id: "r-thu",
  date: "2026-10-22",
  movingMinutes: 58,
  avgHr: 133,
  maxHr: 149,
  hrZoneMinutes: [6, 50, 2, 0, 0],
});
const SUN_SESSION = session({
  id: "s-sun",
  date: "2026-10-25",
  title: "Recovery",
  minutes: 45,
  status: "missed",
});

export const WEEK_RECORDS: PlannedRecord[] = [
  { session: TUE_SESSION, ride: TUE_RIDE, match: AUTO_MATCH },
  { session: THU_SESSION, ride: THU_RIDE, match: AUTO_MATCH },
  { session: SAT_SESSION, ride: SAT_RIDE, match: AUTO_MATCH },
  { session: SUN_SESSION, ride: null, match: null },
];

export const WEEK_INPUT: WeekSummaryInput = {
  start: "2026-10-19",
  week: { number: 5, of: 12, phase: "build", recovery: false },
  records: WEEK_RECORDS,
  rides: [SAT_RIDE, TUE_RIDE, THU_RIDE],
  next: {
    week: { number: 6, of: 12, phase: "build", recovery: false },
    start: "2026-10-26",
    sessions: [
      session({ id: "n-tue", date: "2026-10-27", title: "Sweet spot 2 x 15 min", minutes: 75 }),
      session({ id: "n-thu", date: "2026-10-29", title: "Endurance", minutes: 60 }),
      session({ id: "n-sat", date: "2026-10-31", title: "Long ride", minutes: 150 }),
      session({ id: "n-sun", date: "2026-11-01", title: "Recovery", minutes: 45 }),
    ],
  },
  changes: [],
};

function done(
  id: string,
  date: string,
  minutes: number,
  rideMinutes: number,
  hard = false,
): PlannedRecord {
  return {
    session: session({ id: `s-${id}`, date, title: "Session", minutes, status: "done", hard }),
    ride: ride({ id: `r-${id}`, date, movingMinutes: rideMinutes }),
    match: AUTO_MATCH,
  };
}

/** A month whose weekly sums follow the wireframe (R11c): 15 sessions planned, 12 done, 2 extra rides. */
const MONTH_WEEKS: MonthSummaryInput["weeks"] = [
  {
    week: { number: 2, of: 12, phase: "base", recovery: false },
    start: "2026-09-28",
    records: [done("w2a", "2026-10-01", 75, 70), done("w2b", "2026-10-03", 120, 120)],
  },
  {
    week: { number: 3, of: 12, phase: "base", recovery: false },
    start: "2026-10-05",
    records: [
      done("w3a", "2026-10-06", 75, 72),
      done("w3b", "2026-10-08", 60, 58),
      done("w3c", "2026-10-10", 90, 90),
      done("w3d", "2026-10-11", 75, 70),
    ],
  },
  {
    week: { number: 4, of: 12, phase: "base", recovery: true },
    start: "2026-10-12",
    records: [
      done("w4a", "2026-10-13", 60, 60),
      {
        session: session({
          id: "s-w4b",
          date: "2026-10-15",
          title: "Sweet spot",
          minutes: 75,
          status: "done",
          hard: true,
        }),
        ride: ride({ id: "r-w4b", date: "2026-10-15", movingMinutes: 55 }),
        match: { by: "automatic", flags: ["short"], shortByMinutes: 4 },
      },
      done("w4c", "2026-10-17", 90, 70),
      {
        session: session({
          id: "s-w4d",
          date: "2026-10-18",
          title: "Recovery",
          minutes: 15,
          status: "missed",
        }),
        ride: null,
        match: null,
      },
    ],
  },
  {
    week: { number: 5, of: 12, phase: "build", recovery: false },
    start: "2026-10-19",
    records: WEEK_RECORDS,
  },
  {
    week: { number: 6, of: 12, phase: "build", recovery: false },
    start: "2026-10-26",
    records: [
      {
        session: session({
          id: "s-w6a",
          date: "2026-10-27",
          title: "Sweet spot",
          minutes: 75,
          status: "missed",
          hard: true,
        }),
        ride: null,
        match: null,
      },
      {
        session: session({ id: "s-w6b", date: "2026-10-29", title: "Endurance", minutes: 60 }),
        ride: null,
        match: null,
      },
    ],
  },
];

const EXTRA_RIDES = [
  ride({
    id: "x1",
    date: "2026-10-04",
    movingMinutes: 30,
    distanceKm: 10.2,
    climbingM: 40,
    avgPowerW: 120,
    powerZoneMinutes: [30, 0, 0, 0, 0, 0, 0],
  }),
  ride({
    id: "x2",
    date: "2026-10-14",
    movingMinutes: 40,
    distanceKm: 14.1,
    climbingM: 60,
    avgHr: 128,
    hrZoneMinutes: [10, 30, 0, 0, 0],
  }),
];

export const MONTH_INPUT: MonthSummaryInput = {
  year: 2026,
  month: 10,
  weeks: MONTH_WEEKS,
  rides: [
    ...MONTH_WEEKS.flatMap((w) => w.records.flatMap((r) => (r.ride === null ? [] : [r.ride]))),
    ...EXTRA_RIDES,
  ],
  changes: [],
};
