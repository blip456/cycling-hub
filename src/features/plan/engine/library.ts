/**
 * The session library (section 7): steps in percent of FTP, turned into watts and heart rate zones with
 * `powerZones`, `heartRateZones` and `zoneForValue` from the athlete code, plus load, quality minutes,
 * titles and reason lines.
 */
import {
  heartRateZones,
  powerZones,
  zoneForValue,
  type HeartRateZoneSet,
  type Zone,
} from "@/features/athlete";
import {
  ABOVE_THRESHOLD_PERCENT,
  INDOOR_WARM_UP_EXTRA,
  LADDERS,
  LEVEL_SETTINGS,
  OPENERS_MINUTES,
  QUALITY_PERCENT,
  REST_MINUTES,
  SPRINT_CYCLE_MINUTES,
  TEST_MINUTES,
  VO2_MIN_REST_MINUTES,
  type LadderKind,
  type MainSet,
} from "./constants";
import type {
  FtpTestKind,
  Level,
  Purpose,
  SessionKind,
  Step,
  StepHeartRate,
  StepKind,
  StepTarget,
  WeekType,
} from "./types";

/** What the library needs to turn percentages into numbers. */
export type StepContext = {
  ftp: number;
  /** From `heartRateZones`; null: watts only. */
  heartRate: HeartRateZoneSet | null;
  /** Indoor sessions have exact watts and a longer warm-up. */
  indoor: boolean;
};

export function stepContext(input: {
  ftp: number;
  lthr?: number | null | undefined;
  maxHr?: number | null | undefined;
  indoor: boolean;
}): StepContext {
  return {
    ftp: input.ftp,
    heartRate: heartRateZones({ lthr: input.lthr, maxHr: input.maxHr }),
    indoor: input.indoor,
  };
}

type Spec = {
  percent: number;
  min: number;
  /** Null: no upper limit. */
  max: number | null;
  hr: readonly [number, number] | null;
  cadence: string | null;
};

/** Section 7.1: target and band per type. */
const SPECS = {
  recovery: { percent: 50, min: 40, max: 55, hr: [1, 1], cadence: null },
  endurance: { percent: 65, min: 56, max: 75, hr: [2, 2], cadence: "85 to 95 rpm" },
  long: { percent: 65, min: 56, max: 75, hr: [2, 2], cadence: null },
  tempo: { percent: 83, min: 76, max: 90, hr: [3, 3], cadence: "85 to 95 rpm" },
  "sweet-spot": { percent: 91, min: 88, max: 94, hr: [3, 4], cadence: "85 to 95 rpm" },
  threshold: { percent: 100, min: 95, max: 105, hr: [4, 4], cadence: "85 to 100 rpm" },
  vo2: { percent: 112, min: 106, max: 120, hr: [5, 5], cadence: "90 to 105 rpm" },
  sprint: { percent: 150, min: 151, max: null, hr: null, cadence: null },
  torque: { percent: 78, min: 76, max: 82, hr: [3, 3], cadence: "50 to 60 rpm, seated" },
  openers: { percent: 105, min: 100, max: 110, hr: null, cadence: null },
  test: { percent: 105, min: 100, max: null, hr: null, cadence: null },
} as const satisfies Record<Exclude<SessionKind, "event">, Spec>;

const WARM_UP: Spec = { percent: 60, min: 50, max: 70, hr: [1, 2], cadence: null };
const REST: Spec = { percent: 50, min: 40, max: 55, hr: [1, 1], cadence: null };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function wattsFor(ftp: number, percent: number): number {
  return Math.round((ftp * percent) / 100);
}

function heartRateFor(
  ctx: StepContext,
  hr: readonly [number, number] | null,
): StepHeartRate | null {
  if (!hr || !ctx.heartRate) return null;
  const from = ctx.heartRate.zones[hr[0] - 1];
  const to = ctx.heartRate.zones[hr[1] - 1];
  if (!from || !to) return null;
  return {
    zoneFrom: hr[0],
    zoneTo: hr[1],
    min: from.min,
    max: to.max,
    reference: ctx.heartRate.reference,
  };
}

