/**
 * Calendar-date helpers for the athlete features (P6: Europe/Brussels).
 *
 * A "date" here is a plain `YYYY-MM-DD` string with no time zone. All arithmetic runs on UTC midnight of
 * that date, so a day is always exactly 24 h and daylight saving time (the 23 h and 25 h days in Brussels)
 * can never shift a result. Only `brusselsDate` converts a real instant to a Brussels calendar date.
 */

/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

/** Weekdays in week order. The week starts on Monday (ISO 8601, Brussels). */
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parse(date: string): Date | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const value = new Date(Date.UTC(y, mo - 1, d));
  // Rejects 2026-02-30 and 2026-13-01, which `Date.UTC` would roll over.
  return value.getUTCFullYear() === y && value.getUTCMonth() === mo - 1 && value.getUTCDate() === d
    ? value
    : null;
}

function format(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

/** True for a real calendar date written as `YYYY-MM-DD` (leap days included, 2026-02-29 is not). */
export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && parse(value) !== null;
}

/** The date `days` days after `date` (negative for before), or null when `date` is invalid. */
export function addDays(date: IsoDate, days: number): IsoDate | null {
  const value = parse(date);
  if (!value || !Number.isInteger(days)) return null;
  return format(new Date(value.getTime() + days * DAY_MS));
}

/**
 * The date `months` calendar months after `date`, with the day of the month kept, or clamped to the last
 * day of a shorter month (31 Mar minus 1 month is 28 Feb, or 29 Feb in a leap year).
 */
export function addMonths(date: IsoDate, months: number): IsoDate | null {
  const value = parse(date);
  if (!value || !Number.isInteger(months)) return null;
  const target = value.getUTCFullYear() * 12 + value.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = target - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month, Math.min(value.getUTCDate(), lastDay))));
}

/** Whole days from `from` to `to` (positive when `to` is later), or null when either is invalid. */
export function diffDays(from: IsoDate, to: IsoDate): number | null {
  const a = parse(from);
  const b = parse(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / DAY_MS) : null;
}

/** Index of the weekday in `WEEKDAYS` (Monday 0 to Sunday 6), or null for an invalid date. */
export function weekdayIndex(date: IsoDate): number | null {
  const value = parse(date);
  return value ? (value.getUTCDay() + 6) % 7 : null;
}

const brusselsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Brussels calendar date of an instant (default: now). Use it to get `today`. Null for an invalid Date. */
export function brusselsDate(instant: Date = new Date()): IsoDate | null {
  if (Number.isNaN(instant.getTime())) return null;
  const parts = Object.fromEntries(
    brusselsFormat.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}
