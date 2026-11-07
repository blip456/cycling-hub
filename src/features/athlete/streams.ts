/**
 * Reading ride streams for the athlete calculations (T12/T13, `docs/export-format.md` "Streams").
 *
 * A stored stream file has columnar arrays of equal length: `time` in whole seconds since the first point
 * (non-decreasing; two points may share a second), and per-value arrays where `null` is a missing value.
 * Zero is a real value for `watts` (coasting); for `heartrate` a zero is a sensor dropout.
 */

/** One numeric channel of a ride, aligned with `time`. */
export type NumericStream = {
  /** Whole seconds since the first point, non-decreasing. */
  time: readonly number[];
  /** One value per point; null is missing. */
  values: readonly (number | null)[];
};

/** A ride with one channel. `id` is whatever the caller needs back (the ride's id). */
export type RideStream = { id: string; stream: NumericStream | null };

/** How long a value is held across a gap between two points, and the longest dropout a window tolerates. */
export const DEFAULT_MAX_GAP_S = 10;

/**
 * Takes one channel (`"watts"` or `"heartrate"`) out of parsed stream JSON. Returns null when `streams` is
 * not an object, the channel is absent, lengths differ, `time` is not whole non-decreasing seconds, or a
 * value is not a finite number or null. Never throws.
 */
export function readChannel(
  streams: unknown,
  channel: "watts" | "heartrate",
): NumericStream | null {
  if (typeof streams !== "object" || streams === null) return null;
  const record = streams as Record<string, unknown>;
  const time = record["time"];
  const values = record[channel];
  if (!Array.isArray(time) || !Array.isArray(values) || time.length !== values.length) return null;
  let previous = -Infinity;
  for (let i = 0; i < time.length; i += 1) {
    const t: unknown = time[i];
    if (typeof t !== "number" || !Number.isInteger(t) || t < 0 || t < previous) return null;
    previous = t;
    const v: unknown = values[i];
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) return null;
  }
  return { time: time as number[], values: values as (number | null)[] };
}

/** Longest stretch (seconds) the per-second grid will cover, as a guard against corrupt time values. */
const MAX_SPAN_S = 1_000_000;

/**
 * Lays a stream on a per-second grid. Each point holds its value from its own time until the next point
 * when that gap is at most `maxGapS`; after a longer gap it holds for one second only. A null point
 * leaves its seconds missing (NaN). When two points share a second the later one wins.
 *
 * Returns the grid (index 0 is the first point's time) and the time of its first second, or null when the
 * stream is empty, malformed or spans more than `MAX_SPAN_S`.
 */
export function toPerSecond(
  stream: NumericStream,
  maxGapS: number = DEFAULT_MAX_GAP_S,
): { start: number; grid: Float64Array } | null {
  const { time, values } = stream;
  const n = time.length;
  if (n === 0 || values.length !== n) return null;
  const first = time[0] as number;
  const last = time[n - 1] as number;
  if (!(last >= first) || last - first > MAX_SPAN_S) return null;
  const grid = new Float64Array(last - first + 1).fill(NaN);
  for (let i = 0; i < n; i += 1) {
    const value = values[i];
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    const t = time[i] as number;
    const next = i + 1 < n ? (time[i + 1] as number) : t + 1;
    const hold = next - t <= maxGapS ? next - t : 1;
    for (let s = 0; s < hold && t - first + s < grid.length; s += 1) grid[t - first + s] = value;
  }
  return { start: first, grid };
}