function makeStep(
  ctx: StepContext,
  input: {
    kind: StepKind;
    label: string;
    seconds: number;
    spec: Spec;
    /** Override the target percent of the spec (e.g. the test primer). */
    percent?: number;
    /** No fixed watts: all-out work. */
    allOut?: boolean;
    powerLeads?: boolean;
    heartRate?: boolean;
  },
): Step {
  const percent = input.percent ?? input.spec.percent;
  const zones: Zone[] | null = powerZones(ctx.ftp);
  let watts: StepTarget["watts"];
  let powerZone: number | null;
  if (input.allOut) {
    watts = {
      target: null,
      min:
        input.spec.max === null && input.spec.min > 100 ? wattsFor(ctx.ftp, input.spec.min) : null,
      max: null,
    };
    powerZone = null;
  } else {
    const target = wattsFor(ctx.ftp, percent);
    watts = ctx.indoor
      ? { target, min: target, max: target }
      : {
          target,
          min: wattsFor(ctx.ftp, input.spec.min),
          max: input.spec.max === null ? null : wattsFor(ctx.ftp, input.spec.max),
        };
    powerZone = zones ? (zoneForValue(zones, target)?.index ?? null) : null;
  }
  const withHeartRate = input.heartRate ?? true;
  return {
    kind: input.kind,
    label: input.label,
    durationSec: input.seconds,
    durationMin: round2(input.seconds / 60),
    target: {
      percentFtp: percent,
      minPercent: input.spec.min,
      maxPercent: input.spec.max,
      watts,
      powerZone,
      exact: ctx.indoor && !input.allOut,
    },
    heartRate: withHeartRate ? heartRateFor(ctx, input.spec.hr) : null,
    powerLeads: input.powerLeads ?? false,
    cadence: input.spec.cadence,
  };
}

/** Planned load of a step: `minutes / 60 x (percent / 100)^2 x 100` (section 2). */
export function stepLoad(step: Step): number {
  const pct = step.target.percentFtp / 100;
  return (step.durationSec / 3600) * pct * pct * 100;
}

export function sessionLoad(steps: readonly Step[]): number {
  return steps.reduce((sum, step) => sum + stepLoad(step), 0);
}

/** Minutes of work steps at 88 % FTP and up. */
export function qualityMinutes(steps: readonly Step[]): number {
  return steps
    .filter((s) => s.kind === "work" && s.target.percentFtp >= QUALITY_PERCENT)
    .reduce((sum, s) => sum + s.durationSec / 60, 0);
}

/** Minutes of work steps above 105 % FTP. */
export function aboveThresholdMinutes(steps: readonly Step[]): number {
  return steps
    .filter((s) => s.kind === "work" && s.target.percentFtp > ABOVE_THRESHOLD_PERCENT)
    .reduce((sum, s) => sum + s.durationSec / 60, 0);
}

export function isLadderKind(kind: SessionKind): kind is LadderKind {
  return (
    kind === "tempo" ||
    kind === "sweet-spot" ||
    kind === "threshold" ||
    kind === "vo2" ||
    kind === "torque" ||
    kind === "sprint"
  );
}

/** The ladder of main sets for a type and level (section 7.3). Empty when the type is not used. */
export function ladderFor(level: Level, kind: LadderKind): readonly MainSet[] {
  return LADDERS[level][kind];
}

/** Main set as written in the plan: "3x15", sprints "6x8s". */
export function formatMainSet(kind: SessionKind, set: MainSet): string {
  return `${set[0]}x${set[1]}${kind === "sprint" ? "s" : ""}`;
}

export type SessionSteps = {
  /** The kind can change to endurance when not even the lowest step fits the time. */
  kind: SessionKind;
  steps: Step[];
  mainSet: string | null;
  /** 0-based ladder step used; null when the type has no ladder. */
  ladderStep: number | null;
};

const SEC = 60;

function sum(steps: readonly Step[]): number {
  return steps.reduce((total, step) => total + step.durationSec, 0);
}

function fill(ctx: StepContext, seconds: number): Step[] {
  return seconds > 0
    ? [makeStep(ctx, { kind: "easy", label: "Easy endurance", seconds, spec: SPECS.endurance })]
    : [];
}

function warmUp(ctx: StepContext, minutes: number): Step {
  return makeStep(ctx, {
    kind: "warm-up",
    label: "Warm-up",
    seconds: minutes * SEC,
    spec: WARM_UP,
  });
}

function coolDown(ctx: StepContext, minutes: number): Step {
  return makeStep(ctx, {
    kind: "cool-down",
    label: "Cool-down",
    seconds: minutes * SEC,
    spec: REST,
  });
}

function restStep(ctx: StepContext, seconds: number, label = "Rest"): Step {
  return makeStep(ctx, { kind: "rest", label, seconds, spec: REST });
}

const WORK_LABEL: Record<LadderKind, string> = {
  tempo: "Tempo",
  "sweet-spot": "Sweet spot",
  threshold: "Threshold",
  vo2: "VO2 max",
  torque: "Low-cadence torque",
  sprint: "Sprint",
};

