import { useCallback, useEffect, useState } from "react";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import type { PlanChange } from "./changes";
import { useUndoChange } from "./hooks";
import { useSeenUpdate } from "./seen";

const FOLLOW_UP_MS = 5000;

type Outcome = "restored" | "stale" | "failed" | null;

/**
 * Undo of a plan update with its answer as a status card at the bottom of the page: "Plan restored.
 * Updated again when something changes." (R4 pin 4), or the reason it did not work. `cardId` keeps the cards
 * of two screens apart.
 */
export function useUndoFlow(cardId: string): {
  undo: (change: PlanChange) => void;
  isPending: boolean;
} {
  const mutation = useUndoChange();
  const { markSeen } = useSeenUpdate();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [last, setLast] = useState<PlanChange | null>(null);
  const { mutate } = mutation;

  useEffect(() => {
    if (outcome !== "restored" && outcome !== "stale") return undefined;
    const timer = setTimeout(() => {
      setOutcome(null);
    }, FOLLOW_UP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [outcome]);

  const undo = useCallback(
    (change: PlanChange) => {
      setLast(change);
      setOutcome(null);
      mutate(change, {
        onSuccess: (result) => {
          markSeen(change.id);
          setOutcome(result.status === "done" ? "restored" : "stale");
        },
        onError: () => {
          setOutcome("failed");
        },
      });
    },
    [mutate, markSeen],
  );

  const clear = () => {
    setOutcome(null);
  };

  useStatusCard(
    cardId,
    outcome === "failed" ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    outcome === null
      ? null
      : outcome === "restored"
        ? {
            tone: "success",
            message: "Plan restored. Updated again when something changes.",
            onDismiss: clear,
          }
        : outcome === "stale"
          ? {
              tone: "info",
              message: "This update can no longer be undone. The plan has changed since.",
              onDismiss: clear,
            }
          : {
              tone: "error",
              message: (
                <>
                  <strong className="font-semibold">Could not undo the update</strong>
                  <br />
                  It is still in your plan. Check your connection and try again.
                </>
              ),
              action: (
                <button
                  type="button"
                  className={statusActionClass}
                  onClick={() => {
                    if (last) undo(last);
                  }}
                >
                  Try again
                </button>
              ),
              onDismiss: clear,
            },
  );

  return { undo, isPending: mutation.isPending };
}
