/**
 * The weekly riding hours of the recent past (rules section 5). Week 1 of a plan starts from this number
 * instead of 75 % of H, so a plan does not start far below (or above) what the PO really rides. Pure.
 */
import type { IsoDate } from "@/features/athlete";
import { mondayOnOrBefore, plusDays } from "./calendar";
import type { HistoryStat } from "./types";

/** Weeks looked back. Only complete Monday to Sunday weeks count; the running week is left out. */
export const HISTORY_WEEKS = 24;
/** Fewer weeks with rides than this: the history says too little and is not used. */
export const MIN_HISTORY_WEEKS = 2;

/** The part of a ride the history needs. */
export type HistoryRide = {
  date: IsoDate;
  /** Moving time in minutes. */
  movingMinutes: number;
  /** Tagged commute: not training volume, left out (like matching does). */
  commute?: boolean;
  /** Average power in watts; null or missing without a power meter. */
  avgPowerW?: number | null | undefined;
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

/**
 * The Mondays of the weeks that count in the last `weeks` complete weeks before `today`.
 *
 * - Weeks before the first ride in the window are not counted (a new rider is not pulled down by empty
 *   weeks that came before riding), weeks after it are counted, also the empty ones (a break is part of
 *   the real pattern; the median shrugs off a few of them, the average does not).
 * - Undefined when fewer than 2 of the counted weeks have rides.
 * - Commutes and rides without moving time are left out.
 */
export function countedWeeks(
  rides: readonly HistoryRide[],
  today: IsoDate,
  weeks: number = HISTORY_WEEKS,
): { mondays: IsoDate[]; minutesByWeek: ReadonlyMap<IsoDate, number> } | undefined {
  const thisMonday = mondayOnOrBefore(today);
  const first = plusDays(thisMonday, -7 * weeks);
  const last = plusDays(thisMonday, -1);
  const minutesByWeek = new Map<IsoDate, number>();
  for (const ride of rides) {
    if (ride.commute === true || !(ride.movingMinutes > 0)) continue;
    if (ride.date < first || ride.date > last) continue;
    const week = mondayOnOrBefore(ride.date);
    minutesByWeek.set(week, (minutesByWeek.get(week) ?? 0) + ride.movingMinutes);
  }
  const withRides = [...minutesByWeek.keys()].sort();
  const firstWeek = withRides[0];
  if (firstWeek === undefined || withRides.length < MIN_HISTORY_WEEKS) return undefined;
  const mondays: IsoDate[] = [];
  for (let week = firstWeek; week <= last; week = plusDays(week, 7)) mondays.push(week);
  return { mondays, minutesByWeek };
}

/** Hours ridden in each counted week of the last `weeks` weeks, oldest first (see `countedWeeks`). */
export function weeklyHoursList(
  rides: readonly HistoryRide[],
  today: IsoDate,
  weeks: number = HISTORY_WEEKS,
): number[] | undefined {
  const counted = countedWeeks(rides, today, weeks);
  if (!counted) return undefined;
  return counted.mondays.map((week) => (counted.minutesByWeek.get(week) ?? 0) / 60);
}

/**
 * Hours ridden per week over the last 24 complete weeks before `today`, as the median or the average of
 * the counted weeks (see `countedWeeks`). Rounded to 0.01 hours.
 */
export function recentWeeklyHours(
  rides: readonly HistoryRide[],
  today: IsoDate,
  stat: HistoryStat,
  weeks: number = HISTORY_WEEKS,
): number | undefined {
  const hours = weeklyHoursList(rides, today, weeks);
  if (!hours) return undefined;
  const value =
    stat === "median" ? median(hours) : hours.reduce((sum, h) => sum + h, 0) / hours.length;
  return Math.round(value * 100) / 100;
}

/** Weeks behind "the last 3 months" in level question L2. */
export const LEVEL_HOURS_WEEKS = 13;

/**
 * The answer to level question L2 ("How many hours a week did you ride in the last 3 months?") that the
 * rides suggest: 0 under 4 h, 1 for 4 to under 8 h, 2 for 8 to under 12 h, 3 for 12 h or more. Undefined
 * when the rides say too little (see `recentWeeklyHours`). It only pre-fills the question; the PO can change it.
 */
export function suggestedHoursAnswer(
  rides: readonly HistoryRide[],
  today: IsoDate,
  stat: HistoryStat,
): { answer: 0 | 1 | 2 | 3; hours: number } | undefined {
  const hours = recentWeeklyHours(rides, today, stat, LEVEL_HOURS_WEEKS);
  if (hours === undefined) return undefined;
  const answer = hours >= 12 ? 3 : hours >= 8 ? 2 : hours >= 4 ? 1 : 0;
  return { answer, hours };
}
