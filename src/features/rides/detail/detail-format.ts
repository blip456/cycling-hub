import type { Ride } from "../api";
import { averageSpeedKmh, formatDuration, formatSpeed, formatWhole, rideTags } from "../format";

const MISSING = "—";

const longDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Sun 11 Oct 2026 · 08:30 · Road · Commute" (B4: always with the year; Brussels wall clock, T11). */
export function detailDateLine(
  ride: Pick<Ride, "start_local" | "sport_type" | "commute" | "trainer">,
): string {
  const date = new Date(`${ride.start_local.slice(0, 10)}T00:00:00Z`);
  const time = ride.start_local.slice(11, 16);
  return [longDateFmt.format(date).replace(",", ""), time, ...rideTags(ride)].join(" · ");
}

const thousands = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Whole number with a thousands separator ("1,020"), "—" when missing. */
export function formatWholeGrouped(value: number | null | undefined): string {
  const whole = formatWhole(value);
  return whole === MISSING ? whole : thousands.format(Number(whole));
}

export type MetricColor = "time" | "speed" | "power" | "hr" | "elev" | null;

export interface DetailMetric {
  label: string;
  value: string;
  unit: string;
  /** Metric colour (P20); null for metrics without one (cadence). */
  color: MetricColor;
  missing: boolean;
}

function metric(label: string, value: string, unit: string, color: MetricColor): DetailMetric {
  return { label, value, unit, color, missing: value === MISSING };
}

/**
 * The stat tiles under the distance (B4): the fixed order of P10 first, then the stored maxima and
 * cadence. Values that are not in the export show "—" (P11).
 */
export function detailMetrics(ride: Ride): DetailMetric[] {
  return [
    metric("Moving time", formatDuration(ride.moving_time_s), "h", "time"),
    metric("Avg speed", formatSpeed(averageSpeedKmh(ride)), "km/h", "speed"),
    metric("Avg power", formatWhole(ride.average_watts), "W", "power"),
    metric("Avg heart rate", formatWhole(ride.average_heartrate), "bpm", "hr"),
    metric("Elevation", formatWholeGrouped(ride.elevation_m), "m", "elev"),
    metric("Avg cadence", formatWhole(ride.average_cadence), "rpm", null),
    metric("Max power", formatWhole(ride.max_watts), "W", "power"),
    metric("Max heart rate", formatWhole(ride.max_heartrate), "bpm", "hr"),
  ];
}

/** The ride on Strava (B4 "Open in Strava"). */
export function stravaActivityUrl(stravaId: number): string {
  return `https://www.strava.com/activities/${stravaId}`;
}
