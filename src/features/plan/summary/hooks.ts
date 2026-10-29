import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useProfile } from "@/features/profile/hooks";
import { fetchRides } from "@/features/rides/api";
import { fetchActiveWeightGoal } from "@/features/weight/goal-api";
import { useWeightEntries } from "@/features/weight/hooks";
import {
  fetchPlanChanges,
  fetchPlanData,
  fetchRideMetrics,
  fetchSummaryBaseline,
  type SummaryBaseline,
} from "./api";
import type { SummarySource } from "./build";
import type { RideMetrics } from "./types";

export const summaryKeys = {
  all: ["plan-summary"] as const,
  plan: () => [...summaryKeys.all, "plan"] as const,
  changes: (planId: string) => [...summaryKeys.all, "changes", planId] as const,
  rides: () => [...summaryKeys.all, "rides"] as const,
  baseline: () => [...summaryKeys.all, "baseline"] as const,
  goal: () => [...summaryKeys.all, "goal"] as const,
  metrics: (rideId: string, baseline: SummaryBaseline) =>
    [...summaryKeys.all, "metrics", rideId, baseline.ftp, baseline.lthr, baseline.maxHr] as const,
};

/** The active plan with its sessions. Used by the summary and the calendar page. */
export function usePlanSessions() {
  return useQuery({ queryKey: summaryKeys.plan(), queryFn: fetchPlanData });
}

export type SummarySourceState =
  | { status: "pending" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; source: SummarySource };

/** Loads everything a summary reads. Any failed part is an error with one retry for all. */
export function useSummarySource(): SummarySourceState {
  const plan = usePlanSessions();
  const planId = plan.data?.plan?.id ?? "";
  const changes = useQuery({
    queryKey: summaryKeys.changes(planId),
    queryFn: () => fetchPlanChanges(planId),
    enabled: planId !== "",
  });
  const rides = useQuery({ queryKey: summaryKeys.rides(), queryFn: fetchRides });
  const baseline = useQuery({ queryKey: summaryKeys.baseline(), queryFn: fetchSummaryBaseline });
  const weight = useWeightEntries();
  const profile = useProfile();
  const goal = useQuery({ queryKey: summaryKeys.goal(), queryFn: fetchActiveWeightGoal });

  const parts = [plan, rides, baseline, weight, profile, goal, ...(planId === "" ? [] : [changes])];
  const failed = parts.some((q) => q.isError);

  const source = useMemo<SummarySource | null>(() => {
    if (!plan.data || !rides.data || !baseline.data || !weight.data || !profile.data) return null;
    if (goal.data === undefined) return null;
    return {
      plan: plan.data,
      changes: changes.data ?? [],
      rides: rides.data,
      baseline: baseline.data,
      weight: weight.data,
      profile: profile.data,
      weightGoal:
        goal.data === null
          ? null
          : { targetKg: goal.data.targetKg, targetDate: goal.data.targetDate },
    };
  }, [plan.data, changes.data, rides.data, baseline.data, weight.data, profile.data, goal.data]);

  if (failed) {
    return {
      status: "error",
      retry: () => {
        for (const query of parts) if (query.isError) void query.refetch();
      },
    };
  }
  return source ? { status: "ready", source } : { status: "pending" };
}

/** Stream results by ride id; `pending` while any ride is still being read. A ride without results is null. */
export type RideMetricsState = {
  metrics: Readonly<Record<string, RideMetrics | null>>;
  pending: boolean;
};

export function useRideMetrics(
  rides: readonly { id: string; strava_id: number }[],
  baseline: SummaryBaseline,
): RideMetricsState {
  return useQueries({
    queries: rides.map((ride) => ({
      queryKey: summaryKeys.metrics(ride.id, baseline),
      queryFn: () => fetchRideMetrics({ stravaId: ride.strava_id }, baseline),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      metrics: Object.fromEntries(
        results.map((r, i) => [rides[i]?.id ?? String(i), r.data ?? null]),
      ),
      pending: results.some((r) => r.isPending),
    }),
  });
}
