import { z } from "zod";
import { weekdaysFromDb, weekdaysToDb, type Weekday } from "@/features/athlete";
import { getSupabase } from "@/lib/supabase/client";

/** The athlete profile (P44): every field is optional, so an empty profile is a valid profile. */
export type Profile = {
  displayName: string | null;
  birthYear: number | null;
  availableDays: Weekday[];
  goal: string | null;
};

export const EMPTY_PROFILE: Profile = {
  displayName: null,
  birthYear: null,
  availableDays: [],
  goal: null,
};

/** The profile sections; each one is saved on its own (H2). */
export type ProfilePatch =
  | { section: "about"; displayName: string | null; birthYear: number | null }
  | { section: "week"; availableDays: Weekday[] }
  | { section: "goal"; goal: string | null };

const profileRow = z
  .object({
    display_name: z.string().nullable(),
    birth_year: z.number().nullable(),
    available_days: z.array(z.number()).nullable(),
    goal: z.string().nullable(),
  })
  .nullable();

/** The profile of the signed-in user (RLS: own row only). No row yet is an empty profile. */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("display_name, birth_year, available_days, goal")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = profileRow.parse(data);
  if (row === null) return EMPTY_PROFILE;
  return {
    displayName: row.display_name,
    birthYear: row.birth_year,
    availableDays: weekdaysFromDb(row.available_days),
    goal: row.goal,
  };
}

function columns(patch: ProfilePatch) {
  switch (patch.section) {
    case "about":
      return { display_name: patch.displayName, birth_year: patch.birthYear };
    case "week":
      return { available_days: weekdaysToDb(patch.availableDays) };
    case "goal":
      return { goal: patch.goal };
  }
}

/** Saves one section. Upsert, so it also works when the profile row is missing; other columns stay as they are. */
export async function saveProfileSection(userId: string, patch: ProfilePatch): Promise<void> {
  const { error } = await getSupabase()
    .from("profiles")
    .upsert({ id: userId, ...columns(patch) }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** The Profile page is empty when no field has a value. */
export function isProfileEmpty(profile: Profile): boolean {
  return (
    profile.displayName === null &&
    profile.birthYear === null &&
    profile.availableDays.length === 0 &&
    profile.goal === null
  );
}
