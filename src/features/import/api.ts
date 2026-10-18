import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { ImportActivity, SkippedActivity } from "./parse";

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

/** The database keeps 1–255 characters. */
export function fileNameForHistory(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? "Unnamed file" : trimmed.slice(0, 255);
}
