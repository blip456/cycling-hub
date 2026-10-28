import { DEFAULT_MAX_GAP_S, toPerSecond, type NumericStream, type RideStream } from "./streams";

/**
 * Highest plausible heart rate in ride streams (P42), offered as a suggestion for max HR that the PO
 * confirms. Pure functions; unusable input gives null.
 *
 * The spike filter, in order:
 * 1. Only values from 40 to 230 bpm count. Zero (sensor dropout), null and anything outside are ignored.
 * 2. A value only counts when it is held: the result is the highest level the heart rate stayed at or
 *    above for 5 seconds in a row, so a one-point glitch of a few seconds cannot win. Points are laid on
 *    a per-second grid first (`toPerSecond`: a point holds until the next one, up to 10 s).
 * A strap that reads too high for a longer time cannot be told from a real effort; hence a suggestion.
 */

/** Lowest and highest value (bpm) that counts as plausible; matches the baseline limits (max HR up to 230). */
export const PLAUSIBLE_BPM = { min: 40, max: 230 } as const;

/** Seconds a level must be held to count. */
export const SUSTAIN_S = 5;

/** The highest sustained heart rate found. */
export type HeartRatePeak = {
  /** Highest level held for `SUSTAIN_S` seconds, whole bpm (the lowest value inside the best window). */
  bpm: number;
  /** Start of that stretch in stream time (seconds since the first point). */
  startOffsetS: number;
};

/** Highest plausible, sustained heart rate in one stream, or null when there is none. */
export function highestPlausibleHeartRate(
  stream: NumericStream | null | undefined,
): HeartRatePeak | null {
  if (!stream) return null;
  const gridded = toPerSecond(stream, DEFAULT_MAX_GAP_S);
  if (!gridded) return null;
  const { start, grid } = gridded;
  let bestBpm = -1;
  let bestStart = -1;
  for (let k = 0; k + SUSTAIN_S <= grid.length; k += 1) {
    let low = Infinity;
    for (let s = 0; s < SUSTAIN_S; s += 1) {
      const v = grid[k + s] as number;
      if (!(v >= PLAUSIBLE_BPM.min && v <= PLAUSIBLE_BPM.max)) {
        low = -Infinity;
        break;
      }
      if (v < low) low = v;
    }
    if (low > bestBpm) {
      bestBpm = low;
      bestStart = k;
    }
  }
  return bestStart === -1 || bestBpm < 0
    ? null
    : { bpm: Math.round(bestBpm), startOffsetS: start + bestStart };
}

/** A heart rate suggestion with the ride it came from. */
export type HeartRateSuggestion = HeartRatePeak & { rideId: string; ridesChecked: number };

/**
 * Highest sustained heart rate across rides, one at a time (pass a generator, newest first). Stops after
 * `maxRides` rides (default 60). On a tie the first (newest) ride wins. Null when no ride has a value.
 */
export async function findHighestHeartRate(
  rides: AsyncIterable<RideStream> | Iterable<RideStream>,
  options: { maxRides?: number; signal?: AbortSignal } = {},
): Promise<HeartRateSuggestion | null> {
  const maxRides = options.maxRides ?? 60;
  let best: (HeartRatePeak & { rideId: string }) | null = null;
  let checked = 0;
  if (maxRides < 1) return null;
  for await (const ride of rides) {
    if (options.signal?.aborted) break;
    checked += 1;
    const peak = highestPlausibleHeartRate(ride.stream);
    if (peak && (best === null || peak.bpm > best.bpm)) best = { ...peak, rideId: ride.id };
    if (checked >= maxRides) break;
  }
  return best ? { ...best, ridesChecked: checked } : null;
}

/** The 20-minute test is 20 minutes long; LTHR is read from its last 15 minutes (Z-PO8). */
export const LTHR_TEST_S = 20 * 60;
export const LTHR_WINDOW_S = 15 * 60;
/** At least this share of the 15 minutes must have a plausible reading, else there is no result. */
export const LTHR_MIN_COVERAGE = 0.9;

/**
 * LTHR from a 20-minute test: the average heart rate over the last 15 minutes of the 20 (the first 5
 * minutes are skipped). `testStartOffsetS` is where the 20-minute effort starts in stream time (seconds
 * since the first point), for example `BestEffort.startOffsetS` of the best 20-minute power. Dropouts
 * (zero) and values outside 40 to 230 bpm are left out; the result needs plausible readings for at least
 * 90 % of the 15 minutes, otherwise null. Whole bpm.
 */
export function lthrFrom20MinTest(
  stream: NumericStream | null | undefined,
  testStartOffsetS: number,
): number | null {
  if (!stream || !Number.isFinite(testStartOffsetS) || testStartOffsetS < 0) return null;
  const gridded = toPerSecond(stream, DEFAULT_MAX_GAP_S);
  if (!gridded) return null;
  const { start, grid } = gridded;
  const from = Math.round(testStartOffsetS) + (LTHR_TEST_S - LTHR_WINDOW_S) - start;
  const to = from + LTHR_WINDOW_S;
  if (from < 0 || to > grid.length) return null;
  let sum = 0;
  let count = 0;
  for (let i = from; i < to; i += 1) {
    const v = grid[i] as number;
    if (v >= PLAUSIBLE_BPM.min && v <= PLAUSIBLE_BPM.max) {
      sum += v;
      count += 1;
    }
  }
  return count >= LTHR_WINDOW_S * LTHR_MIN_COVERAGE ? Math.round(sum / count) : null;
}
