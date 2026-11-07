/** Weekly hours (section 5): a ceiling in minutes for every week, rounded down to 5 minutes. */
import {
  HOURS_GROWTH_CAP,
  LOADING_GROWTH,
  RECOVERY_FRACTION,
  START_FRACTION,
  START_FROM_HISTORY,
  TAPER_FRACTIONS,
} from "./constants";
import type { WeekSkeleton } from "./calendar";

/** Round down to a multiple of 5 minutes. */
export function floor5(minutes: number): number {
  return Math.floor(minutes / 5 + 1e-9) * 5;
}

/**
 * Week 1 in minutes before rounding: 75 % of H, or with history `clamp(1.10 x A, 60 % of H, 90 % of H)`
 * where A is the average weekly hours of the last 4 weeks (only used when it is given).
 */
export function startMinutes(hoursPerWeek: number, recentAverageHours?: number): number {
  const h = hoursPerWeek * 60;
  if (recentAverageHours === undefined || !(recentAverageHours > 0)) return h * START_FRACTION;
  const { factor, minFraction, maxFraction } = START_FROM_HISTORY;
  return Math.min(h * maxFraction, Math.max(h * minFraction, factor * recentAverageHours * 60));
}

/** What the budget of one week needs to know about the weeks before it. */
export type BudgetState = {
  /** Unrounded hours of the last loading week, the base of the next one. */
  chain: number | null;
  /** Minutes actually planned in the last loading week; null before the first one. */
  lastLoadingPlanned: number | null;
};

export const initialBudgetState: BudgetState = {
  chain: null,
  lastLoadingPlanned: null,
};

export type WeekBudget = {
  /** The ceiling for the week, in minutes. */
  minutes: number;
  /** Chain value (unrounded minutes) to carry on after a loading week. */
  chain: number;
  /** True when the chain grew in this week. */
  grew: boolean;
};

/**
 * The ceiling of one week.
 *  - Loading: `min(H, week 1 x 1.08^n)` (unrounded chain, then rounded down), at most +10 % over the
 *    hours planned in the previous loading week (cap C2). A held week repeats the previous loading week.
 *  - Recovery: 70 % of the hours planned in the previous loading week (cap C9).
 *  - Taper: a percent of H from the taper table.
 */
export function weekBudget(input: {
  week: WeekSkeleton;
  taperWeeks: number;
  hoursPerWeek: number;
  recentAverageHours?: number | undefined;
  /** The week repeats the previous loading week (weight falling faster than the cap, overload). */
  hold: boolean;
  state: BudgetState;
}): WeekBudget {
  const { week, state } = input;
  const h = input.hoursPerWeek * 60;
  if (week.type === "taper") {
    const table = input.taperWeeks === 1 ? TAPER_FRACTIONS.one : TAPER_FRACTIONS.two;
    const fraction = table[Math.min(week.taperIndex ?? 0, table.length - 1)] ?? 0.5;
    return { minutes: floor5(h * fraction), chain: state.chain ?? h, grew: false };
  }
  if (week.type === "recovery") {
    const previous = state.lastLoadingPlanned ?? floor5(state.chain ?? h * START_FRACTION);
    return {
      minutes: floor5(previous * RECOVERY_FRACTION),
      chain: state.chain ?? h,
      grew: false,
    };
  }
  let chain: number;
  let grew = false;
  if (state.chain === null) {
    chain = Math.min(h, startMinutes(input.hoursPerWeek, input.recentAverageHours));
    grew = true;
  } else if (input.hold) {
    chain = state.chain;
  } else {
    chain = Math.min(h, state.chain * LOADING_GROWTH);
    grew = true;
  }
  let minutes = floor5(chain);
  if (state.lastLoadingPlanned !== null) {
    minutes = Math.min(minutes, floor5(state.lastLoadingPlanned * HOURS_GROWTH_CAP));
  }
  return { minutes: Math.min(minutes, floor5(h)), chain, grew };
}

/**
 * The ceilings of all weeks, assuming every week reaches its ceiling. The plan builder uses the real
 * planned minutes instead (a week can be lighter than its ceiling), so its numbers can differ a little.
 */
export function weeklyBudget(input: {
  weeks: readonly WeekSkeleton[];
  taperWeeks: number;
  hoursPerWeek: number;
  recentAverageHours?: number | undefined;
  holdWeeks?: readonly number[] | undefined;
}): number[] {
  let state = initialBudgetState;
  return input.weeks.map((week) => {
    const budget = weekBudget({
      week,
      taperWeeks: input.taperWeeks,
      hoursPerWeek: input.hoursPerWeek,
      recentAverageHours: input.recentAverageHours,
      hold: input.holdWeeks?.includes(week.number) ?? false,
      state,
    });
    if (week.type === "loading") {
      state = {
        chain: budget.chain,
        lastLoadingPlanned: budget.minutes,
      };
    }
    return budget.minutes;
  });
}