/** Structured session with repeats: warm-up, repeats with rests, easy fill, cool-down. */
function repeatsSession(
  ctx: StepContext,
  level: Level,
  kind: Exclude<LadderKind, "sprint">,
  set: MainSet,
  durationMin: number,
): Step[] | null {
  const settings = LEVEL_SETTINGS[level];
  const wu = settings.warmUp + (ctx.indoor ? INDOOR_WARM_UP_EXTRA : 0);
  const [repeats, length] = set;
  const rest = kind === "vo2" ? Math.max(VO2_MIN_REST_MINUTES, length) : REST_MINUTES;
  const used = wu + repeats * length + (repeats - 1) * rest + settings.coolDown;
  if (used > durationMin) return null;
  const steps: Step[] = [warmUp(ctx, wu)];
  for (let i = 1; i <= repeats; i += 1) {
    steps.push(
      makeStep(ctx, {
        kind: "work",
        label: `${WORK_LABEL[kind]} ${i} of ${repeats}`,
        seconds: length * SEC,
        spec: SPECS[kind],
        powerLeads: length < 3 || kind === "vo2",
      }),
    );
    if (i < repeats) steps.push(restStep(ctx, rest * SEC));
  }
  steps.push(...fill(ctx, (durationMin - used) * SEC));
  steps.push(coolDown(ctx, settings.coolDown));
  return steps;
}

/** Sprint session: warm-up, a sprint every 3 minutes, easy fill, cool-down. */
function sprintSession(
  ctx: StepContext,
  level: Level,
  set: MainSet,
  durationMin: number,
): Step[] | null {
  const settings = LEVEL_SETTINGS[level];
  const wu = settings.warmUp + (ctx.indoor ? INDOOR_WARM_UP_EXTRA : 0);
  const [repeats, seconds] = set;
  const used = wu + repeats * SPRINT_CYCLE_MINUTES + settings.coolDown;
  if (used > durationMin) return null;
  const steps: Step[] = [warmUp(ctx, wu)];
  for (let i = 1; i <= repeats; i += 1) {
    steps.push(
      makeStep(ctx, {
        kind: "work",
        label: `Sprint ${i} of ${repeats}`,
        seconds,
        spec: SPECS.sprint,
        allOut: true,
        powerLeads: true,
        heartRate: false,
      }),
      restStep(ctx, SPRINT_CYCLE_MINUTES * SEC - seconds, "Easy spinning"),
    );
  }
  steps.push(...fill(ctx, (durationMin - used) * SEC));
  steps.push(coolDown(ctx, settings.coolDown));
  return steps;
}

/** Semi-pro long ride with tempo blocks: Z2 lead-in, blocks with easy gaps, Z2 to the end. */
function longWithBlocks(ctx: StepContext, set: MainSet, durationMin: number): Step[] | null {
  const [repeats, length] = set;
  const gap = 10;
  const lead = 45;
  const used = lead + repeats * length + (repeats - 1) * gap;
  if (used + 15 > durationMin) return null;
  const steps: Step[] = [
    makeStep(ctx, {
      kind: "easy",
      label: "Steady endurance",
      seconds: lead * SEC,
      spec: SPECS.long,
    }),
  ];
  for (let i = 1; i <= repeats; i += 1) {
    steps.push(
      makeStep(ctx, {
        kind: "work",
        label: `Tempo block ${i} of ${repeats}`,
        seconds: length * SEC,
        spec: SPECS.tempo,
      }),
    );
    if (i < repeats) {
      steps.push(
        makeStep(ctx, {
          kind: "easy",
          label: "Easy between blocks",
          seconds: gap * SEC,
          spec: SPECS.long,
        }),
      );
    }
  }
  steps.push(
    makeStep(ctx, {
      kind: "easy",
      label: "Steady endurance",
      seconds: (durationMin - used) * SEC,
      spec: SPECS.long,
    }),
  );
  return steps;
}

function openersSession(ctx: StepContext, durationMin: number): Step[] {
  const wu = 15;
  const steps: Step[] = [warmUp(ctx, wu)];
  for (let i = 1; i <= 3; i += 1) {
    steps.push(
      makeStep(ctx, {
        kind: "work",
        label: `Opener ${i} of 3`,
        seconds: 60,
        spec: SPECS.openers,
        powerLeads: true,
        heartRate: false,
      }),
      restStep(ctx, 120, "Easy spinning"),
    );
  }
  const used = wu + 9 + 5;
  steps.push(...fill(ctx, Math.max(0, durationMin - used) * SEC), coolDown(ctx, 5));
  return steps;
}

