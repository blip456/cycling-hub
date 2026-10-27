import type { Ride } from "../api";
import { averageSpeedKmh, rideTags } from "../format";

/** Byte order mark, so Excel reads the file as UTF-8 (accents in ride names). */
export const UTF8_BOM = "﻿";

/** RFC 4180 line ending. */
const CRLF = "\r\n";

export const CSV_COLUMNS = [
  "Date",
  "Name",
  "Type",
  "Tags",
  "Distance (km)",
  "Moving time",
  "Avg speed (km/h)",
  "Avg power (W)",
  "Avg heart rate (bpm)",
  "Elevation (m)",
  "Strava ID",
] as const;

/**
 * RFC 4180: a field with a comma, a double quote or a line break is quoted, and quotes inside are
 * doubled. Text that a spreadsheet would run as a formula (= + - @, tab, CR at the start) gets a
 * leading apostrophe first (OWASP CSV injection).
 */
export function csvField(value: string, { text = false }: { text?: boolean } = {}): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** "3:58:07" (h:mm:ss, a duration spreadsheets understand). */
function hms(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Empty cell for a missing value (not "—": spreadsheets should see no number). */
function number(value: number | null | undefined, digits: number): string {
  return value === null || value === undefined ? "" : value.toFixed(digits);
}

function csvRow(ride: Ride): string[] {
  const [type = ride.sport_type, ...tags] = rideTags(ride);
  return [
    // Brussels wall-clock time from the export (T5), "2026-10-14 15:27".
    `${ride.start_local.slice(0, 10)} ${ride.start_local.slice(11, 16)}`,
    csvField(ride.name, { text: true }),
    csvField(type),
    csvField(tags.join("; ")),
    number(ride.distance_m / 1000, 2),
    hms(ride.moving_time_s),
    number(averageSpeedKmh(ride), 1),
    number(ride.average_watts, 0),
    number(ride.average_heartrate, 0),
    number(ride.elevation_m, 0),
    String(ride.strava_id),
  ];
}

/**
 * The CSV export (P37): one header row and one row per ride, in the given order, with RFC 4180
 * escaping and CRLF line endings. Without the BOM (added when the file is built).
 */
export function ridesToCsv(rides: readonly Ride[]): string {
  const lines = [CSV_COLUMNS.join(","), ...rides.map((ride) => csvRow(ride).join(","))];
  return lines.join(CRLF) + CRLF;
}
