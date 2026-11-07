import {
  heartRateZones,
  powerZones,
  readChannel,
  toPerSecond,
  zoneForValue,
  type Zone,
} from "@/features/athlete";
import type { RideMetrics } from "./types";

/** Normalised power needs a 30 second rolling average, so it is not given for rides shorter than this. */
const NP_WINDOW_S = 30;

/** Seconds per zone to minutes in each zone, index 0 is Z1. Seconds outside every zone (missing data) are not counted. */
function zoneMinutes(grid: Float64Array, zones: readonly Zone[]): number[] {
  const seconds = zones.map(() => 0);
  for (const value of grid) {
    if (Number.isNaN(value)) continue;
    const zone = zoneForValue(zones, value);
    if (zone !== null) seconds[zone.index - 1] = (seconds[zone.index - 1] ?? 0) + 1;
  }
  return seconds.map((s) => s / 60);
}

/**
 * Normalised power: the fourth root of the mean of the fourth powers of the 30 second rolling average.
 * Seconds without data count as 0 W (coasting). Null for a ride shorter than 30 seconds.
 */
export function normalizedPower(grid: Float64Array): number | null {
  if (grid.length < NP_WINDOW_S) return null;
  let windowSum = 0;
  let fourth = 0;
  let count = 0;
  const value = (i: number) => {
    const v = grid[i];
    return v === undefined || Number.isNaN(v) ? 0 : v;
  };
  for (let i = 0; i < grid.length; i += 1) {
    windowSum += value(i);
    if (i >= NP_WINDOW_S) windowSum -= value(i - NP_WINDOW_S);
    if (i >= NP_WINDOW_S - 1) {
      fourth += (windowSum / NP_WINDOW_S) ** 4;
      count += 1;
    }
  }
  return count === 0 ? null : (fourth / count) ** 0.25;
}

/**
 * Normalised power and the minutes per power and heart rate zone from a ride's stored streams. Power
 * results need an FTP, heart rate results need an LTHR or a maximum heart rate; a missing channel gives
 * null for its results. Never throws: an unreadable stream gives all null.
 */
export function rideMetrics(
  streams: unknown,
  baseline: { ftp: number | null; lthr: number | null; maxHr: number | null },
): RideMetrics {
  const result: RideMetrics = {
    normalizedPowerW: null,
    powerZoneMinutes: null,
    hrZoneMinutes: null,
  };
  const watts = readChannel(streams, "watts");
  const power = watts === null ? null : toPerSecond(watts);
  if (power !== null) {
    const np = normalizedPower(power.grid);
    result.normalizedPowerW = np === null ? null : Math.round(np);
    const zones = powerZones(baseline.ftp);
    if (zones !== null) result.powerZoneMinutes = zoneMinutes(power.grid, zones);
  }
  const heartrate = readChannel(streams, "heartrate");
  const heart = heartrate === null ? null : toPerSecond(heartrate);
  const hrZones = heartRateZones(baseline);
  if (heart !== null && hrZones !== null) {
    // A zero is a sensor dropout (streams contract), not a heart rate.
    const cleaned = heart.grid.map((v) => (v > 0 ? v : Number.NaN));
    result.hrZoneMinutes = zoneMinutes(cleaned, hrZones.zones);
  }
  return result;
}
