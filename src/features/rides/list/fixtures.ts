import type { Ride } from "../api";

/** Test rides (used by the list tests only). `start_at` follows `start_local` (Brussels summer time). */
export function makeRide(overrides: Partial<Ride> & { start_local?: string } = {}): Ride {
  const startLocal = overrides.start_local ?? "2026-10-12T08:14:00";
  const startAt = new Date(`${startLocal}Z`);
  startAt.setUTCHours(startAt.getUTCHours() - 2);
  return {
    id: overrides.id ?? startLocal,
    strava_id: 1,
    name: "Morning Ride",
    sport_type: "Ride",
    start_local: startLocal,
    start_at: startAt.toISOString(),
    distance_m: 40_000,
    moving_time_s: 3600,
    elevation_m: 300,
    commute: false,
    trainer: false,
    average_watts: null,
    max_watts: null,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    polyline: null,
    ...overrides,
  };
}
