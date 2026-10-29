/**
 * React side of the adaptation: the runner that re-evaluates the plan when the app is opened and when its
 * inputs change, the stored updates, Undo and the view of the last evaluation.
 *
 * What starts an evaluation:
 * - the app opening (once per visit, when the signed-in shell mounts) and coming back to the foreground
 *   after a while (an installed app stays open for days);
 * - an input changing: an import or a ride added or deleted (`rides` and `imports` queries invalidated), a
 *   new baseline, a weigh-in, a profile or goal change, or a session marked, skipped or moved. These are
 *   noticed through the query cache's invalidations, so the import and ride features need no change;
 * - a failure is retried silently a few times, later and later; nothing is shown (R3 and the error cards
 *   only appear for something the PO triggered).
 * The runner's own writes refresh the plan queries with the trigger muted, so a run never starts a run.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { brusselsDate } from "@/features/athlete";
import { useAuth } from "@/lib/auth/auth-context";
import { planKeys, usePlan } from "../data";
import { createSupabaseRunnerApi, fetchPlanChanges } from "./api";
import type { PlanChange } from "./changes";
import { createRunner, type AdaptationView, type Runner, type UndoResult } from "./runner";

export const adaptationKeys = {
  view: () => [...planKeys.all, "adaptation"] as const,
  changes: (planId: string) => [...planKeys.all, "changes", planId] as const,
};

/** The updates shown on the changes page: the latest and ten earlier ones (R4-PO2). */
export const CHANGES_LIMIT = 11;

const DEBOUNCE_MS = 1500;
const RETRY_MS = 60_000;
const MAX_RETRIES = 3;
/** Back in the foreground after this long: evaluate again. */
const FOREGROUND_MS = 10 * 60_000;

const runners = new WeakMap<QueryClient, { userId: string; runner: Runner }>();

/** The one runner of this app (per query client): runs and Undo share its queue. */
export function runnerFor(queryClient: QueryClient, userId: string): Runner {
  const known = runners.get(queryClient);
  if (known && known.userId === userId) return known.runner;
  const runner = createRunner(createSupabaseRunnerApi(userId));
  runners.set(queryClient, { userId, runner });
  return runner;
}

/** True for the query keys whose invalidation means "the plan's inputs may have changed". */
export function startsEvaluation(key: readonly unknown[]): boolean {
  const [root, second] = key;
  if (root === "rides" || root === "imports") return true;
  if (root === "baseline") return second === "current" || second === "entries";
  if (root === "weight") return second === "entries";
  if (root === "plan") return second === "sessions" || second === "profile" || second === "goal";
  return false;
}

/** Refreshes what shows the plan; the muted flag keeps the refresh from starting another evaluation. */
function refreshPlan(queryClient: QueryClient, mute: { on: boolean }): void {
  mute.on = true;
  void queryClient.invalidateQueries({ queryKey: planKeys.active() });
  void queryClient.invalidateQueries({ queryKey: planKeys.sessionsAll() });
  void queryClient.invalidateQueries({ queryKey: [...planKeys.all, "changes"] });
  mute.on = false;
}

/** Mount once, where the signed-in app lives: it evaluates the plan now and whenever its inputs change. */
export function useAdaptationRunner(): void {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? "";

  useEffect(() => {
    if (userId === "") return undefined;
    const runner = runnerFor(queryClient, userId);
    const mute = { on: false };
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const state = { stopped: false };
    const isStopped = (): boolean => state.stopped;
    let lastRun = 0;

    const execute = async (): Promise<void> => {
      const today = brusselsDate();
      if (today === null || isStopped()) return;
      lastRun = Date.now();
      const result = await runner.run(today);
      if (isStopped()) return;
      if (result.status === "failed") {
        if (retries < MAX_RETRIES) {
          retries += 1;
          clearTimeout(retry);
          retry = setTimeout(() => {
            void execute();
          }, RETRY_MS * retries);
        }
        return;
      }
      retries = 0;
      if (result.status === "no-plan") {
        queryClient.setQueryData<AdaptationView | null>(adaptationKeys.view(), null);
        return;
      }
      queryClient.setQueryData<AdaptationView | null>(adaptationKeys.view(), result.view);
      if (result.outcome === "recalculated") refreshPlan(queryClient, mute);
    };

    const schedule = (): void => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void execute();
      }, DEBOUNCE_MS);
    };

    void execute();

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (mute.on || event.type !== "updated" || event.action.type !== "invalidate") return;
      if (startsEvaluation(event.query.queryKey as readonly unknown[])) schedule();
    });

    const onVisible = (): void => {
      if (document.visibilityState === "visible" && Date.now() - lastRun > FOREGROUND_MS) {
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      state.stopped = true;
      clearTimeout(debounce);
      clearTimeout(retry);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient, userId]);
}

/** The view of the last evaluation of this visit (warnings and weight state); undefined before the first. */
export function useAdaptationView(): AdaptationView | null | undefined {
  return useQuery<AdaptationView | null>({
    queryKey: adaptationKeys.view(),
    queryFn: () => Promise.resolve(null),
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}

/** The stored updates of the active plan, newest first. */
export function usePlanChanges(limit: number = CHANGES_LIMIT) {
  const plan = usePlan();
  const planId = plan.data?.id;
  return useQuery<PlanChange[]>({
    queryKey: adaptationKeys.changes(planId ?? ""),
    queryFn: () => fetchPlanChanges(planId ?? "", limit),
    enabled: planId !== undefined,
  });
}

/**
 * Undo of an update (R3, R4). `stale` means the update can no longer be taken back (the plan moved on or it
 * was undone already); the screens then say so and refresh.
 */
export function useUndoChange() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? "";
  return useMutation<UndoResult, Error, PlanChange>({
    mutationFn: async (change) => {
      const result = await runnerFor(queryClient, userId).undo(change);
      if (result.status === "failed") throw result.error;
      return result;
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.active() }),
        queryClient.invalidateQueries({ queryKey: planKeys.sessionsAll() }),
        queryClient.invalidateQueries({ queryKey: [...planKeys.all, "changes"] }),
      ]);
    },
  });
}

const NO_DATES: ReadonlySet<string> = new Set();

/** The dates of the sessions the latest update changed (R3: they carry the text "Changed"). */
export function useChangedDates(): ReadonlySet<string> {
  const changes = usePlanChanges();
  const latest = changes.data?.[0];
  return useMemo(
    () =>
      latest && latest.undoneAt === null
        ? new Set(latest.payload.changes.map((c) => c.date))
        : NO_DATES,
    [latest],
  );
}

/** The update the PO can still take back: the newest one, not undone, while the plan still has its fingerprint. */
export function undoableChange(
  changes: readonly PlanChange[] | undefined,
  fingerprint: string | undefined,
): PlanChange | null {
  const latest = changes?.[0];
  if (!latest || latest.undoneAt !== null || latest.payload.undo === null) return null;
  return latest.payload.fingerprint === fingerprint ? latest : null;
}
