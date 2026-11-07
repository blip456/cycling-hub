import { DEFAULT_MAX_GAP_S, toPerSecond, type NumericStream, type RideStream } from "./streams";

/**
 * FTP from tests and from stored streams (P39, P41). Pure functions; unusable input gives null.
 *
 * Rules for a power stream (`docs/export-format.md`, T13):
 * - Points are laid on a per-second grid (`toPerSecond`): a point holds its power until the next point,
 *   as long as that gap is at most `maxGapS` (10 s); over a longer gap it holds for one second.
 * - Zero watts is real power (coasting) and counts. A null is a missing value, never zero.
 * - A run of missing seconds (nulls or gaps) of at most `maxGapS` inside a window is a dropout: its
 *   seconds count as 0 W, so a dropout can lower an average but never raise it.
 * - A longer run breaks the window: no window can contain it. Rides shorter than the window, or without
 *   an unbroken stretch that long, give null.
 */

/** Result of a best-effort search. */
export type BestEffort = {
  /** Average power of the best window in whole watts (rounded half up). */
  watts: number;
  /** Start of the window in stream time (seconds since the first point). */
  startOffsetS: number;
  /** Window length in seconds. */
  durationS: number;
};

/** Options for the best-effort search. */
export type BestEffortOptions = {
  /** Longest gap or dropout in seconds that is tolerated. Default 10. */
  maxGapS?: number;
};

/**
 * Best rolling average power over `durationS` seconds, or null when the stream is empty, malformed or has
 * no unbroken window of that length. Ties go to the earliest window.
 */
export function bestAveragePower(
  stream: NumericStream | null | undefined,
  durationS: number,
  options: BestEffortOptions = {},
): BestEffort | null {
  if (!stream || !Number.isInteger(durationS) || durationS < 1) return null;
  const maxGapS = options.maxGapS ?? DEFAULT_MAX_GAP_S;
  const gridded = toPerSecond(stream, maxGapS);
  if (!gridded || gridded.grid.length < durationS) return null;
  const { start, grid } = gridded;
  const n = grid.length;

  // Short dropouts inside the stream become 0 W; longer ones, and the ends, stay NaN (a break).
  const filled = new Float64Array(grid);
  let i = 0;
  while (i < n) {
    if (!Number.isNaN(grid[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && Number.isNaN(grid[j])) j += 1;
    if (i > 0 && j < n && j - i <= maxGapS) filled.fill(0, i, j);
    i = j;
  }

  // Prefix sums of power and of breaks, so every window is O(1).
  const sum = new Float64Array(n + 1);
  const breaks = new Int32Array(n + 1);
  for (let k = 0; k < n; k += 1) {
    const v = filled[k] as number;
    sum[k + 1] = (sum[k] as number) + (Number.isNaN(v) ? 0 : v);
    breaks[k + 1] = (breaks[k] as number) + (Number.isNaN(v) ? 1 : 0);
  }

  let bestSum = -1;
  let bestStart = -1;
  for (let k = 0; k + durationS <= n; k += 1) {
    if ((breaks[k + durationS] as number) - (breaks[k] as number) !== 0) continue;
    const total = (sum[k + durationS] as number) - (sum[k] as number);
    if (total > bestSum) {
      bestSum = total;
      bestStart = k;
    }
  }
  if (bestStart === -1) return null;
  return { watts: Math.round(bestSum / durationS), startOffsetS: start + bestStart, durationS };
}

/** Best 20-minute (1200 s) average power; see `bestAveragePower`. */
export function best20MinPower(
  stream: NumericStream | null | undefined,
  options?: BestEffortOptions,
): BestEffort | null {
  return bestAveragePower(stream, 20 * 60, options);
}

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** FTP from a 20-minute test: 95 % of the 20-minute average power, rounded to whole watts. */
export function ftpFrom20MinTest(avg20MinW: number | null | undefined): number | null {
  return positive(avg20MinW) ? Math.round(avg20MinW * 0.95) : null;
}

/**
 * FTP from a ramp test: 75 % of the best 1-minute power (the last completed step), rounded to whole
 * watts.
 */
export function ftpFromRampTest(bestMinuteW: number | null | undefined): number | null {
  return positive(bestMinuteW) ? Math.round(bestMinuteW * 0.75) : null;
}

/** An FTP suggestion taken from a ride (P41). The PO confirms it; nothing changes without that. */
export type FtpEstimate = {
  /** 95 % of the 20-minute average, whole watts. */
  ftp: number;
  /** The best 20-minute average power in whole watts. */
  avg20MinW: number;
  /** Id of the ride it came from, as given in the input. */
  rideId: string;
  /** Start of the 20-minute window in that ride, seconds since its first point. */
  startOffsetS: number;
  /** How many rides were looked at (with or without power). */
  ridesChecked: number;
};

export type EstimateOptions = {
  /** Most rides to look at before stopping. Default 60. */
  maxRides?: number;
  /** Stops the search between rides. */
  signal?: AbortSignal;
  /** Passed on to `bestAveragePower`. */
  maxGapS?: number;
};

/**
 * Best FTP suggestion across rides, one ride at a time, so streams never have to be in memory together:
 * pass a (async) generator that downloads each ride's stream when asked, newest first. Stops after
 * `maxRides` rides (default 60) or when the signal aborts. The highest 20-minute average wins; on a tie
 * the newer ride (the one that came first) wins. Rides without a usable stream are skipped. Returns
 * null when no ride has a 20-minute window.
 */
export async function findBestFtpEstimate(
  rides: AsyncIterable<RideStream> | Iterable<RideStream>,
  options: EstimateOptions = {},
): Promise<FtpEstimate | null> {
  const maxRides = options.maxRides ?? 60;
  let best: Omit<FtpEstimate, "ridesChecked"> | null = null;
  let checked = 0;
  if (maxRides < 1) return null;
  for await (const ride of rides) {
    if (options.signal?.aborted) break;
    checked += 1;
    const effort = best20MinPower(
      ride.stream,
      options.maxGapS === undefined ? undefined : { maxGapS: options.maxGapS },
    );
    const ftp = effort ? ftpFrom20MinTest(effort.watts) : null;
    if (effort && ftp !== null && (best === null || effort.watts > best.avg20MinW)) {
      best = {
        ftp,
        avg20MinW: effort.watts,
        rideId: ride.id,
        startOffsetS: effort.startOffsetS,
      };
    }
    if (checked >= maxRides) break;
  }
  return best ? { ...best, ridesChecked: checked } : null;
}
