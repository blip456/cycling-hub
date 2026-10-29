import { z } from "zod";
import { weekdaysFromDb, type IsoDate, type Weekday } from "@/features/athlete";
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Intake, Plan } from "../engine";
import {
  levelAnswersFromStored,
  levelAnswersToStored,
  RIDING_ENVIRONMENTS,
  TRAINING_PURPOSES,
  type RidingEnvironment,
  type TrainingPurpose,
} from "../schemas";
import {
  planFromRow,
  planInsert,
  sessionFromRow,
  sessionInserts,
  type SessionInsert,
} from "./mapping";
import type { PlanSession, SessionPatch, StoredPlan } from "./types";

type SessionRow = Database["public"]["Tables"]["planned_sessions"]["Row"];

// ---- plan and sessions ---------------------------------------------------------------------------

/** The active plan, or null when there is none (at most one is active, a database rule). */
export async function fetchActivePlan(): Promise<StoredPlan | null> {
  const { data, error } = await getSupabase()
    .from("training_plans")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? planFromRow(data) : null;
}

/** The sessions of a plan in date order. Dropped sessions (removed by the engine) are not shown. */
export async function fetchPlanSessions(planId: string): Promise<PlanSession[]> {
  const { data, error } = await getSupabase()
    .from("planned_sessions")
    .select("*")
    .eq("plan_id", planId)
    .order("session_date", { ascending: true })
    .order("day_order", { ascending: true })
    .overrideTypes<SessionRow[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data.flatMap((row) => {
    const session = sessionFromRow(row);
    return session ? [session] : [];
  });
}

function sessionColumns(patch: SessionPatch) {
  return {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.date !== undefined ? { session_date: patch.date } : {}),
    ...(patch.movedFrom !== undefined ? { moved_from: patch.movedFrom } : {}),
    ...(patch.indoor !== undefined ? { indoor: patch.indoor } : {}),
  };
}

export type SessionChange = { id: string; patch: SessionPatch };

