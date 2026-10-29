import type { QueryClient } from "@tanstack/react-query";
import { planKeys } from "../data/hooks";
import { clearIcsDownload } from "../summary/storage";
import { summaryKeys } from "../summary/hooks";
import { clearPlanUpdate } from "./update-store";

/** React Query key of the list of updates (the Changes page); under `planKeys.all`, so it goes with the plan. */
export const changesKey = (planId: string) => [...planKeys.all, "changes", planId] as const;

/**
 * Everything the app keeps about a plan that has just been removed (P82): the plan and session queries of the
 * Plan pages, the queries the Summary and Calendar pages use, the update log, the "Plan updated" notice and the
 * calendar download the browser remembered. The pages then show their no-plan state. What is not tied to the
 * plan stays: the profile, the weight log and goal, the baseline, the rides, and the summary options (they are
 * the PO's choices for the Copy buttons, not plan data).
 */
export async function clearPlanCaches(queryClient: QueryClient, planId: string): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: planKeys.all }),
    queryClient.cancelQueries({ queryKey: summaryKeys.all }),
  ]);
  clearPlanUpdate();
  clearIcsDownload();
  queryClient.setQueryData(planKeys.active(), null);
  queryClient.setQueryData(summaryKeys.plan(), { plan: null, sessions: [] });
  queryClient.removeQueries({ queryKey: planKeys.sessions(planId) });
  queryClient.removeQueries({ queryKey: changesKey(planId) });
  queryClient.removeQueries({ queryKey: summaryKeys.changes(planId) });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: planKeys.all }),
    queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
  ]);
}
