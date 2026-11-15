/** Purposes and the session mix (section 8): main and secondary combination and conflict rules. */
import { AMATEUR_SECONDARY_WEEKS, LEVEL_SETTINGS, PURPOSE_MIX } from "./constants";
import type { IntensityBalance, Level, Phase, Purpose, SessionKind } from "./types";

export type PurposePair = { main: Purpose; secondary: Purpose | null };

/** Rank 1 and rank 2 of the ranked list (duplicates removed). Empty: endurance (section 1). */
export function purposePair(ranked: readonly Purpose[]): PurposePair {
  const unique = ranked.filter((p, i) => ranked.indexOf(p) === i);
  return { main: unique[0] ?? "endurance", secondary: unique[1] ?? null };
}

/**
 * Hard sessions a week can hold for this level and main purpose: the level budget, one less for weight
 * loss as main purpose with a budget of 2 or 3 (committed: 1; semi-pro: 2) (section 8).
 */
export function hardBudget(level: Level, main: Purpose): number {
  const budget = LEVEL_SETTINGS[level].structuredBudget;
  return main === "weight-loss" ? Math.max(1, budget - 1) : budget;
}

export type HardSession = { kind: SessionKind; purpose: Purpose };

export type HardMix = { q1: HardSession; q2: HardSession | null };

type BlockPhase = Exclude<Phase, "taper">;

/**
 * Q1 and Q2 for a phase. Q1 follows the main purpose; with a budget of only one hard session an amateur
 * (or committed weight loss) follows the secondary purpose in weeks 3, 7 and 11. Q2 follows the secondary
 * purpose's Q1 type (weight loss as secondary: Q2 stays endurance). Taper and test weeks are handled by
 * the caller.
 */
export function hardMix(input: {
  level: Level;
  purposes: PurposePair;
  phase: BlockPhase;
  week: number;
  /** How much of the riding is hard (section 3b). Missing: base-focused, the original mix. */
  balance?: IntensityBalance;
}): HardMix {
  const { level, purposes, phase, week } = input;
  const { main, secondary } = purposes;
  const budget = hardBudget(level, main);
  const swap =
    budget === 1 &&
    secondary !== null &&
    AMATEUR_SECONDARY_WEEKS.includes(week) &&
    secondary !== main;
  const q1Purpose = swap ? secondary : main;
  const q1: HardSession = { kind: PURPOSE_MIX[q1Purpose].q1[phase] ?? "tempo", purpose: q1Purpose };
  if (budget < 2) return intensify({ q1, q2: null }, input);

  let q2: HardSession | null;
  if (main === "weight-loss") {
    q2 =
      secondary !== null
        ? { kind: PURPOSE_MIX[secondary].q1[phase] ?? "tempo", purpose: secondary }
        : { kind: "tempo", purpose: main };
  } else if (secondary === "weight-loss") {
    q2 = null;
  } else if (secondary !== null) {
    q2 = { kind: PURPOSE_MIX[secondary].q1[phase] ?? "tempo", purpose: secondary };
  } else {
    const own = PURPOSE_MIX[main].q2[phase];
    q2 = own ? { kind: own, purpose: main } : null;
  }
  if (q2?.kind === "sprint" && !LEVEL_SETTINGS[level].sprintAllowed) {
    q2 = { kind: "threshold", purpose: q2.purpose };
  }
  return intensify({ q1, q2 }, input);
}

const isTop = (kind: SessionKind): boolean => kind === "vo2" || kind === "sprint";

/**
 * The intensity balance on top of the purpose mix (section 3b). Only endurance and speed as main purpose give
 * up their Q1, and a Q2 that serves weight loss is left alone, so a purpose is never overruled where it
 * matters most. Balanced: from Build on, one VO2 session in a loading week (Q2; an amateur with only Q1 every
 * other week). High: VO2 as Q1 from the first week, and from Build on Q2 is VO2 as well (a sprint Q2 stays).
 * The taper keeps the peak session type, so it follows the same mix (`week` is 0 outside loading weeks).
 */
function intensify(
  mix: HardMix,
  input: { purposes: PurposePair; phase: BlockPhase; week: number; balance?: IntensityBalance },
): HardMix {
  const balance = input.balance ?? "base";
  if (balance === "base") return mix;
  const { q1, q2 } = mix;
  const main = input.purposes.main;
  const q1Open = main === "endurance" || main === "speed";
  const q2Open = q2 !== null && q2.purpose !== "weight-loss";
  const grown = input.phase !== "base";
  let next = mix;
  if (balance === "balanced") {
    if (!grown || isTop(q1.kind) || (q2 !== null && isTop(q2.kind))) return mix;
    if (q2 !== null && q2Open) {
      next = { q1, q2: { kind: "vo2", purpose: q2.purpose } };
    } else if (q2 === null && q1Open && input.week % 2 === 1) {
      next = { q1: { kind: "vo2", purpose: q1.purpose }, q2 };
    }
    return next;
  }
  // High.
  if (q1Open && q1.kind !== "vo2") next = { q1: { kind: "vo2", purpose: q1.purpose }, q2: next.q2 };
  if (grown && q2 !== null && q2Open && !isTop(q2.kind)) {
    next = { q1: next.q1, q2: { kind: "vo2", purpose: q2.purpose } };
  }
  return next;
}

/** True when the week template has a Q2 slot for this level and these purposes (section 6). */
export function hasSecondSlot(level: Level, purposes: PurposePair): boolean {
  return hardMix({ level, purposes, phase: "build", week: 1 }).q2 !== null;
}

/**
 * The semi-pro long ride with tempo blocks (the third hard session): Build and Peak loading weeks when
 * the main purpose is endurance or muscle building. Speed and weight loss keep a plain long ride
 * (the speed row of section 8 says "plain endurance").
 */
export function longRideHasBlocks(level: Level, main: Purpose, phase: Phase): boolean {
  return (
    level === "semi-pro" &&
    (phase === "build" || phase === "peak") &&
    (main === "endurance" || main === "muscle-building")
  );
}
