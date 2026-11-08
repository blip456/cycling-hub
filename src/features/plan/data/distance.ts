/**
 * Estimated distance of planned sessions (P89). Plans are in time; this turns time into kilometres with a
 * speed trendline from the PO's own outdoor rides of the last 90 days. Pure: no React, no Supabase.
 *
 * The trendline is a weighted least-squares fit of moving speed (km/h) on effort (% of FTP) and climbing
 * (metres per km), weighted by moving time. A session's speed is the trendline at the session's effort
 * (the time-weighted % of FTP of its steps) and the PO's typical climbing, kept inside the speeds the PO
 * actually rode. With too few rides or no clear trend it falls back to the average speed.
 */
import { addDays, type IsoDate } from "@/features/athlete";
import type { Ride } from "@/features/rides/api";
import type { Step } from "../engine";
import type { PlanSession } from "./types";

/** Days of ride history the trendline uses. */
export const SPEED_WINDOW_DAYS = 90;
/** Rides with an effort needed for a trendline; with fewer the average speed is used. */
export const MIN_TREND_RIDES = 6;
/** Rides needed for any estimate. */
export const MIN_SPEED_RIDES = 3;

const MIN_RIDE_SECONDS = 20 * 60;
const MIN_RIDE_METRES = 5000;
const SPEED_RANGE_KMH: [number, number] = [8, 60];
/** Effort spread (standard deviation, % of FTP) needed to trust the slope. */
const MIN_EFFORT_SPREAD = 3;
/** Climbing spread (m per km) needed to use climbing in the fit. */
const MIN_CLIMB_SPREAD = 1;
/** All-out steps count as this % of FTP: speed does not grow with short sprints. */
const MAX_STEP_PERCENT = 120;
/** Sport types that are not ridden outdoors on your own power. */
const EXCLUDED_SPORTS = new Set(["VirtualRide", "EBikeRide", "EMountainBikeRide"]);

export type SpeedRide = Pick<
  Ride,
  | "start_local"
  | "sport_type"
  | "distance_m"
  | "moving_time_s"
  | "elevation_m"
  | "commute"
  | "trainer"
  | "average_watts"
  | "average_heartrate"
>;

export type SpeedModel =
  | {
      kind: "trend";
      /** km/h at 0 % of FTP and the typical climbing. */
      intercept: number;
      /** km/h per % of FTP. */
      slope: number;
      /** Slowest and fastest speed it may give (10th and 90th percentile of the rides). */
      range: [number, number];
      /** Rides the fit used. */
      rides: number;
    }
  | { kind: "average"; speed: number; rides: number };

/**
 * A ride's effort in % of FTP: average power over FTP, or, without power, the average heart rate as a
 * share of the lactate threshold heart rate mapped onto power (76 % of LTHR is about 65 % of FTP, the
 * middle of zone 2; 100 % of LTHR is FTP). Null without either.
 */
export function rideEffort(
  ride: Pick<SpeedRide, "average_watts" | "average_heartrate">,
  ftp: number | null,
  lthr: number | null,
): number | null {
  if (ride.average_watts !== null && ftp !== null && ftp > 0) {
    return (ride.average_watts / ftp) * 100;
  }
  if (ride.average_heartrate !== null && lthr !== null && lthr > 0) {
    const share = (ride.average_heartrate / lthr) * 100;
    return Math.max(0, 65 + ((100 - 65) / (100 - 76)) * (share - 76));
  }
  return null;
}

/** The outdoor rides of the window, with their speed, climbing and effort. */
function usableRides(
  rides: readonly SpeedRide[],
  today: IsoDate,
  ftp: number | null,
  lthr: number | null,
): { speed: number; climb: number; effort: number | null; weight: number }[] {
  const from = addDays(today, -SPEED_WINDOW_DAYS) ?? today;
  return rides.flatMap((ride) => {
    const date = ride.start_local.slice(0, 10);
    if (date <= from || date > today) return [];
    if (ride.trainer || ride.commute || EXCLUDED_SPORTS.has(ride.sport_type)) return [];
    if (ride.moving_time_s < MIN_RIDE_SECONDS || ride.distance_m < MIN_RIDE_METRES) return [];
    const km = ride.distance_m / 1000;
    const speed = km / (ride.moving_time_s / 3600);
    if (speed < SPEED_RANGE_KMH[0] || speed > SPEED_RANGE_KMH[1]) return [];
    return [
      {
        speed,
        climb: Math.max(0, ride.elevation_m) / km,
        effort: rideEffort(ride, ftp, lthr),
        weight: ride.moving_time_s / 3600,
      },
    ];
  });
}

function weightedMean(values: readonly number[], weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return values.reduce((sum, v, i) => sum + v * (weights[i] ?? 0), 0) / total;
}

function weightedSpread(values: readonly number[], weights: readonly number[]): number {
  const mean = weightedMean(values, weights);
  return Math.sqrt(
    weightedMean(
      values.map((v) => (v - mean) ** 2),
      weights,
    ),
  );
}

function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  const pairs = values.map((v, i) => [v, weights[i] ?? 0] as const).sort((a, b) => a[0] - b[0]);
  const half = pairs.reduce((sum, [, w]) => sum + w, 0) / 2;
  let seen = 0;
  for (const [value, weight] of pairs) {
    seen += weight;
    if (seen >= half) return value;
  }
  return pairs[pairs.length - 1]?.[0] ?? 0;
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const a = sorted[low] ?? 0;
  const b = sorted[high] ?? a;
  return a + (b - a) * (index - low);
}

