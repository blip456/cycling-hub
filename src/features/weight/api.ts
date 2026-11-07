import type { WeightEntry, Weekday } from "@/features/athlete";
import { normalizeEntries, weekdayFromDb } from "@/features/athlete";
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type WeightRow = Pick<
  Database["public"]["Tables"]["weight_entries"]["Row"],
  "entry_date" | "weight_kg" | "note"
>;

/** All weigh-ins, oldest first, one per day. One user, a few hundred rows a year: loaded once. */
export async function fetchWeightEntries(): Promise<WeightEntry[]> {
  const { data, error } = await getSupabase()
    .from("weight_entries")
    .select("entry_date, weight_kg, note")
    .order("entry_date", { ascending: true })
    .overrideTypes<WeightRow[], { merge: false }>();
  if (error) throw new Error(error.message);
  return normalizeEntries(
    data.map((row) => ({ date: row.entry_date, kg: row.weight_kg, note: row.note })),
  );
}

/** One entry per day (P45): saving a date that has an entry replaces it (upsert on user and date). */
export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  const { error } = await getSupabase()
    .from("weight_entries")
    .upsert(
      { entry_date: entry.date, weight_kg: entry.kg, note: entry.note ?? null },
      { onConflict: "user_id,entry_date" },
    );
  if (error) throw new Error(error.message);
}

export async function deleteWeightEntry(date: string): Promise<void> {
  const { error } = await getSupabase().from("weight_entries").delete().eq("entry_date", date);
  if (error) throw new Error(error.message);
}

/** The reminder settings of the profile (Settings, W4). */
export type ReminderSettings = { enabled: boolean; day: Weekday };

/** Default when the profile row does not exist yet (P52): on, Sunday. */
export const DEFAULT_REMINDER: ReminderSettings = { enabled: true, day: "sun" };

export async function fetchReminderSettings(userId: string): Promise<ReminderSettings> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("weight_reminder_day, weight_reminder_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_REMINDER;
  return {
    enabled: data.weight_reminder_enabled,
    day: weekdayFromDb(data.weight_reminder_day) ?? DEFAULT_REMINDER.day,
  };
}
