/**
 * Ride feedback: how well the plan works for the rides that came in. Pure and deterministic, like the rest of
 * the adaptation: it compares the finished structured sessions and the finished loading weeks with what the
 * plan asked for, and answers in short plain sentences ("signals") plus one adjustment for the engine.
 *
 * What it can see: a ridden session's moving time and average power (no streams). So:
 * - Time is reliable: a session ridden for under 80 % of its planned minutes was cut short.
 * - Power is only reliable indoors. Outdoors an average includes freewheeling, so a low average says nothing.
 *   A power clearly above the plan is believable anywhere (freewheeling can only lower an average).
 *
 * The one adjustment (`struggledStructured`): a structured session that was ridden but cut short repeats its
 * ladder step, the same way a missed session does. Everything else is a signal for the PO to read, because a
 * ride alone does not tell whether the plan or the day was the problem.
 */
import type { Plan, SessionKind } from "../engine";
import { STRUCTURED_KINDS } from "../engine";
import { plannedPercentFtp } from "./match";
import type { AdaptRide, StoredSession } from "./types";

/** A ridden structured session below this share of its planned time was cut short. */
export const CUT_SHORT_BELOW = 0.8;
/** Indoors, an average below this share of the planned average is under target. */
export const UNDER_TARGET_BELOW = 0.9;
/** An average at or above this share of the planned average (full time) is over target. */
export const OVER_TARGET_FROM = 1.1;
/** A loading week is judged on its hours: under this share is too much plan, over the other is too little. */
export const WEEK_LOW = 0.8;
export const WEEK_HIGH = 1.15;
/** How many of the latest sessions of a type are looked at, and how many of them make a pattern. */
export const KIND_WINDOW = 3;
export const KIND_PATTERN = 2;
/** Work at this share of FTP and up counts as quality work (same as the engine's quality minutes). */
const QUALITY_PERCENT = 88;

export type SessionVerdict = "on-target" | "cut-short" | "under-target" | "over-target";

export type SessionEffect = {
  date: string;
  week: number;
  kind: SessionKind;
  /** Moving time divided by planned minutes. */
  timeRatio: number;
  /** Average power divided by the planned average; null when not measurable (no power, or no steps). */
  powerRatio: number | null;
  verdict: SessionVerdict;
};

export type WeekEffect = {
  week: number;
  plannedMinutes: number;
  riddenMinutes: number;
  /** Planned minutes of quality work, and what was ridden of it (a cut-short session counts in proportion). */
  qualityPlanned: number;
  qualityDone: number;
};

export type SignalTone = "good" | "watch" | "neutral";

export type SignalCode =
  | "not-enough-data"
  | "kind-on-target"
  | "kind-too-long"
  | "kind-too-hard"
  | "kind-too-light"
  | "weeks-on-plan"
  | "weeks-too-much"
  | "weeks-too-little"
  | "quality-delivered"
  | "quality-short"
  | "many-missed";

/** One plain sentence about how the plan is working, with the tone to show it in. */
export type Signal = { code: SignalCode; tone: SignalTone; text: string; kind?: SessionKind };

export type EffectivenessReport = {
  sessions: SessionEffect[];
  weeks: WeekEffect[];
  signals: Signal[];
};

export type EffectivenessInput = {
  plan: Plan;
  /** The stored sessions with their statuses and matches. */
  sessions: readonly StoredSession[];
  rides: readonly AdaptRide[];
  ftp: number | null;
  today: string;
};

const KIND_WORDS: Record<string, string> = {
  tempo: "tempo",
  "sweet-spot": "sweet spot",
  threshold: "threshold",
  vo2: "VO2 max",
  sprint: "sprint",
  torque: "low-cadence torque",
};

function words(kind: SessionKind): string {
  return KIND_WORDS[kind] ?? kind;
}

function percent(ratio: number): string {
  return `${String(Math.round(ratio * 100))} %`;
}

function qualityMinutes(session: Pick<StoredSession, "steps">): number {
  return session.steps
    .filter((s) => s.kind === "work" && s.target.percentFtp >= QUALITY_PERCENT)
    .reduce((sum, s) => sum + s.durationMin, 0);
}

/** Verdict of one ridden session. */
function verdictOf(timeRatio: number, powerRatio: number | null, indoor: boolean): SessionVerdict {
  if (timeRatio < CUT_SHORT_BELOW) return "cut-short";
  if (powerRatio !== null && indoor && powerRatio < UNDER_TARGET_BELOW) return "under-target";
  if (powerRatio !== null && powerRatio >= OVER_TARGET_FROM && timeRatio >= 0.9)
    return "over-target";
  return "on-target";
}