/** Solves the weighted least squares `y = X b` by the normal equations; null when singular. */
function leastSquares(
  rows: readonly (readonly number[])[],
  y: readonly number[],
  weights: readonly number[],
): number[] | null {
  const n = rows[0]?.length ?? 0;
  const a = Array.from({ length: n }, () => Array<number>(n + 1).fill(0));
  rows.forEach((row, k) => {
    const w = weights[k] ?? 0;
    for (let i = 0; i < n; i += 1) {
      const ai = a[i];
      if (!ai) continue;
      for (let j = 0; j < n; j += 1) ai[j] = (ai[j] ?? 0) + w * (row[i] ?? 0) * (row[j] ?? 0);
      ai[n] = (ai[n] ?? 0) + w * (row[i] ?? 0) * (y[k] ?? 0);
    }
  });
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = r;
    }
    const top = a[pivot];
    if (!top || Math.abs(top[col] ?? 0) < 1e-9) return null;
    [a[col], a[pivot]] = [top, a[col] ?? top];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const row = a[r];
      if (!row) continue;
      const factor = (row[col] ?? 0) / (top[col] ?? 1);
      for (let j = col; j <= n; j += 1) row[j] = (row[j] ?? 0) - factor * (top[j] ?? 0);
    }
  }
  return a.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/** The speed trendline from the rides of the last 90 days; null with fewer than 3 usable rides. */
export function speedModel(input: {
  rides: readonly SpeedRide[];
  today: IsoDate;
  ftp: number | null;
  lthr: number | null;
}): SpeedModel | null {
  const usable = usableRides(input.rides, input.today, input.ftp, input.lthr);
  if (usable.length < MIN_SPEED_RIDES) return null;
  const average: SpeedModel = {
    kind: "average",
    speed: weightedMean(
      usable.map((r) => r.speed),
      usable.map((r) => r.weight),
    ),
    rides: usable.length,
  };

  const withEffort = usable.flatMap((r) => (r.effort === null ? [] : [{ ...r, effort: r.effort }]));
  if (withEffort.length < MIN_TREND_RIDES) return average;
  const weights = withEffort.map((r) => r.weight);
  const efforts = withEffort.map((r) => r.effort);
  const climbs = withEffort.map((r) => r.climb);
  const speeds = withEffort.map((r) => r.speed);
  if (weightedSpread(efforts, weights) < MIN_EFFORT_SPREAD) return average;

  const typicalClimb = weightedMedian(climbs, weights);
  const useClimb = weightedSpread(climbs, weights) >= MIN_CLIMB_SPREAD;
  // Climbing is centred on the typical value, so the intercept is the speed on typical terrain.
  const fit = useClimb
    ? leastSquares(
        withEffort.map((r) => [1, r.effort, r.climb - typicalClimb]),
        speeds,
        weights,
      )
    : leastSquares(
        withEffort.map((r) => [1, r.effort]),
        speeds,
        weights,
      );
  const [intercept, slope] = fit ?? [];
  if (intercept === undefined || slope === undefined || !(slope > 0)) return average;
  return {
    kind: "trend",
    intercept,
    slope,
    range: [percentile(speeds, 0.1), percentile(speeds, 0.9)],
    rides: withEffort.length,
  };
}

/** A session's effort: the time-weighted % of FTP of its steps (all-out steps count as 120 %). */
export function sessionEffort(
  steps: readonly Pick<Step, "durationSec" | "target">[],
): number | null {
  const seconds = steps.reduce((sum, s) => sum + s.durationSec, 0);
  if (seconds <= 0) return null;
  return (
    steps.reduce(
      (sum, s) => sum + Math.min(s.target.percentFtp, MAX_STEP_PERCENT) * s.durationSec,
      0,
    ) / seconds
  );
}

/** The speed in km/h for an effort in % of FTP (null effort: the middle of the range). */
export function speedFor(model: SpeedModel, effort: number | null): number {
  if (model.kind === "average") return model.speed;
  const [low, high] = model.range;
  if (effort === null) return (low + high) / 2;
  return Math.min(high, Math.max(low, model.intercept + model.slope * effort));
}

/** What a distance needs of a session. */
export type DistanceSession = Pick<
  PlanSession,
  "kind" | "durationMin" | "indoor" | "status" | "activityId"
> & { steps: readonly Pick<Step, "durationSec" | "target">[] };

/**
 * The distance of a session in km: the ride's distance when a ride is linked (`estimated: false`), else the
 * estimate for an outdoor session. Null for the event, indoor sessions, skipped sessions and without a model.
 */
export function sessionDistance(
  session: DistanceSession,
  model: SpeedModel | null,
  ridesById: ReadonlyMap<string, Pick<SpeedRide, "distance_m">>,
): { km: number; estimated: boolean } | null {
  if (session.kind === "event" || session.status === "skipped") return null;
  const ride = session.activityId ? ridesById.get(session.activityId) : undefined;
  if (ride) return { km: ride.distance_m / 1000, estimated: false };
  if (session.indoor || model === null || session.durationMin <= 0) return null;
  const km = (speedFor(model, sessionEffort(session.steps)) * session.durationMin) / 60;
  return { km, estimated: true };
}

/** The kilometres of a list of sessions; null when none of them has a distance. */
export function totalKm(
  sessions: readonly DistanceSession[],
  model: SpeedModel | null,
  ridesById: ReadonlyMap<string, Pick<SpeedRide, "distance_m">>,
): number | null {
  const values = sessions.flatMap((s) => {
    const distance = sessionDistance(s, model, ridesById);
    return distance ? [distance.km] : [];
  });
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0);
}

/** "44 km", or "about 44 km" for an estimate (whole km; at least 1). */
export function formatKm(km: number, estimated = true): string {
  const text = `${String(Math.max(1, Math.round(km)))} km`;
  return estimated ? `about ${text}` : text;
}
