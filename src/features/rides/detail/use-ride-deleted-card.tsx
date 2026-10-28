import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useContext } from "react";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  type StatusRegistry,
} from "@/components/status/status-context";
import { importKeys } from "@/features/import/hooks";
import { restoreRide } from "../api";
import { rideKeys } from "../hooks";

/** How long the Undo stays (P15: "a few seconds"). Paused while the Undo button has focus or the pointer. */
export const UNDO_MS = 8000;
/** How long the short follow-up cards ("Ride restored.") stay. */
const FOLLOW_UP_MS = 5000;

const CARD_ID = "ride-deleted";

/**
 * The card lives in the StatusProvider, above the routes, so it stays when the detail page closes and
 * the app goes back to the list. One card at a time: a second delete replaces the first card.
 */
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function startTimer(registry: StatusRegistry, ms: number) {
  clearTimer();
  timer = setTimeout(() => {
    timer = undefined;
    registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
  }, ms);
}

interface DeletedRide {
  id: string;
  name: string;
}

function showRestored(registry: StatusRegistry) {
  registry.set(CARD_ID, STATUS_PRIORITY.flash, {
    tone: "success",
    message: "Ride restored.",
    onDismiss: () => {
      clearTimer();
      registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
    },
  });
  startTimer(registry, FOLLOW_UP_MS);
}

async function undo(registry: StatusRegistry, queryClient: QueryClient, ride: DeletedRide) {
  clearTimer();
  registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
  try {
    await restoreRide(ride.id);
    showRestored(registry);
  } catch {
    registry.set(CARD_ID, STATUS_PRIORITY.error, {
      tone: "error",
      message: `Couldn't restore ${ride.name}.`,
      action: (
        <button
          type="button"
          className={statusActionClass}
          onClick={() => {
            void undo(registry, queryClient, ride);
          }}
        >
          Try again
        </button>
      ),
    });
  } finally {
    // Same refresh as useRestoreRide: the list, and the import data ("Deleted earlier" changes).
    await queryClient.invalidateQueries({ queryKey: rideKeys.all });
    await queryClient.invalidateQueries({ queryKey: importKeys.all });
  }
}

function showDeleted(registry: StatusRegistry, queryClient: QueryClient, ride: DeletedRide) {
  const dismiss = () => {
    clearTimer();
    registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
  };
  registry.set(CARD_ID, STATUS_PRIORITY.flash, {
    tone: "success",
    message: "Ride deleted.",
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
          void undo(registry, queryClient, ride);
        }}
      >
        Undo
      </button>
    ),
    onDismiss: dismiss,
  });
  startTimer(registry, UNDO_MS);
}

function showDeleteFailed(registry: StatusRegistry, ride: DeletedRide) {
  clearTimer();
  registry.set(CARD_ID, STATUS_PRIORITY.error, {
    tone: "error",
    message: `Couldn't delete ${ride.name}. It is back in your rides.`,
    onDismiss: () => {
      registry.set(CARD_ID, STATUS_PRIORITY.flash, null);
    },
  });
}

/**
 * The "Ride deleted." status card with Undo (P15, B4). The callbacks keep working after the page that
 * called this hook has unmounted (the delete navigates back to the list).
 */
export function useRideDeletedCard() {
  const registry = useContext(StatusRegistryContext);
  if (!registry) throw new Error("Status cards need a <StatusProvider>");
  const queryClient = useQueryClient();
  return {
    showDeleted: useCallback(
      (ride: DeletedRide) => {
        showDeleted(registry, queryClient, ride);
      },
      [registry, queryClient],
    ),
    showDeleteFailed: useCallback(
      (ride: DeletedRide) => {
        showDeleteFailed(registry, ride);
      },
      [registry],
    ),
  };
}
