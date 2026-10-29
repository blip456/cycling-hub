import { useSyncExternalStore } from "react";
import type { PlanChange } from "../adaptation/changes";
import type { PlanProfilePatch } from "../data/api";
import type { GoalWrite } from "../data/edit";

/**
 * The "Plan updated" notice that is showing (R3, P71): the stored update with its Undo, and, after an edit,
 * how to put the answers back (the profile fields and the weight goal) so Undo takes the whole edit back.
 * Kept in memory only: it belongs to what just happened, not to the plan, and goes when the plan is removed.
 */
export type PlanUpdateNotice = {
  change: PlanChange;
  /** Present after an edit of the answers. */
  restore: { profilePatch: PlanProfilePatch; goal: GoalWrite } | null;
};

let current: PlanUpdateNotice | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showPlanUpdate(notice: PlanUpdateNotice): void {
  current = notice;
  emit();
}

export function clearPlanUpdate(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function currentPlanUpdate(): PlanUpdateNotice | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlanUpdateNotice(): PlanUpdateNotice | null {
  return useSyncExternalStore(subscribe, currentPlanUpdate, currentPlanUpdate);
}
