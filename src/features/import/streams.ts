import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Per-second ride data from export v2 (T12, `docs/export-format.md` "Streams"): columnar arrays of
 * equal length, one entry per GPX track point. Not stored in the database row; the import saves it
 * per ride in the private Storage bucket `streams` after the file is saved.
 */
export type Streams = {
  time: number[];
  latlng?: ([number, number] | null)[];
  [key: string]: Json[] | undefined;
};

/** Keys whose entries are a number or null (every known key except `time` and `latlng`). */
const NUMERIC_KEYS = ["altitude", "heartrate", "watts", "cadence", "temperature"] as const;

/**
 * The contract, checked with plain loops inside Zod: a backfill has millions of points, and a schema
 * per entry would make the check several times slower.
 */
const streamsShape = z
  .looseObject({ time: z.array(z.unknown()).min(1) })
  .superRefine((value, ctx) => {
    const time = value.time;
    let previous = -Infinity;
    for (let i = 0; i < time.length; i += 1) {
      const t = time[i];
      if (typeof t !== "number" || !Number.isInteger(t) || t < 0 || t < previous) {
        ctx.addIssue({
          code: "custom",
          path: ["time", i],
          message: "must be whole seconds in time order",
        });
        return;
      }
      previous = t;
    }
    for (const [key, column] of Object.entries(value)) {
      if (key === "time") continue;
      if (!Array.isArray(column) || column.length !== time.length) {
        ctx.addIssue({ code: "custom", path: [key], message: "must have one entry per point" });
        return;
      }
      const bad =
        key === "latlng"
          ? column.findIndex((p) => p !== null && !isLatLng(p))
          : (NUMERIC_KEYS as readonly string[]).includes(key)
            ? column.findIndex((v) => v !== null && !isFiniteNumber(v))
            : -1; // Unknown keys are kept as they are (contract).
      if (bad !== -1) {
        ctx.addIssue({ code: "custom", path: [key, bad], message: "is not a valid value" });
        return;
      }
    }
  });

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLatLng(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    Math.abs(value[0]) <= 90 &&
    Math.abs(value[1]) <= 180
  );
}

export type StreamsReading =
  { kind: "none" } | { kind: "valid"; streams: Streams } | { kind: "invalid"; reason: string };

/** Reads an activity's `streams` field: absent or null is "none"; anything off the contract is "invalid". */
export function readStreams(value: Json | undefined): StreamsReading {
  if (value === undefined || value === null) return { kind: "none" };
  const result = streamsShape.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.map(String).join(".") ?? "";
    // Our own checks have readable messages; Zod's shape errors get a short one.
    const message = issue?.code === "custom" ? issue.message : "is not valid";
    return { kind: "invalid", reason: `streams${path ? `.${path}` : ""} ${message}` };
  }
  return { kind: "valid", streams: result.data as Streams };
}

/**
 * The stored file's content: the streams with their keys in alphabetical order, so the same data
 * always gives the same text and the same hash (whatever order the export wrote the keys in).
 */
export function canonicalStreamsJson(streams: Streams): string {
  const sorted: Record<string, Json[] | undefined> = {};
  for (const key of Object.keys(streams).sort()) sorted[key] = streams[key];
  return JSON.stringify(sorted);
}

/** SHA-256 of the text as lower-case hex (Web Crypto). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compresses text to a gzip blob. Abstracted because jsdom (tests) has no CompressionStream. */
export type Gzip = (text: string) => Promise<Blob>;

export const gzipText: Gzip = async (text) => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
};

/** Storage object name inside the `streams` bucket: the user's folder, then the Strava ID (T12). */
export function streamsObjectName(userId: string, stravaId: number): string {
  return `${userId}/${String(stravaId)}.json.gz`;
}
