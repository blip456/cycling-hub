import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { ImportActivity, SkippedActivity } from "./parse";
import { streamsObjectName } from "./streams";

/** One row of the import history (C5). */
export type ImportRecord = Database["public"]["Tables"]["imports"]["Row"];

/** Newest first; the history is short (one file a week, P3), so one page is enough. */
export const HISTORY_LIMIT = 100;

/** Saves the valid activities of one file in one database call (all-or-nothing, backlog item 5). */
export async function importActivities(input: {
  fileName: string;
  activities: ImportActivity[];
  skipped: SkippedActivity[];
}): Promise<ImportRecord> {
  const { data, error } = await getSupabase().rpc("import_activities", {
    file_name: fileNameForHistory(input.fileName),
    activities: input.activities,
    skipped: input.skipped,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** History row for a file that is not a valid export (P33). Nothing else changes. */
export async function logNotImported(input: {
  fileName: string;
  reason: string;
}): Promise<ImportRecord> {
  const { data, error } = await getSupabase().rpc("log_not_imported", {
    file_name: fileNameForHistory(input.fileName),
    reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchImportHistory(): Promise<ImportRecord[]> {
  const { data, error } = await getSupabase()
    .from("imports")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchImport(id: string): Promise<ImportRecord | null> {
  const { data, error } = await getSupabase()
    .from("imports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ---- ride streams in Storage (T12) --------------------------------------------------------------

/** The private bucket with one gzipped streams file per ride (migration 20261028120000). */
export const STREAMS_BUCKET = "streams";

/** What the database knows about a ride's stored streams. */
export type StoredStreamsState = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "strava_id" | "is_ride" | "deleted_at" | "streams_sha256"
>;

/** IDs per request, so the query string stays short for a big backfill. */
const STATE_CHUNK = 200;

export async function fetchStreamsState(
  stravaIds: readonly number[],
): Promise<StoredStreamsState[]> {
  const rows: StoredStreamsState[] = [];
  for (let i = 0; i < stravaIds.length; i += STATE_CHUNK) {
    const { data, error } = await getSupabase()
      .from("activities")
      .select("strava_id, is_ride, deleted_at, streams_sha256")
      .in("strava_id", stravaIds.slice(i, i + STATE_CHUNK));
    if (error) throw new Error(error.message);
    rows.push(...data);
  }
  return rows;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error(error?.message ?? "Not signed in");
  return id;
}

/** Uploads (or replaces) one ride's gzipped streams at `streams/{uid}/{strava_id}.json.gz`. */
export async function uploadRideStreams(input: { stravaId: number; body: Blob }): Promise<void> {
  const name = streamsObjectName(await currentUserId(), input.stravaId);
  // supabase-js sends a Blob as form data with the blob's own type (contentType is ignored), and the
  // bucket only accepts gzip or JSON, so the type goes on the blob.
  const body = new Blob([input.body], { type: "application/gzip" });
  const { error } = await getSupabase().storage.from(STREAMS_BUCKET).upload(name, body, {
    upsert: true,
    contentType: "application/gzip",
  });
  if (error) throw new Error(error.message);
}

/** Records the hash and size of the stored streams on the ride's row. */
export async function markStreamsSaved(input: {
  stravaId: number;
  sha256: string;
  points: number;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("activities")
    .update({ streams_sha256: input.sha256, streams_points: input.points })
    .eq("strava_id", input.stravaId);
  if (error) throw new Error(error.message);
}

/** The database keeps 1–255 characters. */
export function fileNameForHistory(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "Unnamed file" : trimmed.slice(0, 255);
}
