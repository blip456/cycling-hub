/** Small date helpers on top of the athlete date code (Brussels calendar dates, no time zones). */
import { addDays, diffDays, weekdayIndex, type IsoDate } from "@/features/athlete";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const FULL_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `date` plus days; an invalid date comes back unchanged. */
export function plus(date: IsoDate, offset: number): IsoDate {
  return addDays(date, offset) ?? date;
}

/** Whole days from `from` to `to` (0 for invalid dates). */
export function between(from: IsoDate, to: IsoDate): number {
  return diffDays(from, to) ?? 0;
}

/** The Monday of the week that holds `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  return plus(date, -(weekdayIndex(date) ?? 0));
}

/** "Tue 27 Oct": the day format of the wireframes. */
export function dayLabel(date: IsoDate): string {
  const day = DAY_NAMES[weekdayIndex(date) ?? 0] ?? "Mon";
  const month = MONTH_NAMES[Number(date.slice(5, 7)) - 1] ?? "Jan";
  return `${day} ${Number(date.slice(8, 10))} ${month}`;
}

/** Full weekday name for sentences ("Wednesday"). */
export function weekdayName(date: IsoDate): string {
  return FULL_DAY_NAMES[weekdayIndex(date) ?? 0] ?? "Monday";
}
