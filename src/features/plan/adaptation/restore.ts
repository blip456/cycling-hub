/**
 * Undo of an edit (P81): besides the sessions, the stored answers and the plan length that the runner puts
 * back, the answers the edit wrote to the profile and the weight goal go back to what the plan was built from.
 * Best effort and from the plan's stored intake: what the profile held before the edit but the plan never
 * saw is not restored.
 */
import type { Intake } from "../engine";
import {
  fetchActiveWeightGoal,
  savePlanProfile,
  saveWeightGoal,
  type PlanProfilePatch,
} from "../data/api";
import { purposesToProfile } from "../data/intake";

export function profilePatchOf(intake: Intake): PlanProfilePatch {
  const a = intake.levelAnswers;
  return {
    trainingPurposes: purposesToProfile(intake.purposes),
    levelAnswers: [a.experience, a.weeklyHours, a.intervals, a.longestRide, a.hardSessions],
    weeklyHours: intake.hoursPerWeek,
    eventName: intake.event?.name ?? null,
    eventDate: intake.event?.date ?? null,
  };
}

/** Returns false when something could not be put back. */
export async function restoreAnswers(userId: string, before: Intake): Promise<boolean> {
  try {
    await savePlanProfile(userId, profilePatchOf(before));
    const goal = before.weightGoal;
    if (goal && before.weightKg !== undefined) {
      const active = await fetchActiveWeightGoal();
      if (!active || active.targetKg !== goal.targetKg || active.targetDate !== goal.targetDate)
        await saveWeightGoal({ ...goal, startKg: before.weightKg });
    }
    return true;
  } catch {
    return false;
  }
}
