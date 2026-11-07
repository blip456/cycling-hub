/**
 * The reason lines of the plan screens (R8b, R9, R9b): why a week looks the way it does when the weight or
 * the event changed it, and the weight line of a session. They say what the plan does, never what to eat or
 * what the body does (P1). The numbers come from the adaptation's weight state; nothing is recomputed here
 * except the pace the target needs. Pure.
 */
import { diffDays, type IsoDate } from "@/features/athlete";
import type { WeightState } from "../adapt";
import type { Purpose } from "../engine";
import { formatDuration, purposeLabel, type WeekSummary } from "../data";

/** The goal and the latest weight, for "your target needs 0.32 kg". */
export type WeightFacts = {
  state: WeightState;
  /** The weight goal; null without one. */
  goal: { targetKg: number; targetDate: IsoDate } | null;
  /** The latest 7-day average in kg; null without weigh-ins. */
  currentKg: number | null;
  today: IsoDate;
};

function kg(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

/** Kilograms a week the target needs from now, to 0.01; null when it cannot be told or is reached. */
export function neededKgPerWeek(facts: WeightFacts): number | null {
  const { goal, currentKg, today } = facts;
  if (!goal || currentKg === null) return null;
  const days = diffDays(today, goal.targetDate);
  if (days === null || days <= 0 || currentKg <= goal.targetKg) return null;
  return ((currentKg - goal.targetKg) / days) * 7;
}

/** "Your weight trend is 0.14 kg a week; your target needs 0.32 kg." or the part that can be said. */
export function trendSentence(facts: WeightFacts): string | null {
  const { state } = facts;
  if (state.state === "not-enough-data" || state.rateKgPerWeek === null) return null;
  const rate = Math.max(0, state.rateKgPerWeek);
  const needed = neededKgPerWeek(facts);
  return needed === null
    ? `Your weight trend is ${kg(rate)} kg a week.`
    : `Your weight trend is ${kg(rate)} kg a week; your target needs ${kg(needed)} kg.`;
}

/** The weight line for a week of the plan; null when the weight did not change it. */
export function weightWeekReason(
  facts: WeightFacts,
  week: number,
  isCurrent: boolean,
): string | null {
  const { state } = facts;
  if (state.holdWeeks.includes(week)) {
    const base =
      isCurrent && state.notice
        ? state.notice
        : "Your weight trend is falling faster than the weekly limit. The plan holds your training hours this week.";
    return base;
  }
  if (state.extraEasyRideWeeks.includes(week)) {
    return isCurrent && state.notice
      ? state.notice
      : "Your weight trend has been flat for 3 weeks. The plan adds one easy ride this week.";
  }
  return null;
}

/** "Weight loss is your first purpose, endurance your second." */
export function purposesSentence(purposes: readonly Purpose[]): string | null {
  const [first, second] = purposes;
  if (!first) return null;
  const one = purposeLabel(first);
  if (!second) return `${one} is your purpose.`;
  return `${one} is your first purpose, ${purposeLabel(second).toLowerCase()} your second.`;
}

/** R8b: why the taper week is light, with the hours of the weeks before it. */
export function taperReason(week: WeekSummary, weeks: readonly WeekSummary[]): string | null {
  if (week.phase !== "taper") return null;
  const before = weeks.filter((w) => w.number < week.number && w.phase !== "taper");
  const heaviest = Math.max(0, ...before.map((w) => w.minutes));
  if (heaviest <= week.minutes) return null;
  return `Taper: ${formatDuration(week.minutes)} of riding instead of ${formatDuration(heaviest)}. Freshness matters more than fitness this close to the event.`;
}

export type WeekReason = { lines: string[] };

/**
 * The "Why this week" card (R9, R8b): a sentence for the weight when it changed the week, the purposes that
 * explain it, and the taper. Null when nothing changed the week.
 */
export function weekReason(input: {
  week: WeekSummary;
  weeks: readonly WeekSummary[];
  isCurrent: boolean;
  weight: WeightFacts | null;
  purposes: readonly Purpose[];
}): WeekReason | null {
  const { week, weeks, isCurrent, weight, purposes } = input;
  const lines: string[] = [];
  const taper = taperReason(week, weeks);
  if (taper) lines.push(taper);
  const changed = weight ? weightWeekReason(weight, week.number, isCurrent) : null;
  if (weight && changed) {
    // The notice of the current week already names the trend.
    const trend = changed === weight.state.notice ? null : trendSentence(weight);
    if (trend) lines.push(trend);
    lines.push(changed);
    const purpose = purposesSentence(purposes);
    if (purpose && purposes.includes("weight-loss")) lines.push(purpose);
  }
  return lines.length > 0 ? { lines } : null;
}

/** The weight line of a session's reasons (R9b): the trend against the cap, or why the week was held. */
export function sessionWeightLine(facts: WeightFacts, week: number): string | null {
  const { state } = facts;
  if (state.state === "not-enough-data" || state.rateKgPerWeek === null) return null;
  const cap = kg(state.capKgPerWeek);
  const trend = trendSentence(facts);
  if (!trend) return null;
  if (state.holdWeeks.includes(week)) {
    return `Weight trend: ${trend.replace("Your weight trend is ", "").replace(/\.$/, "")}. The cap of ${cap} kg a week was reached.`;
  }
  return `Weight trend: ${trend.replace("Your weight trend is ", "").replace(/\.$/, "")}. The cap of ${cap} kg a week is not reached.`;
}
