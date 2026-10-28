/** GPX track points → route, averages, maxima and streams ("Averages from the GPX", "Streams"). */
import type { TrackPoint } from "./gpx";
import { routePolyline, type LatLng } from "./polyline";
import { summaryWithout, type GpxSummary, type Streams } from "./types";

/** A gap between points longer than this is a pause and does not count towards averages. */
export const PAUSE_SECONDS = 30;

type Value = (point: TrackPoint) => number | null;

/**
 * Time-weighted average over the gaps between points. Each gap (≤ 30 s) is weighted with the value
 * at the end of the gap; only points with a value count. Falls back to the plain mean when no gap
 * counts (a single point, or only pauses). Null when no point has a value.
 */
export function timeWeightedAverage(
  points: readonly TrackPoint[],
  value: Value,
  { skipZeros = false } = {},
): number | null {
  let weighted = 0;
  let weight = 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const v = value(point);
    if (v === null || (skipZeros && v === 0)) continue;
    sum += v;
    count++;
    const previous = points[i - 1];
    if (!previous || point.time === null || previous.time === null) continue;
    const gap = (point.time - previous.time) / 1000;
    if (gap > 0 && gap <= PAUSE_SECONDS) {
      weighted += v * gap;
      weight += gap;
    }
  }
  if (count === 0) return null;
  return Math.round(weight > 0 ? weighted / weight : sum / count);
}

export function maximum(points: readonly TrackPoint[], value: Value): number | null {
  let max: number | null = null;
  for (const point of points) {
    const v = value(point);
    if (v !== null && (max === null || v > max)) max = v;
  }
  return max === null ? null : Math.round(max);
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

function column(
  points: readonly TrackPoint[],
  value: Value,
  decimals: number,
): (number | null)[] | undefined {
  const values = points.map((point) => {
    const v = value(point);
    return v === null ? null : round(v, decimals);
  });
  return values.some((v) => v !== null) ? values : undefined;
}

/** Columnar streams, one entry per timed point, in time order. Null without timed points. */
export function buildStreams(timed: readonly TrackPoint[]): Streams | null {
  const first = timed[0];
  if (first?.time == null) return null;
  const t0 = first.time;
  const streams: Streams = {
    time: timed.map((point) => Math.round(((point.time ?? t0) - t0) / 1000)),
  };
  if (timed.some((point) => point.lat !== null)) {
    streams.latlng = timed.map((point) =>
      point.lat !== null && point.lon !== null ? [round(point.lat, 5), round(point.lon, 5)] : null,
    );
  }
  const optional = {
    altitude: column(timed, (p) => p.ele, 1),
    heartrate: column(timed, (p) => p.hr, 0),
    watts: column(timed, (p) => p.power, 0),
    cadence: column(timed, (p) => p.cad, 0),
    temperature: column(timed, (p) => p.temp, 0),
  };
  for (const [key, values] of Object.entries(optional)) {
    if (values) streams[key as keyof typeof optional] = values;
  }
  return streams;
}

/** The export values for a parsed GPX. A GPX without track points means "no_gpx". */
export function summarize(points: readonly TrackPoint[]): GpxSummary {
  if (points.length === 0) return summaryWithout("no_gpx");
  const route: LatLng[] = [];
  for (const point of points) {
    if (point.lat !== null && point.lon !== null) route.push([point.lat, point.lon]);
  }
  const timed = points
    .filter((point) => point.time !== null)
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return {
    details: "gpx",
    polyline: routePolyline(route),
    averageWatts: timeWeightedAverage(timed, (p) => p.power),
    maxWatts: maximum(timed, (p) => p.power),
    averageHeartrate: timeWeightedAverage(timed, (p) => p.hr, { skipZeros: true }),
    maxHeartrate: maximum(timed, (p) => p.hr),
    averageCadence: timeWeightedAverage(timed, (p) => p.cad, { skipZeros: true }),
    streams: buildStreams(timed),
  };
}