function testSession(ctx: StepContext, kind: FtpTestKind): Step[] {
  if (kind === "ramp") {
    return [
      warmUp(ctx, 10),
      makeStep(ctx, {
        kind: "work",
        label: "Ramp: start at 60 % of FTP and rise about 6 % every minute until you cannot go on",
        seconds: 15 * SEC,
        spec: SPECS.test,
        percent: 100,
        allOut: true,
        powerLeads: true,
        heartRate: false,
      }),
      coolDown(ctx, 20),
    ];
  }
  return [
    warmUp(ctx, 20),
    makeStep(ctx, {
      kind: "warm-up",
      label: "Primer",
      seconds: 5 * SEC,
      spec: WARM_UP,
      percent: 110,
    }),
    restStep(ctx, 10 * SEC, "Easy spinning"),
    makeStep(ctx, {
      kind: "work",
      label: "20 minutes all-out, as even as you can",
      seconds: 20 * SEC,
      spec: SPECS.test,
      allOut: true,
      heartRate: false,
    }),
    coolDown(ctx, 15),
  ];
}

/**
 * Shortest length in minutes that holds the first step of the ladder of a structured type, rounded up
 * to 5 minutes (warm-up, repeats, rests and cool-down; indoors the warm-up is 5 minutes longer).
 * Null for types without a ladder or a first step for the level.
 */
export function minimumMinutes(input: {
  kind: SessionKind;
  level: Level;
  indoor: boolean;
}): number | null {
  if (!isLadderKind(input.kind)) return null;
  const set = ladderFor(input.level, input.kind)[0];
  if (!set) return null;
  const settings = LEVEL_SETTINGS[input.level];
  const wu = settings.warmUp + (input.indoor ? INDOOR_WARM_UP_EXTRA : 0);
  const [repeats, length] = set;
  let main: number;
  if (input.kind === "sprint") {
    main = repeats * SPRINT_CYCLE_MINUTES;
  } else {
    const rest = input.kind === "vo2" ? Math.max(VO2_MIN_REST_MINUTES, length) : REST_MINUTES;
    main = repeats * length + (repeats - 1) * rest;
  }
  return Math.ceil((wu + main + settings.coolDown) / 5) * 5;
}

/**
 * Steps of one session. `ladderStep` is the step wanted (0-based); the engine goes down the ladder until
 * the main set fits `durationMin`, and falls back to plain endurance when not even step 1 fits.
 * `longBlocks` is the tempo ladder step for a semi-pro long ride with blocks, or null for a plain one.
 */
export function sessionSteps(input: {
  kind: SessionKind;
  level: Level;
  durationMin: number;
  ladderStep?: number;
  longBlocks?: number | null;
  ftpTest?: FtpTestKind;
  context: StepContext;
}): SessionSteps {
  const { kind, level, durationMin, context: ctx } = input;
  const plain = (as: "recovery" | "endurance" | "long"): SessionSteps => ({
    kind: as,
    steps: [
      makeStep(ctx, {
        kind: "easy",
        label: { recovery: "Easy spin", endurance: "Steady endurance", long: "Steady endurance" }[
          as
        ],
        seconds: durationMin * SEC,
        spec: SPECS[as],
      }),
    ],
    mainSet: null,
    ladderStep: null,
  });
  switch (kind) {
    case "recovery":
    case "endurance":
      return plain(kind);
    case "long": {
      if (input.longBlocks !== null && input.longBlocks !== undefined) {
        const ladder = ladderFor(level, "tempo");
        const index = Math.min(input.longBlocks, ladder.length - 1);
        const set = ladder[index];
        const steps = set ? longWithBlocks(ctx, set, durationMin) : null;
        if (set && steps) {
          return { kind, steps, mainSet: formatMainSet("tempo", set), ladderStep: index };
        }
      }
      return plain("long");
    }
    case "openers":
      return {
        kind,
        steps: openersSession(ctx, Math.max(durationMin, OPENERS_MINUTES)),
        mainSet: "3x1",
        ladderStep: null,
      };
    case "test":
      return {
        kind,
        steps: testSession(ctx, input.ftpTest ?? "twenty-minute"),
        mainSet: null,
        ladderStep: null,
      };
    case "event":
      return { kind, steps: [], mainSet: null, ladderStep: null };
    default: {
      const ladder = ladderFor(level, kind);
      for (let index = Math.min(input.ladderStep ?? 0, ladder.length - 1); index >= 0; index -= 1) {
        const set = ladder[index];
        if (!set) continue;
        const steps =
          kind === "sprint"
            ? sprintSession(ctx, level, set, durationMin)
            : repeatsSession(ctx, level, kind, set, durationMin);
        if (steps) return { kind, steps, mainSet: formatMainSet(kind, set), ladderStep: index };
      }
      return plain("endurance");
    }
  }
}