/** Updates sessions one by one (a swap is two). The first failure stops and throws. */
export async function updateSessions(changes: readonly SessionChange[]): Promise<void> {
  for (const { id, patch } of changes) {
    const { error } = await getSupabase()
      .from("planned_sessions")
      .update(sessionColumns(patch))
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export type NewPlan = {
  /** The engine's plan (status "ok"). */
  plan: Plan;
  intake: Intake;
  ftp: number;
  weightKg: number | null;
};

const INSERT_CHUNK = 100;

/**
 * Saves a plan and its sessions and makes it the active one. The old active plan becomes "replaced" first
 * (the database allows one active plan). Without transactions in the client, a failure undoes what was done:
 * the new plan is deleted (its sessions go with it) and the old one is active again, so a failed build
 * leaves the PO's plan as it was.
 */
export async function createPlan(input: NewPlan): Promise<StoredPlan> {
  const supabase = getSupabase();
  const { data: old, error: oldError } = await supabase
    .from("training_plans")
    .select("id")
    .eq("status", "active");
  if (oldError) throw new Error(oldError.message);
  const oldIds = old.map((row) => row.id);

  if (oldIds.length > 0) {
    const { error } = await supabase
      .from("training_plans")
      .update({ status: "replaced" })
      .in("id", oldIds);
    if (error) throw new Error(error.message);
  }

  const restore = async () => {
    if (oldIds.length > 0)
      await supabase.from("training_plans").update({ status: "active" }).in("id", oldIds);
  };

  const { data: row, error: insertError } = await supabase
    .from("training_plans")
    .insert(planInsert(input))
    .select("*")
    .single();
  if (insertError) {
    await restore();
    throw new Error(insertError.message);
  }

  const rows: SessionInsert[] = sessionInserts(input.plan);
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((r) => ({ ...r, plan_id: row.id }));
    const { error } = await supabase.from("planned_sessions").insert(chunk);
    if (error) {
      await supabase.from("training_plans").delete().eq("id", row.id);
      await restore();
      throw new Error(error.message);
    }
  }
  return planFromRow(row);
}

// ---- the plan fields of the profile -------------------------------------------------------------

/** The plan fields of the profile (P60, P62, P65, P66) with the available days. Every field can be empty. */
export type PlanProfile = {
  ridingEnvironment: RidingEnvironment | null;
  weeklyHours: number | null;
  trainingPurposes: TrainingPurpose[];
  /** Answers in question order, or null when not all five are stored. */
  levelAnswers: number[] | null;
  eventName: string | null;
  eventDate: IsoDate | null;
  availableDays: Weekday[];
};

export const EMPTY_PLAN_PROFILE: PlanProfile = {
  ridingEnvironment: null,
  weeklyHours: null,
  trainingPurposes: [],
  levelAnswers: null,
  eventName: null,
  eventDate: null,
  availableDays: [],
};

const profileRow = z
  .object({
    riding_environment: z.string().nullable(),
    weekly_hours: z.number().nullable(),
    training_purposes: z.array(z.string()).nullable(),
    level_answers: z.unknown(),
    event_name: z.string().nullable(),
    event_date: z.string().nullable(),
    available_days: z.array(z.number()).nullable(),
  })
  .nullable();

export async function fetchPlanProfile(userId: string): Promise<PlanProfile> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select(
      "riding_environment, weekly_hours, training_purposes, level_answers, event_name, event_date, available_days",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = profileRow.parse(data);
  if (row === null) return EMPTY_PLAN_PROFILE;
  return {
    ridingEnvironment:
      RIDING_ENVIRONMENTS.find((value) => value === row.riding_environment) ?? null,
    weeklyHours: row.weekly_hours,
    trainingPurposes: (row.training_purposes ?? []).filter((p): p is TrainingPurpose =>
      (TRAINING_PURPOSES as readonly string[]).includes(p),
    ),
    levelAnswers: levelAnswersFromStored(row.level_answers),
    eventName: row.event_name,
    eventDate: row.event_date,
    availableDays: weekdaysFromDb(row.available_days),
  };
}

/** The plan fields the intake may save (the days are saved on the Profile page only). */
export type PlanProfilePatch = Partial<Omit<PlanProfile, "availableDays">>;

/** Saves the given plan fields; other profile columns stay as they are. */
export async function savePlanProfile(userId: string, patch: PlanProfilePatch): Promise<void> {
  const columns = {
    ...(patch.ridingEnvironment !== undefined
      ? { riding_environment: patch.ridingEnvironment }
      : {}),
    ...(patch.weeklyHours !== undefined ? { weekly_hours: patch.weeklyHours } : {}),
    ...(patch.trainingPurposes !== undefined ? { training_purposes: patch.trainingPurposes } : {}),
    ...(patch.levelAnswers !== undefined
      ? {
          level_answers:
            patch.levelAnswers === null ? null : levelAnswersToStored(patch.levelAnswers),
        }
      : {}),
    ...(patch.eventName !== undefined ? { event_name: patch.eventName } : {}),
    ...(patch.eventDate !== undefined ? { event_date: patch.eventDate } : {}),
  };
  const { error } = await getSupabase()
    .from("profiles")
    .upsert({ id: userId, ...columns }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// ---- the weight goal -------------------------------------------------------------------------------

export type WeightGoalRecord = {
  targetKg: number;
  targetDate: IsoDate;
  startKg: number;
  startDate: IsoDate;
};

/** The active weight goal, or null. */
export async function fetchActiveWeightGoal(): Promise<WeightGoalRecord | null> {
  const { data, error } = await getSupabase()
    .from("weight_goals")
    .select("target_weight_kg, target_date, start_weight_kg, start_date")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    targetKg: data.target_weight_kg,
    targetDate: data.target_date,
    startKg: data.start_weight_kg,
    startDate: data.start_date,
  };
}

/**
 * Makes `goal` the active weight goal (P73): the old active one is cancelled first (one active goal per
 * user); null only cancels. The start date is the database default (today, Brussels).
 */
export async function saveWeightGoal(
  goal: { targetKg: number; targetDate: IsoDate; startKg: number } | null,
): Promise<void> {
  const supabase = getSupabase();
  const { error: cancelError } = await supabase
    .from("weight_goals")
    .update({ status: "cancelled" })
    .eq("status", "active");
  if (cancelError) throw new Error(cancelError.message);
  if (goal === null) return;
  const { error } = await supabase.from("weight_goals").insert({
    target_weight_kg: goal.targetKg,
    target_date: goal.targetDate,
    start_weight_kg: goal.startKg,
  });
  if (error) throw new Error(error.message);
}
