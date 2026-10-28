import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import { readStreams, type Streams } from "./streams";

/**
 * Reads an export file from the Cycling Hub Chrome extension (P2) in two levels (P14):
 *
 * 1. The file: JSON, an object with a supported `version` and an `activities` array. If this fails the
 *    whole file is rejected and nothing changes (it only gets a "Not imported" history row, P33).
 * 2. Every activity: broken ones are skipped and listed as `activities[i].field` with a reason; the
 *    valid ones are normalised for `import_activities()`.
 *
 * Unknown fields are allowed everywhere and kept in `raw` (T6). The contract is
 * `docs/export-format.md`. v1 and v2 activities have the same field names; v2 adds optional fields
 * (`startDate`, `elapsedTime`, `description`, `details`, ...) and `streams`. Every activity is read on
 * its own, so a v2 file may hold v1-shaped activities (the app's own JSON export does).
 *
 * `streams` (v2) never goes into `raw`: valid streams are returned next to the activities and saved in
 * Storage after the import (T12); invalid ones are dropped and counted, the activity still imports.
 */

/**
 * Export versions this parser reads. v1: the sample `activities.json` (15 Oct 2026). v2: the Chrome
 * extension and the app's own JSON export (T12).
 */
export const SUPPORTED_VERSIONS: readonly number[] = [1, 2];

/**
 * Files above this size are rejected before reading. A v1 backfill is under 1 MB; with streams about
 * 200 rides × 2 h at 1 s is 30–60 MB of JSON, so this leaves room for several years.
 */
export const MAX_FILE_BYTES = 250 * 1024 * 1024;

type JsonObject = { [key: string]: Json | undefined };

/** One valid activity, keyed like the `activities` columns (the `import_activities()` contract). */
export type ImportActivity = {
  strava_id: number;
  name: string;
  sport_type: string;
  /** Brussels wall-clock time without zone, `YYYY-MM-DDTHH:MM:SS` (T11). */
  start_local: string;
  distance_m: number;
  moving_time_s: number;
  elevation_m: number;
  commute: boolean;
  trainer: boolean;
  polyline: string | null;
  average_watts: number | null;
  max_watts: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  raw: JsonObject;
};

export type ActivityIssue = {
  /** `activities[i]` or `activities[i].field` (i is zero-based, as in the file). */
  path: string;
  /** Reason, written to follow the path: "is missing", "must be a number (metres)". */
  message: string;
};

export type SkippedActivity = {
  /** Zero-based position in the file's `activities` array. */
  index: number;
  name: string | null;
  startLocal: string | null;
  issues: ActivityIssue[];
};

/** Valid per-second data of one activity, kept out of `raw` (T12). */
export type ActivityStreams = { stravaId: number; streams: Streams };

/** An activity whose `streams` did not match the contract: dropped, the activity was imported. */
export type DroppedStreams = { stravaId: number; reason: string };

export type FileRejection = {
  /** Shown on C4 and stored as the history row's reason. */
  message: string;
  /** Technical detail for "Copy error details" (e.g. the JSON parser's message). */
  detail: string | null;
};

export type ParseResult =
  | {
      ok: true;
      version: number;
      /** Activities in the file, valid and skipped. */
      total: number;
      activities: ImportActivity[];
      skipped: SkippedActivity[];
      /** One entry per imported activity with valid streams. */
      streams: ActivityStreams[];
      droppedStreams: DroppedStreams[];
    }
  | ({ ok: false } & FileRejection);

const NOT_AN_EXPORT = "This is not a Cycling Hub export";

