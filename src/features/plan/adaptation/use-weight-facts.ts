import { useMemo } from "react";
import type { IsoDate } from "@/features/athlete";
import { useActiveWeightGoal, useCurrentWeight } from "../data";
import { useAdaptationView } from "./hooks";
import type { WeightFacts } from "./reasons";

/** The weight state of the last evaluation with the goal and the latest weight; null without weight loss. */
export function useWeightFacts(today: IsoDate): WeightFacts | null {
  const view = useAdaptationView();
  const goal = useActiveWeightGoal();
  const current = useCurrentWeight(today);
  const state = view?.weight ?? null;
  return useMemo(
    () =>
      state
        ? {
            state,
            goal: goal.data
              ? { targetKg: goal.data.targetKg, targetDate: goal.data.targetDate }
              : null,
            currentKg: current.weight?.kg ?? null,
            today,
          }
        : null,
    [state, goal.data, current.weight, today],
  );
}
