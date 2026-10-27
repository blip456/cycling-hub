import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];

/** The columns the ride list, the table and the detail page need (no raw JSON). */
export const RIDE_COLUMNS =
  "id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s, elevation_m, " +
  "commute, trainer, average_watts, max_watts, average_heartrate, max_heartrate, average_cadence, polyline";

export type Ride = Pick<
  ActivityRow,
  | "id"
  | "strava_id"
  | "name"
  | "sport_type"
  | "start_local"
  | "start_at"
  | "distance_m"
  | "moving_time_s"
  | "elevation_m"
  | "commute"
  | "trainer"
  | "average_watts"
  | "max_watts"
  | "average_heartrate"
  | "max_heartrate"
  | "average_cadence"
  | "polyline"
>;

/**
 * All visible rides, newest first: cycling types only (P13), not deleted (P15). One user with a few
 * hundred rides a year, so the whole list is loaded once and sorted, filtered and grouped in the app.
 */
export async function fetchRides(): Promise<Ride[]> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(RIDE_COLUMNS)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .order("start_at", { ascending: false })
    .overrideTypes<Ride[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/** One ride by id, or null when it doesn't exist, isn't a ride or was deleted. */
export async function fetchRide(id: string): Promise<Ride | null> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(RIDE_COLUMNS)
    .eq("id", id)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .maybeSingle()
    .overrideTypes<Ride | null, { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Deletes a ride in the app (P15): a soft delete, so later imports skip it ("Deleted earlier") and
 * an undo can bring it back.
 */
export async function deleteRide(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("activities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Undo for deleteRide. */
export async function restoreRide(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("activities")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Visible rides with their raw export JSON, for the JSON export (re-importable). */
export async function fetchRidesForExport(): Promise<(Ride & { raw: ActivityRow["raw"] })[]> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(`${RIDE_COLUMNS}, raw`)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .order("start_at", { ascending: false })
    .overrideTypes<(Ride & { raw: ActivityRow["raw"] })[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}
