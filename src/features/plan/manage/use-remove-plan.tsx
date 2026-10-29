import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { deletePlan } from "../data/api";
import { usePlanRunner } from "../adaptation/hooks";
import { clearPlanCaches } from "./clear-plan-caches";

const REMOVED_ID = "plan-removed";
const REMOVED_MS = 8000;
let removedTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Removes the active plan (P82): the plan row goes, its sessions and its update log cascade in the database.
 * On success every cache and local note about the plan is cleared, the Plan page shows the no-plan state and a
 * "Plan removed" card says so. On failure nothing was removed, an error card offers Try again.
 */
export function useRemovePlan() {
  const registry = useContext(StatusRegistryContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runner = usePlanRunner();
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (planId: string) => {
      // A run in progress finishes first, so it cannot write to a plan that is being deleted.
      await runner.whenIdle();
      await deletePlan(planId);
    },
    onSuccess: (_data, planId) => clearPlanCaches(queryClient, planId),
  });

  function remove(planId: string): Promise<boolean> {
    setFailedFor(null);
    return mutation.mutateAsync(planId).then(
      () => {
        if (registry) {
          registry.set(REMOVED_ID, STATUS_PRIORITY.flash, {
            tone: "success",
            message: (
              <>
                <strong className="font-semibold">Plan removed</strong>
                <br />
                Your rides, profile, weight log and baseline are unchanged.
              </>
            ),
            onDismiss: () => {
              registry.set(REMOVED_ID, STATUS_PRIORITY.flash, null);
            },
          });
          if (removedTimer !== undefined) clearTimeout(removedTimer);
          removedTimer = setTimeout(() => {
            removedTimer = undefined;
            registry.set(REMOVED_ID, STATUS_PRIORITY.flash, null);
          }, REMOVED_MS);
        }
        void navigate("/plan", { replace: true });
        return true;
      },
      () => {
        setFailedFor(planId);
        return false;
      },
    );
  }

  useStatusCard(
    "plan-remove-failed",
    STATUS_PRIORITY.error,
    failedFor !== null
      ? {
          tone: "error",
          message: (
            <>
              <strong className="font-semibold">Plan not removed</strong>
              <br />
              Nothing was removed. Check your connection and try again.
            </>
          ),
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void remove(failedFor);
              }}
            >
              Try again
            </button>
          ),
          onDismiss: () => {
            setFailedFor(null);
          },
        }
      : null,
  );

  return { remove, isPending: mutation.isPending };
}
