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
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}

/**
 * Hours ridden per week over the last 24 complete weeks before `today`, as the median or the average of
 * the weeks.
 *
 * - Weeks before the first ride in the window are not counted (a new rider is not pulled down by empty
 *   weeks that came before riding), weeks after it are counted, also the empty ones (a break is part of
 *   the real pattern; the median shrugs off a few of them, the average does not).
 * - Undefined when fewer than 2 of the counted weeks have rides.
 * - Rounded to 0.01 hours.
 */
export function recentWeeklyHours(
  rides: readonly HistoryRide[],
  today: IsoDate,
  stat: HistoryStat,
): number | undefined {
  const thisMonday = mondayOnOrBefore(today);
  const first = plusDays(thisMonday, -7 * HISTORY_WEEKS);
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

  const hours: number[] = [];
  for (let week = firstWeek; week <= last; week = plusDays(week, 7)) {
    hours.push((minutesByWeek.get(week) ?? 0) / 60);
  }
  const value =
    stat === "median" ? median(hours) : hours.reduce((sum, h) => sum + h, 0) / hours.length;
  return Math.round(value * 100) / 100;
}
