import { z } from "zod";
import { weekdaysFromDb, weekdaysToDb, type Weekday } from "@/features/athlete";
import type { Level } from "@/features/plan/engine";
import {
  levelAnswersFromStored,
  levelAnswersToStored,
  RIDING_ENVIRONMENTS,
  TRAINING_PURPOSES,
  type RidingEnvironment,
  type TrainingPurpose,
} from "@/features/plan/schemas";
import { getSupabase } from "@/lib/supabase/client";

/** The athlete profile (P44): every field is optional, so an empty profile is a valid profile. */
export type Profile = {
  displayName: string | null;
  birthYear: number | null;
  availableDays: Weekday[];
  goal: string | null;
  /** Where you ride (P62). */
  ridingEnvironment: RidingEnvironment | null;
  /** Average hours per week, 1 to 25 in half hours (P60). */
  weeklyHours: number | null;
  /** Ranked, most important first, at most two (P75). */
  trainingPurposes: TrainingPurpose[];
  /** The five level answers L1 to L5 in question order, or null when not answered. */
  levelAnswers: number[] | null;
  /** The level the plan assumes: the scored one, or the one the PO chose instead (P60). */
  level: Level | null;
  /** The optional event (P66): both or neither. */
  eventName: string | null;
  eventDate: string | null;
};

export const EMPTY_PROFILE: Profile = {
  displayName: null,
  birthYear: null,
  availableDays: [],
  goal: null,
  ridingEnvironment: null,
  weeklyHours: null,
  trainingPurposes: [],
  levelAnswers: null,
  level: null,
  eventName: null,
  eventDate: null,
};

/** The profile sections; each one is saved on its own (H2). */
export type ProfilePatch =
  | { section: "about"; displayName: string | null; birthYear: number | null }
  | {
      section: "week";
      availableDays: Weekday[];
      weeklyHours: number | null;
      ridingEnvironment: RidingEnvironment | null;
    }
  | { section: "purposes"; trainingPurposes: TrainingPurpose[] }
  | { section: "level"; levelAnswers: number[]; level: Level }
  | { section: "event"; eventName: string | null; eventDate: string | null }
  | { section: "goal"; goal: string | null };

/** The database spells the top level `semi_pro`, the engine `semi-pro`. */
function levelToDb(level: Level): string {
  return level === "semi-pro" ? "semi_pro" : level;
}

function levelFromDb(value: string | null): Level | null {
  if (value === "semi_pro") return "semi-pro";
  return value === "amateur" || value === "committed" ? value : null;
}

function isEnvironment(value: string | null): value is RidingEnvironment {
  return RIDING_ENVIRONMENTS.some((environment) => environment === value);
}

function isPurpose(value: string): value is TrainingPurpose {
  return TRAINING_PURPOSES.some((purpose) => purpose === value);
}

const profileRow = z
  .object({
    display_name: z.string().nullable(),
    birth_year: z.number().nullable(),
    available_days: z.array(z.number()).nullable(),
    goal: z.string().nullable(),
    riding_environment: z.string().nullable(),
    weekly_hours: z.number().nullable(),
    training_purposes: z.array(z.string()).nullable(),
    level: z.string().nullable(),
    level_answers: z.unknown(),
    event_name: z.string().nullable(),
    event_date: z.string().nullable(),
  })
  .nullable();

const PROFILE_COLUMNS =
  "display_name, birth_year, available_days, goal, riding_environment, weekly_hours, training_purposes, level, level_answers, event_name, event_date";

/** The profile of the signed-in user (RLS: own row only). No row yet is an empty profile. */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
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
    ridingEnvironment: isEnvironment(row.riding_environment) ? row.riding_environment : null,
    weeklyHours: row.weekly_hours,
    trainingPurposes: (row.training_purposes ?? []).filter(isPurpose),
    levelAnswers: levelAnswersFromStored(row.level_answers),
    level: levelFromDb(row.level),
    eventName: row.event_name,
    eventDate: row.event_date,
  };
}

function columns(patch: ProfilePatch) {
  switch (patch.section) {
    case "about":
      return { display_name: patch.displayName, birth_year: patch.birthYear };
    case "week":
      return {
        available_days: weekdaysToDb(patch.availableDays),
        weekly_hours: patch.weeklyHours,
        riding_environment: patch.ridingEnvironment,
      };
    case "purposes":
      return {
        training_purposes: patch.trainingPurposes.length === 0 ? null : patch.trainingPurposes,
      };
    case "level":
      return {
        level_answers: levelAnswersToStored(patch.levelAnswers),
        level: levelToDb(patch.level),
      };
    case "event":
      return { event_name: patch.eventName, event_date: patch.eventDate };
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
    profile.goal === null &&
    profile.ridingEnvironment === null &&
    profile.weeklyHours === null &&
    profile.trainingPurposes.length === 0 &&
    profile.levelAnswers === null &&
    profile.level === null &&
    profile.eventName === null &&
    profile.eventDate === null
  );
}
