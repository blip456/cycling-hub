import { z } from "zod";
import type { IsoDate } from "@/features/athlete";
import { getSupabase } from "@/lib/supabase/client";
import type { WeightGoal } from "./goal-model";

const GOAL_COLUMNS = "id, target_weight_kg, target_date, start_weight_kg, start_date, status";

const goalRow = z
  .object({
    id: z.string(),
    target_weight_kg: z.number(),
    target_date: z.string(),
    start_weight_kg: z.number(),
    start_date: z.string(),
    status: z.enum(["active", "reached", "cancelled"]),
  })
  .nullable();

/** The one active weight goal (RLS: own rows only), or null when there is none. */
export async function fetchActiveWeightGoal(): Promise<WeightGoal | null> {
  const { data, error } = await getSupabase()
    .from("weight_goals")
    .select(GOAL_COLUMNS)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = goalRow.parse(data);
  if (row === null) return null;
  return {
    id: row.id,
    targetKg: row.target_weight_kg,
    targetDate: row.target_date,
    startKg: row.start_weight_kg,
    startDate: row.start_date,
    status: row.status,
  };
}

export type NewWeightGoal = {
  targetKg: number;
  targetDate: IsoDate;
  /** The weight snapshot on the start date: the latest 7-day average. */
  startKg: number;
  startDate: IsoDate;
};

/** Marks the active goal as cancelled; no active goal is fine. */
export async function cancelActiveWeightGoal(): Promise<void> {
  const { error } = await getSupabase()
    .from("weight_goals")
    .update({ status: "cancelled" })
    .eq("status", "active");
  if (error) throw new Error(error.message);
}

/**
 * Sets a new goal. There is one active goal (a unique index enforces it), so the old one is cancelled
 * first; when the new goal cannot be saved the old one is made active again.
 */
export async function saveWeightGoal(
  goal: NewWeightGoal,
  previousId: string | null,
): Promise<void> {
  await cancelActiveWeightGoal();
  const { error } = await getSupabase().from("weight_goals").insert({
    target_weight_kg: goal.targetKg,
    target_date: goal.targetDate,
    start_weight_kg: goal.startKg,
    start_date: goal.startDate,
    status: "active",
  });
  if (error) {
    if (previousId !== null) {
      await getSupabase().from("weight_goals").update({ status: "active" }).eq("id", previousId);
    }
    throw new Error(error.message);
  }
}
