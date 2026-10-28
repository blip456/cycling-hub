import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

const lastSeenRow = z.object({ last_seen_version: z.string().nullable() }).nullable();

/**
 * profiles.last_seen_version for the signed-in user (RLS: own row only, A2). null when the user has
 * never seen a version (first sign-in) or the row does not exist yet.
 */
export async function fetchLastSeenVersion(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("last_seen_version")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return lastSeenRow.parse(data)?.last_seen_version ?? null;
}

/** Stores the version as seen. Upsert, so it also works when the profile row is missing. */
export async function saveLastSeenVersion(userId: string, version: string): Promise<void> {
  const { error } = await getSupabase()
    .from("profiles")
    .upsert({ id: userId, last_seen_version: version }, { onConflict: "id" });
  if (error) throw error;
}