/** The ridden structured sessions in the past, judged one by one. The FTP test is not judged. */
export function sessionEffects(input: EffectivenessInput): SessionEffect[] {
  const ridesById = new Map(input.rides.map((r) => [r.id, r]));
  const effects: SessionEffect[] = [];
  for (const s of input.sessions) {
    if (s.status !== "done" || s.activityId === null || s.date >= input.today) continue;
    if (!STRUCTURED_KINDS.includes(s.kind) || s.kind === "test" || s.durationMin <= 0) continue;
    const ride = ridesById.get(s.activityId);
    if (!ride) continue;
    const timeRatio = ride.movingMinutes / s.durationMin;
    const plannedWatts = input.ftp === null ? 0 : (plannedPercentFtp(s) / 100) * input.ftp;
    const powerRatio =
      ride.avgPowerW !== null && plannedWatts > 0 ? ride.avgPowerW / plannedWatts : null;
    effects.push({
      date: s.date,
      week: s.week,
      kind: s.kind,
      timeRatio,
      powerRatio,
      verdict: verdictOf(timeRatio, powerRatio, s.indoor),
    });
  }
  return effects.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The adjustment for the engine: structured sessions that were ridden but cut short, as the week and kind
 * whose ladder step must repeat. One entry per week and kind.
 */
export function struggledStructured(
  input: EffectivenessInput,
): { week: number; kind: SessionKind }[] {
  const seen = new Set<string>();
  const list: { week: number; kind: SessionKind }[] = [];
  for (const effect of sessionEffects(input)) {
    if (effect.verdict !== "cut-short") continue;
    const key = `${String(effect.week)}:${effect.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ week: effect.week, kind: effect.kind });
  }
  return list.sort((a, b) => a.week - b.week || (a.kind < b.kind ? -1 : 1));
}

/** The finished loading weeks (their Sunday is before today), with planned and ridden hours and quality. */
export function weekEffects(
  input: EffectivenessInput,
  effects: readonly SessionEffect[],
): WeekEffect[] {
  const ridesById = new Map(input.rides.map((r) => [r.id, r]));
  const result: WeekEffect[] = [];
  for (const week of input.plan.weeks) {
    if (week.type !== "loading" || week.plannedMinutes <= 0) continue;
    const sessions = input.sessions.filter((s) => s.week === week.number);
    if (sessions.length === 0) continue;
    const last = sessions.reduce((max, s) => (s.date > max ? s.date : max), week.startDate);
    // A week is finished when its last planned day is behind us.
    if (last >= input.today) continue;
    let ridden = 0;
    let qualityDone = 0;
    for (const s of sessions) {
      if (s.status !== "done" || s.activityId === null) continue;
      const ride = ridesById.get(s.activityId);
      if (!ride) continue;
      ridden += ride.movingMinutes;
      const effect = effects.find((e) => e.date === s.date);
      if (effect) qualityDone += qualityMinutes(s) * Math.min(1, effect.timeRatio);
    }
    // A week without any ride says nothing about the plan (a holiday, an illness): it is left out.
    if (ridden === 0) continue;
    result.push({
      week: week.number,
      plannedMinutes: week.plannedMinutes,
      riddenMinutes: Math.round(ridden),
      qualityPlanned: Math.round(week.qualityMinutes),
      qualityDone: Math.round(qualityDone),
    });
  }
  return result;
}

function kindSignals(effects: readonly SessionEffect[]): Signal[] {
  const signals: Signal[] = [];
  const kinds = [...new Set(effects.map((e) => e.kind))];
  for (const kind of kinds) {
    const latest = effects.filter((e) => e.kind === kind).slice(-KIND_WINDOW);
    if (latest.length < KIND_PATTERN) continue;
    const count = (verdict: SessionVerdict): number =>
      latest.filter((e) => e.verdict === verdict).length;
    const average = (pick: (e: SessionEffect) => number | null): number => {
      const values = latest.map(pick).filter((v): v is number => v !== null);
      return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    };
    const name = words(kind);
    if (count("cut-short") >= KIND_PATTERN) {
      signals.push({
        code: "kind-too-long",
        tone: "watch",
        kind,
        text: `Your ${name} sessions were cut short: ${percent(average((e) => e.timeRatio))} of the planned time on average. The build of ${name} waits at its step until you finish them. If it keeps happening, the sessions may be too long for the days you have.`,
      });
    } else if (count("under-target") >= KIND_PATTERN) {
      signals.push({
        code: "kind-too-hard",
        tone: "watch",
        kind,
        text: `Your indoor ${name} sessions were ridden under the target power: ${percent(average((e) => e.powerRatio))} of the planned average. The targets may be too high. A recent FTP test would show this.`,
      });
    } else if (count("over-target") >= KIND_PATTERN) {
      signals.push({
        code: "kind-too-light",
        tone: "watch",
        kind,
        text: `Your ${name} sessions were ridden above the target power: ${percent(average((e) => e.powerRatio))} of the planned average. The plan may be too light for you, or your FTP has grown. An FTP test would show it.`,
      });
    } else if (count("on-target") === latest.length) {
      signals.push({
        code: "kind-on-target",
        tone: "good",
        kind,
        text: `Your ${name} sessions went as planned (${String(latest.length)} of ${String(latest.length)}). This part of the plan works for you.`,
      });
    }
  }
  return signals;
}

function weekSignals(weeks: readonly WeekEffect[]): Signal[] {
  const signals: Signal[] = [];
  const latest = weeks.slice(-2);
  const [a, b] = latest;
  if (a === undefined || b === undefined) return signals;
  const share = (w: WeekEffect): number => w.riddenMinutes / w.plannedMinutes;
  if (latest.every((w) => share(w) < WEEK_LOW)) {
    signals.push({
      code: "weeks-too-much",
      tone: "watch",
      text: `You rode ${percent(share(a))} and ${percent(share(b))} of the planned hours in your last two full weeks. The plan asks for more than you can ride now. Lower the hours per week with Edit plan if this is your normal week.`,
    });
  } else if (latest.every((w) => share(w) > WEEK_HIGH)) {
    signals.push({
      code: "weeks-too-little",
      tone: "watch",
      text: `You rode ${percent(share(a))} and ${percent(share(b))} of the planned hours in your last two full weeks. The plan may be too light for you. Raise the hours per week with Edit plan if you want it to follow.`,
    });
  } else if (latest.every((w) => share(w) >= WEEK_LOW && share(w) <= WEEK_HIGH)) {
    signals.push({
      code: "weeks-on-plan",
      tone: "good",
      text: `Your last two full weeks were close to the plan (${percent(share(a))} and ${percent(share(b))} of the hours). The weekly amount fits you.`,
    });
  }
  const quality = weeks.filter((w) => w.qualityPlanned > 0).slice(-2);
  if (quality.length === 2) {
    const planned = quality.reduce((s, w) => s + w.qualityPlanned, 0);
    const done = quality.reduce((s, w) => s + w.qualityDone, 0);
    if (done / planned >= 0.9) {
      signals.push({
        code: "quality-delivered",
        tone: "good",
        text: `You rode ${String(done)} of ${String(planned)} planned minutes of hard work in the last two weeks. The load is being delivered, so the plan keeps building.`,
      });
    } else if (done / planned < 0.6) {
      signals.push({
        code: "quality-short",
        tone: "watch",
        text: `You rode ${String(done)} of ${String(planned)} planned minutes of hard work in the last two weeks. Too few hard minutes arrive for the plan to build fitness. Check if the hard days fit your week.`,
      });
    }
  }
  return signals;
}

/** Many structured sessions missed or skipped in the finished part of the plan. */
function missedSignal(input: EffectivenessInput): Signal[] {
  const past = input.sessions.filter(
    (s) => s.date < input.today && STRUCTURED_KINDS.includes(s.kind) && s.kind !== "test",
  );
  const missed = past.filter((s) => s.status === "missed" || s.status === "skipped").length;
  if (past.length >= 3 && missed / past.length >= 0.4) {
    return [
      {
        code: "many-missed",
        tone: "watch",
        text: `${String(missed)} of ${String(past.length)} hard sessions were not ridden. The plan may have too many hard days for your week. Try fewer riding days for hard work, or fewer hours, with Edit plan.`,
      },
    ];
  }
  return [];
}

/** The ride feedback for the rides so far. */
export function effectiveness(input: EffectivenessInput): EffectivenessReport {
  const sessions = sessionEffects(input);
  const weeks = weekEffects(input, sessions);
  const signals = [...kindSignals(sessions), ...weekSignals(weeks), ...missedSignal(input)];
  if (signals.length === 0) {
    signals.push({
      code: "not-enough-data",
      tone: "neutral",
      text:
        sessions.length === 0
          ? "No hard session has been ridden yet. After a few rides, this shows what works and what does not."
          : "Not enough rides yet to say what works. Two or three sessions of the same type, or two full weeks, are needed.",
    });
  }
  return { sessions, weeks, signals };
}
