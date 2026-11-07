import { addDays, addMonths, isIsoDate, type IsoDate } from "./dates";

/**
 * Weight log rules and trend helpers (P45, P6: kg, Brussels dates). Pure functions on plain arrays; the
 * caller owns storage. Dates are `YYYY-MM-DD` Brussels calendar dates (see `dates.ts`), so there is no
 * time-zone or daylight saving maths here. Entries with an invalid date or a non-finite weight are
 * ignored, never thrown on.
 */

/** One weigh-in. At most one per date (the database enforces it; `normalizeEntries` repairs lists). */
export type WeightEntry = { date: IsoDate; kg: number; note?: string | null };

/** A point on the trend line. */
export type TrendPoint = {
  date: IsoDate;
  /** The raw weigh-in of that day. */
  kg: number;
  /** Mean of all weigh-ins from the 6 days before up to and including this date (see `trend`). */
  average: number;
};

/** Ranges of the trend view. */
export type WeightRange = "week" | "month" | "3months" | "year";

function valid(entry: WeightEntry): boolean {
  return isIsoDate(entry.date) && Number.isFinite(entry.kg) && entry.kg > 0;
}

/**
 * Sorted oldest first, one entry per date: when a date appears more than once the last one in the input
 * wins (it is the newer edit). Invalid entries are dropped. Does not change the input.
 */
export function normalizeEntries(entries: readonly WeightEntry[]): WeightEntry[] {
  const byDate = new Map<IsoDate, WeightEntry>();
  for (const entry of entries) if (valid(entry)) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The one-per-day rule (P45): saving a weight for a date that already has one replaces it. Returns the
 * new sorted list; an invalid entry leaves the list as it was (normalised).
 */
export function upsertEntry(entries: readonly WeightEntry[], entry: WeightEntry): WeightEntry[] {
  return normalizeEntries([...entries, entry]);
}

/**
 * Removes the entry of a date. Undo is `upsertEntry` with the removed entry (the caller keeps it).
 * A date without an entry changes nothing.
 */
export function removeEntry(entries: readonly WeightEntry[], date: IsoDate): WeightEntry[] {
  return normalizeEntries(entries).filter((e) => e.date !== date);
}

/**
 * Trend points for the entries on or between `from` and `to` (both inclusive, either may be omitted).
 * Each point's `average` is the mean of the weigh-ins in the 7 calendar days ending on its date (the
 * date and the 6 before it), counted per weigh-in, so irregular dates work and gaps do not need filling.
 * The average looks back at all entries, also those before `from`, so the first point of a range is not
 * based on fewer days than it should be. Entries are normalised first.
 */
export function trend(
  entries: readonly WeightEntry[],
  bounds: { from?: IsoDate; to?: IsoDate } = {},
): TrendPoint[] {
  const all = normalizeEntries(entries);
  const points: TrendPoint[] = [];
  let low = 0; // First entry inside the 7-day window of the current date.
  let windowSum = 0;
  for (let i = 0; i < all.length; i += 1) {
    const current = all[i] as WeightEntry;
    const windowStart = addDays(current.date, -6) as IsoDate;
    windowSum += current.kg;
    while ((all[low] as WeightEntry).date < windowStart) {
      windowSum -= (all[low] as WeightEntry).kg;
      low += 1;
    }
    if ((bounds.from && current.date < bounds.from) || (bounds.to && current.date > bounds.to)) {
      continue;
    }
    points.push({ date: current.date, kg: current.kg, average: windowSum / (i - low + 1) });
  }
  return points;
}

/**
 * First date of a range ending on `today`, inclusive: week is the last 7 days (today and the 6 before);
 * month, 3 months and year are one, three or twelve calendar months back, starting the day after the
 * same date (28 Oct is in range from 29 Sep; a missing day clamps to the end of the month, so a year
 * back from 29 Feb 2028 starts on 1 Mar 2027). Null for an invalid `today`.
 */
export function rangeStart(range: WeightRange, today: IsoDate): IsoDate | null {
  if (range === "week") return addDays(today, -6);
  const months = range === "month" ? 1 : range === "3months" ? 3 : 12;
  const back = addMonths(today, -months);
  return back === null ? null : addDays(back, 1);
}

/** Entries in a range ending on `today` (future dates excluded), oldest first. */
export function entriesInRange(
  entries: readonly WeightEntry[],
  range: WeightRange,
  today: IsoDate,
): WeightEntry[] {
  const from = rangeStart(range, today);
  if (from === null) return [];
  return normalizeEntries(entries).filter((e) => e.date >= from && e.date <= today);
}

/** Trend points for a range ending on `today`; see `trend`. */
export function trendForRange(
  entries: readonly WeightEntry[],
  range: WeightRange,
  today: IsoDate,
): TrendPoint[] {
  const from = rangeStart(range, today);
  return from === null ? [] : trend(entries, { from, to: today });
}

/** Summary of a range for the weight page. */
export type WeightSummary = {
  /** Newest weigh-in on or before `today`, whatever the range; null when there is none. */
  latest: WeightEntry | null;
  /** Number of weigh-ins in the range. */
  count: number;
  /** Last minus first weigh-in in the range, kg, to 0.1; null with fewer than 2 weigh-ins in it. */
  change: number | null;
  /** Lowest and highest weigh-in in the range; null when it is empty. */
  min: number | null;
  max: number | null;
};

/** Latest weight and change over a range ending on `today`. */
export function summarize(
  entries: readonly WeightEntry[],
  range: WeightRange,
  today: IsoDate,
): WeightSummary {
  const upToToday = normalizeEntries(entries).filter((e) => e.date <= today);
  const inRange = entriesInRange(entries, range, today);
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  const kgs = inRange.map((e) => e.kg);
  return {
    latest: upToToday[upToToday.length - 1] ?? null,
    count: inRange.length,
    change:
      first && last && inRange.length >= 2 ? Math.round((last.kg - first.kg) * 10) / 10 : null,
    min: kgs.length > 0 ? Math.min(...kgs) : null,
    max: kgs.length > 0 ? Math.max(...kgs) : null,
  };
}
