import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelActiveWeightGoal,
  fetchActiveWeightGoal,
  saveWeightGoal,
  type NewWeightGoal,
} from "./goal-api";
import type { WeightGoal } from "./goal-model";
import { useProfile } from "@/features/profile/hooks";
import { weightKeys, useWeightEntries } from "./hooks";

export const goalKeys = {
  active: () => [...weightKeys.all, "goal"] as const,
};

/** The active weight goal, or null. */
export function useActiveWeightGoal() {
  return useQuery({ queryKey: goalKeys.active(), queryFn: fetchActiveWeightGoal });
}

/** Sets a new goal and cancels the old one. */
export function useSaveWeightGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goal, previous }: { goal: NewWeightGoal; previous: WeightGoal | null }) =>
      saveWeightGoal(goal, previous?.id ?? null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: goalKeys.active() }),
  });
}

/** Removes the goal: the weight page goes back to the trend only (R2b). */
export function useCancelWeightGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelActiveWeightGoal,
    onSettled: () => queryClient.invalidateQueries({ queryKey: goalKeys.active() }),
  });
}

/** What the Trend tab needs for the goal cards: the goal, the log and whether weight loss is a purpose. */
export function useGoalView() {
  const goal = useActiveWeightGoal();
  const entries = useWeightEntries();
  const profile = useProfile();
  const weightLoss = profile.data?.trainingPurposes.includes("weight_loss") ?? false;
  return {
    goal,
    entries,
    pending: goal.isPending || entries.isPending || profile.isPending,
    // Shown with a goal, or when weight loss is one of the purposes (R2).
    visible: goal.data != null || weightLoss,
  };
}
