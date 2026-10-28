import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Reads an export file from the Cycling Hub Chrome extension (P2) in two levels (P14):
 *
 * 1. The file: JSON, an object with a supported `version` and an `activities` array. If this fails the
 *    whole file is rejected and nothing changes (it only gets a "Not imported" history row, P33).
 * 2. Every activity: broken ones are skipped and listed as `activities[i].field` with a reason; the
 *    valid ones are normalised for `import_activities()`.
 *
 * Unknown fields are allowed everywhere and kept in `raw` (T6), so export v2 (Q1) can add power, heart
 * rate, cadence, tags or a UTC start without breaking this parser.
 */

/** Export versions this parser reads. v1: the sample `activities.json` (15 Oct 2026). */
export const SUPPORTED_VERSIONS: readonly number[] = [1];

/** Files above this size are rejected before reading (a 2-year backfill is well under 1 MB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

type JsonObject = { [key: string]: Json | undefined };

/** One valid activity, keyed like the `activities` columns (the `import_activities()` contract). */
export type ImportActivity = {
  strava_id: number;
  name: string;
  sport_type: string;
  /** Brussels wall-clock time without zone, `YYYY-MM-DDTHH:MM:SS` (T5). */
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

/** `YYYY-MM-DDTHH:MM:SS`, optional fraction; a trailing `Z` is ignored (T5: it is local time). */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/;

/** Returns `YYYY-MM-DDTHH:MM:SS` for a real calendar date and time, otherwise null. */
export function toLocalDateTime(value: string): string | null {
  const m = LOCAL_DATE_TIME.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    date.getUTCHours() === h &&
    date.getUTCMinutes() === mi &&
    date.getUTCSeconds() === s;
  return valid ? value.slice(0, 19) : null;
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
} {
  const activities: ImportActivity[] = [];
  const skipped: SkippedActivity[] = [];
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
      raw: item,
    });
  });

  return { activities, skipped };
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
