import { useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { Link } from "react-router";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  useStatusCard,
  type StatusCardSpec,
} from "@/components/status/status-context";
import { goalKeys } from "@/features/weight/goal-hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { saveWeightGoal, savePlanProfile } from "./data/api";
import { planKeys } from "./data/hooks";
import { usePlanRunner } from "./manage/runner";
import { clearPlanUpdate, usePlanUpdateNotice } from "./manage/update-store";
import { summaryKeys } from "./summary/hooks";

const FOLLOW_UP_ID = "plan-update-follow-up";
const FOLLOW_UP_MS = 6000;
let followUpTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The "Plan updated" status card (R3, P71): what changed and why, See changes and Undo. It shows the update the
 * app just made (an edit of the plan today; later also the automatic updates) and stays until it is dismissed,
 * See changes is opened, Undo is used or the next update replaces it. Mounted in the app shell, so it shows on
 * every page. After an edit, Undo also puts the answers (profile and weight goal) back.
 */
export function PlanUpdatedCard() {
  const notice = usePlanUpdateNotice();
  const registry = useContext(StatusRegistryContext);
  const queryClient = useQueryClient();
  const runner = usePlanRunner();
  const userId = useAuth().session?.user.id ?? "";
  const [undoing, setUndoing] = useState(false);

  function followUp(spec: StatusCardSpec | null, priority: number = STATUS_PRIORITY.flash) {
    if (!registry) return;
    registry.set(FOLLOW_UP_ID, priority, spec);
    if (followUpTimer !== undefined) clearTimeout(followUpTimer);
    if (spec) {
      followUpTimer = setTimeout(() => {
        followUpTimer = undefined;
        registry.set(FOLLOW_UP_ID, priority, null);
      }, FOLLOW_UP_MS);
    }
  }

  async function undo() {
    if (!notice || undoing) return;
    setUndoing(true);
    try {
      const result = await runner.undo(notice.change);
      if (result.status === "stale") {
        clearPlanUpdate();
        followUp({
          tone: "info",
          message: "The plan has changed since, so this update can no longer be undone.",
          onDismiss: () => {
            followUp(null);
          },
        });
        return;
      }
      if (result.status === "failed") {
        followUp(
          {
            tone: "error",
            message: "Could not undo the update. Your plan is as it was after the update.",
            onDismiss: () => {
              followUp(null, STATUS_PRIORITY.error);
            },
          },
          STATUS_PRIORITY.error,
        );
        return;
      }
      clearPlanUpdate();
      if (notice.restore) {
        try {
          await savePlanProfile(userId, notice.restore.profilePatch);
          if (notice.restore.goal !== undefined) await saveWeightGoal(notice.restore.goal);
        } catch {
          followUp({
            tone: "info",
            message: "Update undone. Your saved answers could not be put back: check your profile.",
            onDismiss: () => {
              followUp(null);
            },
          });
          return;
        }
      }
      followUp({
        tone: "success",
        message: "Update undone. Your plan is as it was.",
        onDismiss: () => {
          followUp(null);
        },
      });
    } finally {
      setUndoing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: goalKeys.active() }),
      ]);
    }
  }

  useStatusCard(
    "plan-updated",
    STATUS_PRIORITY.planUpdated,
    notice
      ? {
          tone: "info",
          message: (
            <>
              <strong className="font-semibold">Plan updated</strong>
              <br />
              {notice.change.message}
            </>
          ),
          action: (
            <>
              <Link to="/plan/changes" className={statusActionClass} onClick={clearPlanUpdate}>
                See changes
              </Link>
              {notice.change.payload.undo ? (
                <button
                  type="button"
                  className={statusActionClass}
                  aria-disabled={undoing}
                  onClick={() => {
                    void undo();
                  }}
                >
                  Undo
                </button>
              ) : null}
            </>
          ),
          onDismiss: clearPlanUpdate,
        }
      : null,
  );
  return null;
}
