/**
 * The weight loop (docs/plan/engine-rules.md section 9): weekly checks of the weight trend turn into a state
 * with hysteresis, and the state (never the raw weights) feeds the plan through `PlanInput.adjustments`.
 * Facts only: no calories, no advice. Pure: `today` is the only clock.
 */
import { normalizeEntries, type IsoDate, type WeightEntry } from "@/features/athlete";
import { weightRateCap, type WeekType } from "../engine";
import { between, plus } from "./dates";

/** Faster than the cap in this many checks in a row: hours are held (`WEIGHT_FASTER_CHECKS`). */
export const FASTER_CHECKS = 2;
/** Stalled in this many checks in a row (`WEIGHT_STALLED`). */
export const STALLED_CHECKS = 3;
/** At most this many kg a week is stalled. */
export const STALLED_AT_MOST_KG = 0.05;
/** Each of the two windows needs this many weigh-ins. */
export const MIN_WEIGH_INS = 3;
/** The extra easy ride comes at most once in this many weeks. */
export const EXTRA_RIDE_EVERY_WEEKS = 3;

/** What the weight loop needs to know about the plan. */
export type WeightStateGoal = {
  /** Weight on the plan start date, for the cap (0.5 % of it a week by default). */
  startKg: number;
  /** Setting: weekly cap in percent of the start weight (default 0.5, at most 0.75). */
  capPercent?: number | undefined;
  /** Monday of week 1. */
  planStart: IsoDate;
  /** Type of each plan week, week 1 first: a stalled check in a recovery or taper week adds no ride. */
  weekTypes: readonly WeekType[];
};

/** One Monday check. `rateKgPerWeek` is null with fewer than 3 weigh-ins in a window. */
export type WeightCheck = {
  week: number;
  date: IsoDate;
  rateKgPerWeek: number | null;
};

export type WeightStateKind = "on-track" | "faster-than-cap" | "stalled" | "not-enough-data";

export type WeightState = {
  state: WeightStateKind;
  capKgPerWeek: number;
  /** Rate of the latest check; null without enough data. */
  rateKgPerWeek: number | null;
  checks: WeightCheck[];
  /** `PlanAdjustments.holdWeeks`: the week of the second fast check and the next one. */
  holdWeeks: number[];
  /** `PlanAdjustments.extraEasyRideWeeks`: the week of the third flat check. */
  extraEasyRideWeeks: number[];
  /** Plain fact for the current week, or null when nothing changes. */
  notice: string | null;
};

function windowAverage(entries: readonly WeightEntry[], end: IsoDate): number | null {
  const start = plus(end, -6);
  const inside = entries.filter((e) => e.date >= start && e.date <= end);
  if (inside.length < MIN_WEIGH_INS) return null;
  return inside.reduce((sum, e) => sum + e.kg, 0) / inside.length;
}

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The weight state on `today`. Every Monday of the plan up to today is a check: rate = (average of the
 * 7 days ending 14 days before the Monday minus the average of the 7 days ending on the Monday) / 2 kg a
 * week, both windows with at least 3 weigh-ins (the averages are the `trend` windows). A check only
 * reads weigh-ins up to its own Monday, so later weigh-ins never change an earlier check.
 *
 * - Faster than the cap in 2 checks in a row: the week of the second check and the next are held.
 * - At most 0.05 kg a week in 3 checks in a row, in a loading week, at most once every 3 weeks: one extra
 *   easy ride that week.
 */
export function weightState(
  entries: readonly WeightEntry[],
  goal: WeightStateGoal,
  today: IsoDate,
): WeightState {
  const log = normalizeEntries(entries);
  const cap = weightRateCap(goal.startKg, goal.capPercent);
  const checks: WeightCheck[] = [];
  for (let week = 1; week <= goal.weekTypes.length; week += 1) {
    const date = plus(goal.planStart, 7 * (week - 1));
    if (date > today) break;
    const now = windowAverage(log, date);
    const before = windowAverage(log, plus(date, -14));
    checks.push({
      week,
      date,
      rateKgPerWeek: now === null || before === null ? null : (before - now) / 2,
    });
  }

  const fast = (check: WeightCheck | undefined): boolean =>
    check?.rateKgPerWeek != null && check.rateKgPerWeek > cap;
  const flat = (check: WeightCheck | undefined): boolean =>
    check?.rateKgPerWeek != null && check.rateKgPerWeek <= STALLED_AT_MOST_KG;

  const hold = new Set<number>();
  const extra: number[] = [];
  let lastExtra = Number.NEGATIVE_INFINITY;
  let flatRun = 0;
  checks.forEach((check, i) => {
    if (i >= FASTER_CHECKS - 1 && checks.slice(i - FASTER_CHECKS + 1, i + 1).every(fast)) {
      hold.add(check.week);
      if (check.week + 1 <= goal.weekTypes.length) hold.add(check.week + 1);
    }
    flatRun = flat(check) ? flatRun + 1 : 0;
    if (
      flatRun >= STALLED_CHECKS &&
      goal.weekTypes[check.week - 1] === "loading" &&
      check.week - lastExtra >= EXTRA_RIDE_EVERY_WEEKS
    ) {
      extra.push(check.week);
      lastExtra = check.week;
    }
  });
  const holdWeeks = [...hold].sort((a, b) => a - b);
  const extraEasyRideWeeks = extra.filter((week) => !hold.has(week));

  const latest = checks[checks.length - 1];
  const currentWeek = Math.floor(between(goal.planStart, today) / 7) + 1;
  let state: WeightStateKind = "not-enough-data";
  if (latest && latest.rateKgPerWeek !== null) {
    state = "on-track";
    if (
      checks.slice(-FASTER_CHECKS).length === FASTER_CHECKS &&
      checks.slice(-FASTER_CHECKS).every(fast)
    ) {
      state = "faster-than-cap";
    } else if (flatRun >= STALLED_CHECKS) {
      state = "stalled";
    }
  }

  let notice: string | null = null;
  if (
    state === "faster-than-cap" &&
    holdWeeks.includes(currentWeek) &&
    latest?.rateKgPerWeek != null
  ) {
    notice = `Your weight trend fell ${oneDecimal(latest.rateKgPerWeek)} kg a week in the last 2 weeks. The plan holds your training hours this week.`;
  } else if (state === "stalled" && extraEasyRideWeeks.includes(currentWeek)) {
    notice = "Your weight trend has been flat for 3 weeks. The plan adds one easy ride this week.";
  } else if (state === "stalled") {
    notice = "Your weight trend has been flat for 3 weeks.";
  }

  return {
    state,
    capKgPerWeek: cap,
    rateKgPerWeek: latest?.rateKgPerWeek ?? null,
    checks,
    holdWeeks,
    extraEasyRideWeeks,
    notice,
  };
}

/** The notice for a flat trend when the plan has no free day for an easy ride (section 9). */
export const STALLED_NO_ROOM_NOTICE =
  "Your weight trend has been flat for 3 weeks. The plan has no free day for more easy riding; add a riding day in your profile to allow more.";
