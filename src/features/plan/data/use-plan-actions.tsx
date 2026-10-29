import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  type StatusRegistry,
} from "@/components/status/status-context";
import type { IsoDate } from "@/features/athlete";
import { UNDO_MS } from "@/features/weight/use-weight-cards";
import type { SessionChange } from "./api";
import { useUpdateSessions } from "./hooks";
import { formatDay, type MoveOption } from "./model";
import { inversePatch } from "./patch";
import type { PlanSession, SessionPatch } from "./types";

const CARD_ID = "plan-action";
const FOLLOW_UP_MS = 5000;

/**
 * One card at a time, in the StatusProvider above the routes, so it stays when the PO changes tab or page.
 * The Undo lasts about 8 seconds like on the Weight page (P54, P80); the time pauses while the Undo button
 * has focus or the pointer (WCAG 2.2.1).
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

/** What an action does, and what puts it back. */
type Action = {
  changes: SessionChange[];
  inverse: SessionChange[];
  /** "Threshold 3 × 12 min skipped". */
  message: string;
};

function changesFor(
  sessions: readonly PlanSession[],
  patches: readonly { id: string; patch: SessionPatch }[],
): Pick<Action, "changes" | "inverse"> {
  return {
    changes: patches.map(({ id, patch }) => ({ id, patch })),
    inverse: patches.map(({ id, patch }) => {
      const session = sessions.find((s) => s.id === id);
      return { id, patch: session ? inversePatch(session, patch) : {} };
    }),
  };
}

export type PlanActions = {
  /** Marks the session as done (no matched ride: the PO says so, T8-PO3). */
  markDone: (session: PlanSession) => void;
  /** Skips the session. `reason` is optional (T8c); it is shown in the confirmation but not stored, the plan tables have no column for it. */
  skip: (session: PlanSession, reason?: string | null) => void;
  /** Moves the session to a day of its week; a session already there swaps places with it. */
  move: (session: PlanSession, option: MoveOption) => void;
  /** Rides the session indoor or outdoor (stored on the session, no recalculation). */
  setIndoor: (session: PlanSession, indoor: boolean) => void;
  hideCard: () => void;
  isPending: boolean;
};

/**
 * The session actions of the Plan pages (T8) with their status cards: the short confirmation with Undo (T8d)
 * and the card for a failed save. `sessions` is the plan's session list, used to put values back on Undo.
 */
export function usePlanActions(sessions: readonly PlanSession[]): PlanActions {
  const registry = useContext(StatusRegistryContext);
  if (!registry) throw new Error("Status cards need a <StatusProvider>");
  const { mutateAsync, isPending } = useUpdateSessions();
  const runRef = useRef<((action: Action) => Promise<void>) | null>(null);

  const run = useCallback(
    async (action: Action): Promise<void> => {
      hide(registry);
      try {
        await mutateAsync(action.changes);
      } catch {
        registry.set(CARD_ID, STATUS_PRIORITY.error, {
          tone: "error",
          message: (
            <>
              <strong className="font-semibold">Could not save the change</strong>
              <br />
              Nothing was changed. Check your connection and try again.
            </>
          ),
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void runRef.current?.(action);
              }}
            >
              Try again
            </button>
          ),
          onDismiss: () => {
            hide(registry);
          },
        });
        return;
      }
      const undo = async () => {
        hide(registry);
        try {
          await mutateAsync(action.inverse);
          registry.set(CARD_ID, STATUS_PRIORITY.flash, {
            tone: "success",
            message: "Change undone.",
            onDismiss: () => {
              hide(registry);
            },
          });
          startTimer(registry, FOLLOW_UP_MS);
        } catch {
          registry.set(CARD_ID, STATUS_PRIORITY.error, {
            tone: "error",
            message: "Could not undo the change. It is still in your plan.",
            onDismiss: () => {
              hide(registry);
            },
          });
        }
      };
      registry.set(CARD_ID, STATUS_PRIORITY.flash, {
        tone: "success",
        message: action.message,
        action: (
          <button
            type="button"
            className={statusActionClass}
            onFocus={clearTimer}
            onBlur={() => {
              startTimer(registry, UNDO_MS);
            }}
            onMouseEnter={clearTimer}
            onMouseLeave={() => {
              startTimer(registry, UNDO_MS);
            }}
            onClick={() => {
              void undo();
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
    },
    [registry, mutateAsync],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const markDone = useCallback(
    (session: PlanSession) => {
      void run({
        ...changesFor(sessions, [{ id: session.id, patch: { status: "done" } }]),
        message: `${session.title} marked as done.`,
      });
    },
    [run, sessions],
  );

  const skip = useCallback(
    (session: PlanSession, reason?: string | null) => {
      void run({
        ...changesFor(sessions, [{ id: session.id, patch: { status: "skipped" } }]),
        message: reason
          ? `${session.title} skipped (${reason.toLowerCase()}).`
          : `${session.title} skipped.`,
      });
    },
    [run, sessions],
  );

  const move = useCallback(
    (session: PlanSession, option: MoveOption) => {
      const to: IsoDate = option.date;
      const patches: { id: string; patch: SessionPatch }[] = [
        { id: session.id, patch: { date: to, movedFrom: session.movedFrom ?? session.date } },
      ];
      if (option.swapWith) {
        patches.push({
          id: option.swapWith.id,
          patch: {
            date: session.date,
            movedFrom: option.swapWith.movedFrom ?? option.swapWith.date,
          },
        });
      }
      void run({
        ...changesFor(sessions, patches),
        message: option.swapWith
          ? `${session.title} and ${option.swapWith.title} swapped days.`
          : `${session.title} moved to ${formatDay(to)}.`,
      });
    },
    [run, sessions],
  );

  const setIndoor = useCallback(
    (session: PlanSession, indoor: boolean) => {
      void run({
        ...changesFor(sessions, [{ id: session.id, patch: { indoor } }]),
        message: `${session.title} set to ${indoor ? "indoor" : "outdoor"}.`,
      });
    },
    [run, sessions],
  );

  const hideCard = useCallback(() => {
    hide(registry);
  }, [registry]);

  return useMemo(
    () => ({ markDone, skip, move, setIndoor, hideCard, isPending }),
    [markDone, skip, move, setIndoor, hideCard, isPending],
  );
}