export function rejectTooLarge(bytes: number): FileRejection | null {
  if (bytes <= MAX_FILE_BYTES) return null;
  return {
    message: `This file is too large: an export is at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    detail: `${bytes} bytes`,
  };
}

// ---- level 1: the file --------------------------------------------------------------------------

const fileShape = z.looseObject({
  version: z.unknown().optional(),
  activities: z.unknown().optional(),
});

export function parseExport(text: string): ParseResult {
  if (text.trim() === "") {
    return { ok: false, message: `${NOT_AN_EXPORT}: the file is empty.`, detail: null };
  }

  let data: Json;
  try {
    data = JSON.parse(text) as Json;
  } catch (error) {
    return {
      ok: false,
      message: `${NOT_AN_EXPORT}: the file is not valid JSON.`,
      detail: error instanceof Error ? error.message : null,
    };
  }

  const file = fileShape.safeParse(data);
  if (!file.success || Array.isArray(data)) {
    return {
      ok: false,
      message: `${NOT_AN_EXPORT}: the file has no activities list.`,
      detail: null,
    };
  }
  const { version, activities } = file.data;
  if (!Array.isArray(activities)) {
    return {
      ok: false,
      message: `${NOT_AN_EXPORT}: the file has no activities list.`,
      detail: null,
    };
  }
  if (version === undefined) {
    return { ok: false, message: `${NOT_AN_EXPORT}: the file has no version.`, detail: null };
  }
  if (typeof version !== "number" || !SUPPORTED_VERSIONS.includes(version)) {
    return {
      ok: false,
      message: `Export version ${JSON.stringify(version)} is not supported yet.`,
      detail: `Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
    };
  }

  return { ok: true, version, total: activities.length, ...parseActivities(activities as Json[]) };
}

// ---- level 2: every activity --------------------------------------------------------------------

/** `YYYY-MM-DDTHH:MM:SS`, optional fraction, optional zone: `Z` or `±HH:MM` / `±HHMM`. */
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** The time zone of every start time in the app (P5, T11). */
export const RIDE_TIME_ZONE = "Europe/Brussels";

const brusselsParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: RIDE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** An instant (ms since epoch) as Brussels wall-clock time `YYYY-MM-DDTHH:MM:SS`, DST included. */
export function toBrusselsWallClock(epochMs: number): string {
  const part = Object.fromEntries(
    brusselsParts.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`;
}

/**
 * `startDateLocal` as Brussels wall-clock time `YYYY-MM-DDTHH:MM:SS` (T11), or null when it is not a
 * real calendar date and time:
 *
 * - without a zone (export v2): already Brussels wall-clock time, kept as it is;
 * - with a trailing `Z` (v1 files): UTC, converted to Brussels time (`15:27:43Z` in October → `17:27:43`);
 * - with an offset (`+02:00`): that instant, converted to Brussels time.
 *
 * Fractions of a second are dropped.
 */
export function toLocalDateTime(value: string): string | null {
  const m = DATE_TIME.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const zone = m[7];
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const date = new Date(wall);
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    date.getUTCHours() === h &&
    date.getUTCMinutes() === mi &&
    date.getUTCSeconds() === s;
  if (!valid) return null;
  if (zone === undefined) return value.slice(0, 19);
  if (zone === "Z") return toBrusselsWallClock(wall);

  const offset = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
  const [sign, oh, om] = [offset?.[1], Number(offset?.[2]), Number(offset?.[3])];
  if (oh > 14 || om > 59) return null;
  const minutes = (sign === "-" ? -1 : 1) * (oh * 60 + om);
  return toBrusselsWallClock(wall - minutes * 60_000);
}

const missingOr = (message: string) => (issue: { input: unknown }) =>
  issue.input === undefined || issue.input === null ? "is missing" : message;

const metres = z
  .number({ error: missingOr("must be a number (metres)") })
  .min(0, { error: "must be 0 or more (metres)" });

const activityShape = z.looseObject({
  id: z
    .number({ error: missingOr("must be a number") })
    .int({ error: "must be a whole number" })
    .positive({ error: "must be a positive number" }),
  name: z.string({ error: missingOr("must be text") }),
  sportType: z.string({ error: missingOr("must be text") }).min(1, { error: "is empty" }),
  startDateLocal: z
    .string({ error: missingOr("must be a date and time") })
    .refine((v) => toLocalDateTime(v) !== null, { error: "is not a valid date" }),
  distance: metres,
  movingTime: z
    .number({ error: missingOr("must be a number (seconds)") })
    .min(0, { error: "must be 0 or more (seconds)" }),
  // Elevation gain; never negative in Strava data.
  elevation: z
    .number({ error: missingOr("must be a number (metres)") })
    .min(0, { error: "must be 0 or more (metres)" }),
  commute: z.boolean({ error: "must be true or false" }).nullish(),
  trainer: z.boolean({ error: "must be true or false" }).nullish(),
});

/** Optional numbers (export v2): used when they are valid, otherwise left empty; `raw` keeps them. */
function optionalNumber(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseActivities(items: Json[]): {
  activities: ImportActivity[];
  skipped: SkippedActivity[];
  streams: ActivityStreams[];
  droppedStreams: DroppedStreams[];
} {
  const activities: ImportActivity[] = [];
  const skipped: SkippedActivity[] = [];
  const streams: ActivityStreams[] = [];
  const droppedStreams: DroppedStreams[] = [];
  const seen = new Set<number>();

  items.forEach((item, index) => {
    const at = `activities[${index}]`;
    if (!isObject(item)) {
      skipped.push({
        index,
        name: null,
        startLocal: null,
        issues: [{ path: at, message: "is not an activity" }],
      });
      return;
    }

    const name = typeof item.name === "string" ? item.name : null;
    const startLocal =
      typeof item.startDateLocal === "string" ? toLocalDateTime(item.startDateLocal) : null;
    const result = activityShape.safeParse(item);

    if (!result.success) {
      const issues: ActivityIssue[] = [];
      const fields = new Set<string>();
      for (const issue of result.error.issues) {
        const field = issue.path.map(String).join(".");
        // One reason per field is enough.
        if (fields.has(field)) continue;
        fields.add(field);
        issues.push({ path: field ? `${at}.${field}` : at, message: issue.message });
      }
      skipped.push({ index, name, startLocal, issues });
      return;
    }

    const a = result.data;
    // The same ID twice in one file: the first one is imported, later copies are ignored (T10).
    if (seen.has(a.id)) return;
    seen.add(a.id);

    // Streams stay out of raw: the row stays small and a re-import compares the same raw (T12).
    const { streams: rawStreams, ...raw } = item;
    const reading = readStreams(rawStreams);
    if (reading.kind === "valid") streams.push({ stravaId: a.id, streams: reading.streams });
    if (reading.kind === "invalid") droppedStreams.push({ stravaId: a.id, reason: reading.reason });

    activities.push({
      strava_id: a.id,
      name: a.name.trim(),
      sport_type: a.sportType,
      start_local: toLocalDateTime(a.startDateLocal) ?? a.startDateLocal,
      distance_m: a.distance,
      moving_time_s: Math.round(a.movingTime),
      elevation_m: a.elevation,
      commute: a.commute ?? false,
      trainer: a.trainer ?? false,
      polyline: typeof item.polyline === "string" && item.polyline !== "" ? item.polyline : null,
      average_watts: optionalNumber(item.averageWatts),
      max_watts: optionalNumber(item.maxWatts),
      average_heartrate: optionalNumber(item.averageHeartrate),
      max_heartrate: optionalNumber(item.maxHeartrate),
      average_cadence: optionalNumber(item.averageCadence),
      raw,
    });
  });

  return { activities, skipped, streams, droppedStreams };
}

// ---- stored errors ------------------------------------------------------------------------------

const storedSkipped = z.array(
  z.object({
    index: z.number(),
    name: z.string().nullable().catch(null),
    startLocal: z.string().nullable().catch(null),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).catch([]),
  }),
);

/** Reads `imports.errors` back; anything unexpected becomes an empty list. */
export function readStoredSkipped(errors: Json): SkippedActivity[] {
  const result = storedSkipped.safeParse(errors);
  return result.success ? result.data : [];
}
