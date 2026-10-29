import { Link } from "react-router";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { usePlan } from "./data";
import { undoableChange, useAdaptationRunner, usePlanChanges } from "./adaptation/hooks";
import { useSeenUpdate } from "./adaptation/seen";
import { useUndoFlow } from "./adaptation/use-undo-flow";

/**
 * R3: the "Plan updated" status card, and the place the re-evaluation runner lives (the shell mounts this
 * on every page once the PO is signed in). The card shows the newest update the PO has not seen yet: what
 * changed and why in one sentence, See changes (R4) and Undo. It stays until the changes are opened, Undo
 * is used, it is dismissed or the next update replaces it (R3-PO1). Without a change there is no card.
 */
export function PlanUpdatedCard() {
  useAdaptationRunner();
  const plan = usePlan();
  const changes = usePlanChanges();
  const { seenId, markSeen } = useSeenUpdate();
  const { undo, isPending } = useUndoFlow("plan-updated-undo");

  const newest = changes.data?.[0];
  const unseen = newest && newest.undoneAt === null && newest.id !== seenId ? newest : null;
  const canUndo =
    unseen !== null && undoableChange(changes.data, plan.data?.fingerprint)?.id === unseen.id;

  useStatusCard(
    "plan-updated",
    STATUS_PRIORITY.planUpdated,
    unseen
      ? {
          tone: "info",
          message: (
            <>
              <strong className="font-semibold">Plan updated</strong>
              <br />
              {unseen.message}
            </>
          ),
          action: (
            <span className="flex flex-wrap items-center">
              <Link
                to="/plan/changes"
                className={statusActionClass}
                onClick={() => {
                  markSeen(unseen.id);
                }}
              >
                See changes
              </Link>
              {canUndo ? (
                <button
                  type="button"
                  className={statusActionClass}
                  disabled={isPending}
                  onClick={() => {
                    undo(unseen);
                  }}
                >
                  Undo
                </button>
              ) : null}
            </span>
          ),
          onDismiss: () => {
            markSeen(unseen.id);
          },
        }
      : null,
  );

  return null;
}
