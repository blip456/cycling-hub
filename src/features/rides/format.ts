import type { Ride } from "./api";

/**
 * Formatting and grouping for rides (P6: metric units, Europe/Brussels). `start_local` is the Brussels
 * wall-clock time from the export (T5), so dates and weeks are read from it directly, with no time-zone
 * maths.
 */

const MISSING = "—"; // P11: shown when a value is not in the export (yet)

/** Wall-clock parts of `YYYY-MM-DDTHH:MM[:SS]`. */
function localParts(local: string): { date: Date; hour: string; minute: string } {
  const date = new Date(`${local.slice(0, 10)}T00:00:00Z`);
  return { date, hour: local.slice(11, 13), minute: local.slice(14, 16) };
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dayMonthFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const dayMonthYearFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthYearFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "Sun 12 Oct · 08:14" (the year is added when it is not the current one). */
export function formatRideDate(local: string, now: Date = new Date()): string {
  const { date, hour, minute } = localParts(local);
  const sameYear = date.getUTCFullYear() === now.getFullYear();
  const day = (sameYear ? dayMonthFmt : dayMonthYearFmt).format(date);
  return `${weekdayFmt.format(date)} ${day} · ${hour}:${minute}`;
}

/** "111.1" (km, one decimal). */
export function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

/** "3:58" (h:mm). */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** Average speed in km/h from distance and moving time; "—" without moving time. */
export function averageSpeedKmh(ride: Pick<Ride, "distance_m" | "moving_time_s">): number | null {
  if (ride.moving_time_s <= 0) return null;
  return ride.distance_m / 1000 / (ride.moving_time_s / 3600);
}

export function formatSpeed(kmh: number | null): string {
  return kmh === null ? MISSING : kmh.toFixed(1);
}

/** Watts, bpm, metres: whole numbers, "—" when missing. */
export function formatWhole(value: number | null | undefined): string {
  return value === null || value === undefined ? MISSING : String(Math.round(value));
}

/** Tags shown on a ride (P11): the sport when it is not a plain road ride, commute and indoor. */
export function rideTags(ride: Pick<Ride, "sport_type" | "commute" | "trainer">): string[] {
  const sport: Record<string, string> = {
    Ride: "Road",
    MountainBikeRide: "MTB",
    GravelRide: "Gravel",
    EBikeRide: "E-bike",
    EMountainBikeRide: "E-MTB",
    VirtualRide: "Virtual",
    Velomobile: "Velomobile",
    Handcycle: "Handcycle",
  };
  const tags = [sport[ride.sport_type] ?? ride.sport_type];
  if (ride.commute) tags.push("Commute");
  if (ride.trainer && ride.sport_type !== "VirtualRide") tags.push("Indoor");
  return tags;
}

export interface Totals {
  rides: number;
  distanceM: number;
  movingTimeS: number;
  elevationM: number;
}

export function totals(rides: readonly Ride[]): Totals {
  return rides.reduce<Totals>(
    (sum, ride) => ({
      rides: sum.rides + 1,
      distanceM: sum.distanceM + ride.distance_m,
      movingTimeS: sum.movingTimeS + ride.moving_time_s,
      elevationM: sum.elevationM + ride.elevation_m,
    }),
    { rides: 0, distanceM: 0, movingTimeS: 0, elevationM: 0 },
  );
}

export type GroupBy = "week" | "month";

export interface RideGroup {
  key: string;
  /** "Week 41 · 6–12 Oct" or "October 2026". */
  label: string;
  rides: Ride[];
  totals: Totals;
}

/** ISO 8601 week (Monday start) of a UTC-midnight date. */
function isoWeek(date: Date): { year: number; week: number; monday: Date } {
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000));
  return { year, week, monday };
}

function weekLabel(week: number, monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const start = sameMonth ? String(monday.getUTCDate()) : dayMonthFmt.format(monday);
  return `Week ${week} · ${start}–${dayMonthFmt.format(sunday)}`;
}

/**
 * Groups rides by ISO week or calendar month (P11), keeping the order of `rides` (newest first in the
 * default list) for the groups and for the rides inside them.
 */
export function groupRides(rides: readonly Ride[], by: GroupBy): RideGroup[] {
  const groups = new Map<string, { label: string; rides: Ride[] }>();
  for (const ride of rides) {
    const { date } = localParts(ride.start_local);
    let key: string;
    let label: string;
    if (by === "week") {
      const { year, week, monday } = isoWeek(date);
      key = `${year}-W${String(week).padStart(2, "0")}`;
      label = weekLabel(week, monday);
    } else {
      key = ride.start_local.slice(0, 7);
      label = monthYearFmt.format(date);
    }
    const group = groups.get(key);
    if (group) group.rides.push(ride);
    else groups.set(key, { label, rides: [ride] });
  }
  return [...groups].map(([key, group]) => ({ key, ...group, totals: totals(group.rides) }));
}
