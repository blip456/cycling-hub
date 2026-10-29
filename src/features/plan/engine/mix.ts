/** Purposes and the session mix (section 8): main and secondary combination and conflict rules. */
import { AMATEUR_SECONDARY_WEEKS, LEVEL_SETTINGS, PURPOSE_MIX } from "./constants";
import type { Level, Phase, Purpose, SessionKind } from "./types";

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
  if (budget < 2) return { q1, q2: null };

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
  return { q1, q2 };
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
