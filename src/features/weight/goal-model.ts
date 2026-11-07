import { diffDays, trend, type IsoDate, type WeightEntry } from "@/features/athlete";
import { DEFAULT_WEIGHT_RATE_CAP_PERCENT, weightPlan, weightRateCap } from "@/features/plan/engine";
import { formatDay, formatKg } from "./format";

/** An active or past weight goal as the database stores it (table `weight_goals`, R2a). */
export type WeightGoal = {
  id: string;
  targetKg: number;
  targetDate: IsoDate;
  startKg: number;
  startDate: IsoDate;
  status: "active" | "reached" | "cancelled";
};

/** The 7-day average at the newest weigh-in on or before `today`, or null without one. */
export function currentAverage(entries: readonly WeightEntry[], today: IsoDate): number | null {
  const points = trend(entries, { to: today });
  return points[points.length - 1]?.average ?? null;
}

/** The weekly cap in kg for a body weight: 0.5 % of it by default (P73). */
export function capKgPerWeek(weightKg: number): number {
  return weightRateCap(weightKg, DEFAULT_WEIGHT_RATE_CAP_PERCENT);
}

/** The cap as the plain-words sentence of R2a and R2c. */
export function capSentence(weightKg: number): string {
  return `The plan never aims for a loss faster than ${DEFAULT_WEIGHT_RATE_CAP_PERCENT} % of your body weight per week. At ${formatKg(weightKg)} kg that is ${capKgPerWeek(weightKg).toFixed(2)} kg a week.`;
}

/** Shortest span (days) the 4-week trend needs; with less data than this there is no pace to show. */
const MIN_TREND_DAYS = 14;
const TREND_DAYS = 28;

/**
 * Weight lost per week over the last 4 weeks, from the 7-day averages: the average at the newest
 * weigh-in against the average on or before 28 days earlier (or the oldest weigh-in when the log is
 * younger, but at least 14 days). Positive is a loss. Null with too little data.
 */
export function weeklyTrendLoss(entries: readonly WeightEntry[], today: IsoDate): number | null {
  const points = trend(entries, { to: today });
  const last = points[points.length - 1];
  if (!last) return null;
  let reference = points[0];
  for (const point of points) {
    if ((diffDays(point.date, last.date) ?? 0) >= TREND_DAYS) reference = point;
  }
  if (!reference) return null;
  const span = diffDays(reference.date, last.date) ?? 0;
  if (span < MIN_TREND_DAYS) return null;
  return (reference.average - last.average) / (span / 7);
}

export type GoalStanding =
  | { state: "reached" }
  | { state: "behind" | "on-pace" | "ahead-of-cap"; neededKgPerWeek: number }
  | { state: "unknown"; neededKgPerWeek: number };

/**
 * Where the trend stands against the goal (R2a): "reached" when the average is at or below the target;
 * otherwise the pace still needed to reach it by the date, compared with the 4-week trend. Faster than
 * the cap is called out first, then a pace below 90 % of what is needed is "behind".
 */
export function goalStanding(
  goal: Pick<WeightGoal, "targetKg" | "targetDate">,
  entries: readonly WeightEntry[],
  today: IsoDate,
): GoalStanding | null {
  const now = currentAverage(entries, today);
  if (now === null) return null;
  if (now <= goal.targetKg) return { state: "reached" };
  const days = diffDays(today, goal.targetDate);
  const remaining = now - goal.targetKg;
  const weeksLeft = days === null || days < 0 ? 0 : (days + 1) / 7;
  const needed = weeksLeft > 0 ? remaining / weeksLeft : remaining;
  const rate = weeklyTrendLoss(entries, today);
  if (rate === null) return { state: "unknown", neededKgPerWeek: needed };
  if (rate > capKgPerWeek(now)) return { state: "ahead-of-cap", neededKgPerWeek: needed };
  return { state: rate < needed * 0.9 ? "behind" : "on-pace", neededKgPerWeek: needed };
}

export type GoalCheck =
  | { ok: true }
  | {
      ok: false;
      /** `cap`: the date is too soon for the weekly cap; `target` and `date` are plain input errors. */
      field: "target" | "date";
      message: string;
      /** Only for the cap error: the earliest date that works for this target. */
      earliestDate?: IsoDate;
    };

/**
 * Checks a target weight and date against the start weight and the cap (R2c, engine rules section 9).
 * A date that needs more than the cap is an error with the earliest date as the fix.
 */
export function checkGoal(input: {
  startKg: number;
  targetKg: number;
  targetDate: IsoDate;
  today: IsoDate;
}): GoalCheck {
  const { startKg, targetKg, targetDate, today } = input;
  const { plan, warnings } = weightPlan({
    startKg,
    goal: { targetKg, targetDate },
    startDate: today,
    weeks: 0,
  });
  if (!plan) {
    const code = warnings[0]?.code;
    return code === "weight-target-not-below"
      ? {
          ok: false,
          field: "target",
          message: `Choose a target below your current ${formatKg(startKg)} kg.`,
        }
      : { ok: false, field: "date", message: "Pick a date from tomorrow." };
  }
  if (plan.capped) {
    return {
      ok: false,
      field: "date",
      earliestDate: plan.earliestDate,
      message:
        `A target of ${formatKg(targetKg)} kg by ${formatDay(targetDate)} needs ${plan.neededKgPerWeek.toFixed(2)} kg a week. ` +
        `The cap is ${plan.capKgPerWeek.toFixed(2)} kg. The earliest date for ${formatKg(targetKg)} kg is ${formatDay(plan.earliestDate)}. A later date is fine.`,
    };
  }
  return { ok: true };
}
