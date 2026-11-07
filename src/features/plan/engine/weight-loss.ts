/** Weight loss target and the weekly rate cap (section 9). Facts only: no calories, no advice. */
import { diffDays, isIsoDate, type IsoDate } from "@/features/athlete";
import { plusDays } from "./calendar";
import { DEFAULT_WEIGHT_RATE_CAP_PERCENT, MAX_WEIGHT_RATE_CAP_PERCENT } from "./constants";
import type { Warning, WeightGoal, WeightPlan } from "./types";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function kg(value: number): string {
  return String(round1(value));
}

/** The cap in kg a week: a percent of the start weight, default 0.5 and at most 0.75. */
export function weightRateCap(startKg: number, capPercent?: number): number {
  const percent = Math.min(
    MAX_WEIGHT_RATE_CAP_PERCENT,
    Math.max(0.1, capPercent ?? DEFAULT_WEIGHT_RATE_CAP_PERCENT),
  );
  return (startKg * percent) / 100;
}

/**
 * The planned weight line from the start weight to the target. The plan never uses a rate above the cap
 * and, when the PO's date needs more, shows the earliest date at the cap. Returns a warning (and no plan)
 * when the target is not below the start weight or the date has passed.
 */
export function weightPlan(input: {
  startKg: number;
  goal: WeightGoal;
  startDate: IsoDate;
  weeks: number;
  capPercent?: number | undefined;
}): { plan: WeightPlan | null; warnings: Warning[] } {
  const { startKg, goal, startDate } = input;
  if (!(goal.targetKg < startKg)) {
    return {
      plan: null,
      warnings: [
        {
          code: "weight-target-not-below",
          message:
            "The target weight is not below your current weight, so it is not a weight loss target. Choose another target.",
        },
      ],
    };
  }
  const days = isIsoDate(goal.targetDate) ? diffDays(startDate, goal.targetDate) : null;
  if (days === null || days < 1) {
    return {
      plan: null,
      warnings: [
        {
          code: "weight-date-passed",
          message: "The target date is not after the plan start, so the weight line is not drawn.",
        },
      ],
    };
  }
  const cap = weightRateCap(startKg, input.capPercent);
  const toLose = startKg - goal.targetKg;
  // The target day counts as a whole day: the last day of week 12 is 84 days after the start.
  const needed = toLose / ((days + 1) / 7);
  const planned = Math.min(needed, cap);
  const capped = needed > cap;
  const weeksNeeded = Math.ceil(toLose / planned - 1e-9);
  const earliestDate = plusDays(startDate, Math.ceil((toLose / planned) * 7 - 1e-9) - 1);
  const line = Array.from({ length: input.weeks }, (_, i) => ({
    week: i + 1,
    date: plusDays(startDate, 7 * (i + 1) - 1),
    kg: round1(Math.max(goal.targetKg, startKg - planned * (i + 1))),
  }));
  const message = capped
    ? `At a safe rate of ${cap.toFixed(2)} kg a week, ${kg(goal.targetKg)} kg is reachable around week ${weeksNeeded} (${earliestDate}), not by ${goal.targetDate}.`
    : `Your target of ${kg(goal.targetKg)} kg by ${goal.targetDate} needs ${needed.toFixed(2)} kg a week, which is within the cap of ${cap.toFixed(2)} kg a week.`;
  return {
    plan: {
      startKg,
      targetKg: goal.targetKg,
      targetDate: goal.targetDate,
      capKgPerWeek: Math.round(cap * 100) / 100,
      neededKgPerWeek: Math.round(needed * 100) / 100,
      plannedKgPerWeek: Math.round(planned * 100) / 100,
      capped,
      earliestDate,
      earliestWeek: weeksNeeded,
      line,
      message,
    },
    warnings: [],
  };
}