/** Minutes the test takes, from the intake choice. */
export function testMinutes(kind: FtpTestKind): number {
  return TEST_MINUTES[kind];
}

/** Whole minutes of a list of steps. */
export function stepsMinutes(steps: readonly Step[]): number {
  return sum(steps) / SEC;
}

const TITLES: Record<SessionKind, string> = {
  recovery: "Recovery spin",
  endurance: "Endurance ride",
  long: "Long ride",
  tempo: "Tempo",
  "sweet-spot": "Sweet spot",
  threshold: "Threshold",
  vo2: "VO2 max",
  sprint: "Sprints",
  torque: "Low-cadence torque",
  openers: "Openers",
  test: "FTP test",
  event: "Event",
};

/** Title shown on the session, e.g. "Sweet spot 3 x 15 min". */
export function sessionTitle(input: {
  kind: SessionKind;
  mainSet: string | null;
  longBlocks?: boolean;
  ftpTest?: FtpTestKind;
  eventName?: string;
}): string {
  const base = TITLES[input.kind];
  if (input.kind === "event") return input.eventName ? `Event: ${input.eventName}` : base;
  if (input.kind === "test") {
    return input.ftpTest === "ramp" ? "FTP ramp test" : "FTP test (20 minutes)";
  }
  if (input.kind === "long") {
    return input.longBlocks && input.mainSet
      ? `Long ride with tempo blocks ${input.mainSet.replace("x", " x ")} min`
      : base;
  }
  if (!input.mainSet || input.kind === "openers") return base;
  const [repeats, length] = input.mainSet.replace("s", "").split("x");
  return `${base} ${repeats} x ${length} ${input.kind === "sprint" ? "s" : "min"}`;
}

const BASE_REASON: Record<SessionKind, string> = {
  recovery: "Gets the legs moving without adding load.",
  endurance: "Builds the aerobic base. Easy enough to talk.",
  long: "The longest ride of the week. Time in the saddle at an easy effort.",
  tempo: "Steady, firm effort that builds endurance for long rides.",
  "sweet-spot": "Hard but repeatable work just under threshold. Raises FTP efficiently.",
  threshold: "Work at FTP. Raises the power you can hold for an hour.",
  vo2: "Short hard intervals. Raises your top aerobic power.",
  sprint: "Short sprints for punch and speed. Long rests, fresh legs.",
  torque: "Big-gear work to build leg strength on the bike. Stay smooth.",
  openers: "Wakes the legs before the event. Short, not tiring.",
  test: "Measures FTP so the zones stay right.",
  event: "Your event. Nothing to follow here: ride the day you trained for.",
};

const PURPOSE_NAME: Record<Purpose, string> = {
  endurance: "endurance",
  speed: "speed",
  "muscle-building": "muscle building",
  "weight-loss": "weight loss",
};

/** Plain English reason line: the type's reason plus what is special about this week (section 7.1). */
export function sessionReason(input: {
  kind: SessionKind;
  weekType: WeekType;
  hasTest?: boolean;
  /** The purpose this hard session serves; null for plain rides. */
  purpose?: Purpose | null;
  longBlocks?: boolean;
  steppedDown?: boolean;
  /** The week is held because the weight trend falls faster than the weekly cap. */
  held?: boolean;
  indoor?: boolean;
}): string {
  const parts: string[] = [BASE_REASON[input.kind]];
  if (input.kind === "long" && input.longBlocks) {
    parts.push("Tempo blocks inside make it your third hard effort of the week.");
  }
  if (input.purpose && input.weekType === "loading") {
    parts.push(`It fits your goal: ${PURPOSE_NAME[input.purpose]}.`);
  }
  if (input.weekType === "recovery" && input.kind !== "test") {
    parts.push(
      "Recovery week: lighter on purpose, so your body absorbs the work of the last weeks.",
    );
  }
  if (input.weekType === "taper" && input.kind !== "event" && input.kind !== "openers") {
    parts.push("Taper: less volume, a little intensity, so you arrive fresh at your event.");
  }
  if (input.kind === "test" && input.hasTest) {
    parts.push("After the test, new zones apply to future sessions only.");
  }
  if (input.steppedDown) {
    parts.push(
      "The set is one step easier than the normal build, to keep the week within its limits.",
    );
  }
  if (input.held) {
    parts.push("Held steady for now: your weight trend is falling faster than the weekly cap.");
  }
  if (input.indoor && input.kind !== "event") parts.push("Indoors: ride to the exact watts.");
  return parts.join(" ");
}
