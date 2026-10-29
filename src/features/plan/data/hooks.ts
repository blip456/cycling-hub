import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useWeightEntries } from "@/features/weight/hooks";
import {
  createPlan,
  fetchActivePlan,
  fetchActiveWeightGoal,
  fetchPlanProfile,
  fetchPlanSessions,
  saveWeightGoal,
  savePlanProfile,
  updateSessions,
  type NewPlan,
  type PlanProfile,
  type PlanProfilePatch,
  type SessionChange,
} from "./api";
import { applyPatch } from "./patch";
import { currentWeight, type CurrentWeight } from "./weight";
import type { PlanSession, StoredPlan } from "./types";

export const planKeys = {
  all: ["plan"] as const,
  active: () => [...planKeys.all, "active"] as const,
  sessionsAll: () => [...planKeys.all, "sessions"] as const,
  sessions: (planId: string) => [...planKeys.sessionsAll(), planId] as const,
  profile: (userId: string) => [...planKeys.all, "profile", userId] as const,
  goal: () => [...planKeys.all, "goal"] as const,
};

/** The active plan: undefined while loading, null when there is none. */
export function usePlan() {
  return useQuery({ queryKey: planKeys.active(), queryFn: fetchActivePlan });
}

/** The sessions of one plan in date order (done, skipped and moved ones included, dropped ones left out). */
export function usePlanSessions(planId: string | undefined) {
  return useQuery({
    queryKey: planKeys.sessions(planId ?? ""),
    queryFn: () => fetchPlanSessions(planId ?? ""),
    enabled: planId !== undefined,
  });
}

export type PlanData = {
  /** Undefined while loading, null when there is no active plan. */
  plan: StoredPlan | null | undefined;
  sessions: PlanSession[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

/** The active plan with its sessions: one loading and error state for the Plan pages. */
export function usePlanData(): PlanData {
  const planQuery = usePlan();
  const plan = planQuery.data;
  const sessionsQuery = usePlanSessions(plan?.id);
  return {
    plan,
    sessions: sessionsQuery.data ?? [],
    isPending:
      planQuery.isPending || (plan !== null && plan !== undefined && sessionsQuery.isPending),
    isError: planQuery.isError || sessionsQuery.isError,
    refetch: () => {
      void planQuery.refetch();
      if (plan) void sessionsQuery.refetch();
    },
  };
}

/** One session of the active plan by id; null when it is not in the plan (any more). */
export function usePlanSession(id: string | undefined): PlanData & { session: PlanSession | null } {
  const data = usePlanData();
  const session = useMemo(
    () => data.sessions.find((s) => s.id === id) ?? null,
    [data.sessions, id],
  );
  return { ...data, session };
}

/**
 * Changes sessions (mark done, skip, move, swap, indoor or outdoor). The new values show at once and come
 * back when the save fails. Use the inverse changes of the first call for Undo.
 */
export function useUpdateSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: readonly SessionChange[]) => updateSessions(changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: planKeys.sessionsAll() });
      const previous = queryClient.getQueriesData<PlanSession[]>({
        queryKey: planKeys.sessionsAll(),
      });
      queryClient.setQueriesData<PlanSession[]>({ queryKey: planKeys.sessionsAll() }, (sessions) =>
        sessions?.map((s) => {
          const change = changes.find((c) => c.id === s.id);
          return change ? applyPatch(s, change.patch) : s;
        }),
      );
      return { previous };
    },
    onError: (_error, _changes, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: planKeys.sessionsAll() }),
  });
}

export type CreatePlanVariables = {
  newPlan: NewPlan;
  /**
   * The weight goal to save with the plan: an object sets it, null cancels the active one, undefined leaves
   * the goals alone. The goal is saved first, so a failed build keeps the answers.
   */
  goal?: { targetKg: number; targetDate: string; startKg: number } | null;
};

/**
 * Builds on the engine's plan: saves it with its sessions and makes it the active plan (the old one is
 * replaced). Also the way to replace a plan later: the adaptation part gives it a rebuilt plan.
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ newPlan, goal }: CreatePlanVariables) => {
      if (goal !== undefined) await saveWeightGoal(goal);
      return createPlan(newPlan);
    },
    onSuccess: async (plan) => {
      queryClient.setQueryData(planKeys.active(), plan);
      await queryClient.invalidateQueries({ queryKey: planKeys.all });
    },
  });
}

/** Same as `useCreatePlan`: a new plan always replaces the active one. */
export const useReplacePlan = useCreatePlan;

/** The plan fields of the profile (and the available days) for the intake and the plan pages. */
export function usePlanProfile() {
  const userId = useAuth().session?.user.id ?? "";
  return useQuery({
    queryKey: planKeys.profile(userId),
    queryFn: () => fetchPlanProfile(userId),
    enabled: userId !== "",
  });
}

/** Saves plan fields of the profile; the profile page reads them again afterwards. */
export function useSavePlanProfile() {
  const userId = useAuth().session?.user.id ?? "";
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PlanProfilePatch) => savePlanProfile(userId, patch),
    onSuccess: (_data, patch) => {
      queryClient.setQueryData<PlanProfile>(planKeys.profile(userId), (profile) =>
        profile ? { ...profile, ...patch } : profile,
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.profile(userId) }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]),
  });
}

/** The active weight goal, or null. */
export function useActiveWeightGoal() {
  return useQuery({ queryKey: planKeys.goal(), queryFn: fetchActiveWeightGoal });
}

/** The latest 7-day average weight and the pace of the trend, from the weight log. */
export function useCurrentWeight(today: string): {
  weight: CurrentWeight | null | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const entries = useWeightEntries();
  const weight = useMemo(
    () => (entries.data ? currentWeight(entries.data, today) : undefined),
    [entries.data, today],
  );
  return { weight, isPending: entries.isPending, isError: entries.isError };
}
