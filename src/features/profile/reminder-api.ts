import { z } from "zod";
import { weekdayFromDb, weekdayToDb, type Weekday } from "@/features/athlete";
import { getSupabase } from "@/lib/supabase/client";

/** The weight reminder settings (P52): on by default, Sunday by default. */
export type ReminderSettings = { enabled: boolean; day: Weekday };

export const DEFAULT_REMINDER: ReminderSettings = { enabled: true, day: "sun" };

const reminderRow = z
  .object({ weight_reminder_enabled: z.boolean(), weight_reminder_day: z.number() })
  .nullable();

/** Reads only the two reminder columns; no profile row yet means the defaults. */
export async function fetchReminderSettings(userId: string): Promise<ReminderSettings> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("weight_reminder_enabled, weight_reminder_day")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = reminderRow.parse(data);
  if (row === null) return DEFAULT_REMINDER;
  return {
    enabled: row.weight_reminder_enabled,
    day: weekdayFromDb(row.weight_reminder_day) ?? DEFAULT_REMINDER.day,
  };
}

/** Writes only the two reminder columns. Upsert, so it also works when the profile row is missing. */
export async function saveReminderSettings(
  userId: string,
  settings: ReminderSettings,
): Promise<void> {
  const { error } = await getSupabase()
    .from("profiles")
    .upsert(
      {
        id: userId,
        weight_reminder_enabled: settings.enabled,
        weight_reminder_day: weekdayToDb(settings.day),
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(error.message);
}
