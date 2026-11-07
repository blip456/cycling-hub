import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  useStatusCard,
  type StatusRegistry,
} from "@/components/status/status-context";
import type { WeightEntry } from "@/features/athlete";
import { saveWeightEntry } from "./api";
import { formatDay } from "./format";
import { weightKeys } from "./hooks";

/** How long the Undo stays (P12, W1a: about 8 seconds). Paused while the Undo button has focus or the pointer. */
export const UNDO_MS = 8000;
/** How long the short follow-up card ("Entry restored.") stays. */
const FOLLOW_UP_MS = 5000;

const CARD_ID = "weight-entry";

/**
 * The card lives in the StatusProvider, above the routes, so it stays when the PO switches from Log to
 * Trend. One card at a time: the next action replaces it.
 */
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function hide(registry: StatusRegistry) {
  clearTimer();
  registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
}

function startTimer(registry: StatusRegistry, ms: number) {
  clearTimer();
  timer = setTimeout(() => {
    timer = undefined;
    registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
  }, ms);
}

function retryButton(onClick: () => void) {
  return (
    <button type="button" className={statusActionClass} onClick={onClick}>
      Try again
    </button>
  );
}

async function undoDelete(registry: StatusRegistry, queryClient: QueryClient, entry: WeightEntry) {
  hide(registry);
  try {
    await saveWeightEntry(entry);
    registry.set(CARD_ID, STATUS_PRIORITY.flash, {
      tone: "success",
      message: "Entry restored.",
      onDismiss: () => {
        hide(registry);
      },
    });
    startTimer(registry, FOLLOW_UP_MS);
  } catch {
    registry.set(CARD_ID, STATUS_PRIORITY.error, {
      tone: "error",
      message: `Couldn't restore the entry for ${formatDay(entry.date)}.`,
      action: retryButton(() => {
        void undoDelete(registry, queryClient, entry);
      }),
      onDismiss: () => {
        hide(registry);
      },
    });
  } finally {
    await queryClient.invalidateQueries({ queryKey: weightKeys.entries() });
  }
}

function showDeleted(registry: StatusRegistry, queryClient: QueryClient, entry: WeightEntry) {
  registry.set(CARD_ID, STATUS_PRIORITY.flash, {
    tone: "success",
    message: `Entry for ${formatDay(entry.date)} deleted.`,
    action: (
      <button
        type="button"
        className={statusActionClass}
        // WCAG 2.2.1: the time limit pauses while the Undo button is focused or hovered.
        onFocus={clearTimer}
        onBlur={() => {
          startTimer(registry, UNDO_MS);
        }}
        onMouseEnter={clearTimer}
        onMouseLeave={() => {
          startTimer(registry, UNDO_MS);
        }}
        onClick={() => {
          void undoDelete(registry, queryClient, entry);
        }}
      >
        Undo
      </button>
    ),
    onDismiss: () => {
      hide(registry);
    },
  });
  startTimer(registry, UNDO_MS);
}

function showDeleteFailed(registry: StatusRegistry, entry: WeightEntry) {
  clearTimer();
  registry.set(CARD_ID, STATUS_PRIORITY.error, {
    tone: "error",
    message: `Couldn't delete the entry for ${formatDay(entry.date)}. It is back in your weights.`,
    onDismiss: () => {
      hide(registry);
    },
  });
}

function showSaveFailed(registry: StatusRegistry, retry: () => void) {
  clearTimer();
  registry.set(CARD_ID, STATUS_PRIORITY.error, {
    tone: "error",
    message: (
      <>
        <strong className="font-semibold">Could not save your weight</strong>
        <br />
        Check your connection and try again. Nothing was changed.
      </>
    ),
    action: retryButton(() => {
      hide(registry);
      retry();
    }),
    onDismiss: () => {
      hide(registry);
    },
  });
}

/** The status cards of the Log tab: Undo after a delete (P12, W1a) and the failed save (W5). */
export function useWeightCards() {
  const registry = useContext(StatusRegistryContext);
  if (!registry) throw new Error("Status cards need a <StatusProvider>");
  const queryClient = useQueryClient();
  const showDeletedCard = useCallback(
    (entry: WeightEntry) => {
      showDeleted(registry, queryClient, entry);
    },
    [registry, queryClient],
  );
  const showDeleteFailedCard = useCallback(
    (entry: WeightEntry) => {
      showDeleteFailed(registry, entry);
    },
    [registry],
  );
  const showSaveFailedCard = useCallback(
    (retry: () => void) => {
      showSaveFailed(registry, retry);
    },
    [registry],
  );
  const hideCard = useCallback(() => {
    hide(registry);
  }, [registry]);
  return useMemo(
    () => ({
      showDeleted: showDeletedCard,
      showDeleteFailed: showDeleteFailedCard,
      showSaveFailed: showSaveFailedCard,
      hide: hideCard,
    }),
    [showDeletedCard, showDeleteFailedCard, showSaveFailedCard, hideCard],
  );
}

/** W5d: the card for a history that could not load, while the page shows it. */
export function useLoadErrorCard(failed: boolean, retry: () => void) {
  useStatusCard(
    "weight-load-error",
    STATUS_PRIORITY.error,
    failed
      ? {
          tone: "error",
          message: "Could not load your weights. Check your connection and try again.",
          action: retryButton(retry),
        }
      : null,
  );
}
