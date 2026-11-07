/**
 * Text formatting for the summaries: English, metric, Brussels dates, no emoji (P6, R11). Dates are
 * formatted from the `YYYY-MM-DD` string itself, never through a time zone, so the output is the same on
 * every machine. A date that is not a real date is printed as it was given; nothing here throws.
 */
import { isIsoDate, weekdayIndex, type IsoDate, type Zone } from "@/features/athlete";
import type { Range } from "./types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_SHORT = [
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
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parts(date: IsoDate): { year: number; month: number; day: number } | null {
  if (!isIsoDate(date)) return null;
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/** "Sat". */
export function dayName(date: IsoDate): string {
  const index = weekdayIndex(date);
  return index === null ? date : (DAY_NAMES[index] ?? date);
}

/** "24 Oct". */
export function dayMonth(date: IsoDate): string {
  const p = parts(date);
  return p === null ? date : `${p.day} ${MONTH_SHORT[p.month - 1] ?? ""}`;
}

/** "Sat 24 Oct". */
export function dayLabel(date: IsoDate): string {
  return parts(date) === null ? date : `${dayName(date)} ${dayMonth(date)}`;
}

/** "Sat 24 Oct 2026". */
export function dayLabelYear(date: IsoDate): string {
  const p = parts(date);
  return p === null ? date : `${dayLabel(date)} ${p.year}`;
}

/** "Mon 19 Oct to Sun 25 Oct 2026"; both years are written when the range crosses a year. */
export function dayRangeLabel(from: IsoDate, to: IsoDate): string {
  const a = parts(from);
  const b = parts(to);
  if (a === null || b === null) return `${from} to ${to}`;
  return a.year === b.year
    ? `${dayLabel(from)} to ${dayLabelYear(to)}`
    : `${dayLabelYear(from)} to ${dayLabelYear(to)}`;
}

/** "October 2026". */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_LONG[month - 1] ?? String(month)} ${year}`;
}

/** The last day of a month as `YYYY-MM-DD`. */
export function lastDayOfMonth(year: number, month: number): IsoDate {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The first day of a month as `YYYY-MM-DD`. */
export function firstDayOfMonth(year: number, month: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Brussels",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "07:40", the Brussels wall clock time of an instant; "n/a" for an invalid Date. */
export function brusselsTime(instant: Date): string {
  if (Number.isNaN(instant.getTime())) return "n/a";
  const p = Object.fromEntries(timeFormat.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p["hour"]}:${p["minute"]}`;
}

/** Whole number with a comma as thousands separator: 5120 becomes "5,120". */
export function grouped(value: number): string {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded));
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rounded < 0 ? `-${withCommas}` : withCommas;
}

/** One decimal: 68.4. */
export function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** Up to one decimal without a trailing zero: 6 or 5.5. */
export function trimmedDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** "142 min". */
export function minutesText(minutes: number): string {
  return `${Math.round(minutes)} min`;
}

/** "3 h 05"; minutes are always two digits, so lists line up: "0 h 25". */
export function hoursMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`;
}

/** "1 session", "2 sessions". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}

/** "228 to 262 W", "65 W", "376 W and up". */
export function rangeText(range: Range, unit: string): string {
  if (range.max === null) return `${range.min} ${unit} and up`;
  if (range.max === range.min) return `${range.min} ${unit}`;
  return `${range.min} to ${range.max} ${unit}`;
}

/** "zone 4" for a number, "zone 3 to 4" for text. */
export function zoneText(zone: number | string): string {
  return `zone ${zone}`;
}

/**
 * Zone limits as one sentence part: "Z1 up to 124 bpm, Z2 125 to 142, Z3 143 to 155, Z4 156 to 168,
 * Z5 169 and up". The unit is written once, after the first zone.
 */
export function zoneLimits(zones: readonly Zone[], unit: string): string {
  return zones
    .map((zone, index) => {
      const first = index === 0;
      if (zone.max === null) return `${zone.label} ${zone.min}${first ? ` ${unit}` : ""} and up`;
      if (first || zone.min === 0) return `${zone.label} up to ${zone.max} ${unit}`;
      return `${zone.label} ${zone.min} to ${zone.max}`;
    })
    .join(", ");
}

/** Collapses line breaks and runs of spaces, so free text cannot break the layout of a list item. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
