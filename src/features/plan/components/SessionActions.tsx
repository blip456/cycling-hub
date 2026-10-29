import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import {
  formatDay,
  moveOptions,
  moveWarnings,
  usePlanActions,
  usePlanData,
  type MoveOption,
  type PlanSession,
} from "../data";
import { ChoiceRow } from "./parts";
import { useToday } from "./page-hooks";
import {
  canAct,
  SessionActionsContext,
  useSessionActions,
  type SessionActionsValue,
} from "./session-actions-context";

const SKIP_REASONS = ["Busy", "Ill or injured", "Tired", "Something else"] as const;

function MoveDialog({
  session,
  sessions,
  availableDays,
  today,
  onMove,
  onClose,
}: {
  session: PlanSession;
  sessions: readonly PlanSession[];
  availableDays: Parameters<typeof moveOptions>[2];
  today: string;
  onMove: (option: MoveOption) => void;
  onClose: () => void;
}) {
  const options = useMemo(
    () => moveOptions(session, sessions, availableDays, today),
    [session, sessions, availableDays, today],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const noteId = useId();
  const option = options.find((o) => o.date === chosen) ?? null;
  const warnings = option ? moveWarnings(session, option, sessions) : [];
  return (
    <ConfirmDialog
      open
      title={`Move ${session.title}`}
      onClose={onClose}
      actions={
        <>
          <Button
            aria-disabled={option === null}
            onClick={() => {
              if (!option) return;
              onMove(option);
              onClose();
            }}
          >
            Move session
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <p>There is no day left this week to move it to. Open another week first.</p>
      ) : (
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold text-text">Move to</legend>
          {options.map((o, i) => (
            <ChoiceRow
              type="radio"
              key={o.date}
              name="move-to"
              value={o.date}
              checked={chosen === o.date}
              focusFirst={i === 0}
              describedBy={chosen === o.date && warnings.length > 0 ? noteId : undefined}
              onChange={() => {
                setChosen(o.date);
              }}
              note={o.note}
            >
              {formatDay(o.date)}
            </ChoiceRow>
          ))}
          <p className="mt-1 text-[13px]">
            Days up to the end of this week. To move further, open another week first.
          </p>
        </fieldset>
      )}
      {warnings.length > 0 ? (
        <div id={noteId} role="note" className="mt-3 rounded-md bg-subtle px-3 py-2 text-text">
          {warnings.map((w) => (
            <p key={w} className="text-[14px]">
              <span aria-hidden="true">! </span>
              {w}
            </p>
          ))}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

function SkipDialog({
  session,
  onSkip,
  onClose,
}: {
  session: PlanSession;
  onSkip: (reason: string | null) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      title={`Skip ${session.title}?`}
      onClose={onClose}
      actions={
        <>
          <Button
            className="bg-danger text-on-danger"
            onClick={() => {
              onSkip(reason);
              onClose();
            }}
          >
            Skip session
          </Button>
          <Button variant="secondary" data-autofocus="" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <p>The session stays in the plan as skipped. You can undo it right after.</p>
      <fieldset className="mt-3">
        <legend className="mb-1 text-[13px] font-semibold text-text">Reason (optional)</legend>
        {SKIP_REASONS.map((r) => (
          <ChoiceRow
            type="radio"
            key={r}
            name="skip-reason"
            value={r}
            checked={reason === r}
            onChange={() => {
              setReason(r);
            }}
          >
            {r}
          </ChoiceRow>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}

/**
 * Holds the session actions for the Plan pages (T8): mark done, move (a sheet or dialog), skip (a
 * confirmation) and Undo. Mount it once above the pages that show sessions.
 */
export function SessionActionsProvider({ children }: { children: ReactNode }) {
  const { plan, sessions } = usePlanData();
  const actions = usePlanActions(sessions);
  const today = useToday();
  const [moving, setMoving] = useState<PlanSession | null>(null);
  const [skipping, setSkipping] = useState<PlanSession | null>(null);
  const value = useMemo<SessionActionsValue>(
    () => ({ actions, askMove: setMoving, askSkip: setSkipping }),
    [actions],
  );
  return (
    <SessionActionsContext.Provider value={value}>
      {children}
      {moving ? (
        <MoveDialog
          session={moving}
          sessions={sessions}
          availableDays={plan?.intake?.availableDays ?? []}
          today={today}
          onMove={(option) => {
            actions.move(moving, option);
          }}
          onClose={() => {
            setMoving(null);
          }}
        />
      ) : null}
      {skipping ? (
        <SkipDialog
          session={skipping}
          onSkip={(reason) => {
            actions.skip(skipping, reason);
          }}
          onClose={() => {
            setSkipping(null);
          }}
        />
      ) : null}
    </SessionActionsContext.Provider>
  );
}

/** T8a: the three-dot button with the menu Mark as done, Move to another day, Skip this session. */
export function ActionsMenu({ session }: { session: PlanSession }) {
  const { actions, askMove, askSkip } = useSessionActions();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (!canAct(session)) return null;

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const list = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function choose(action: () => void) {
    close(true);
    action();
  }

  const itemClass =
    "flex min-h-11 w-full items-center rounded-sm px-3 text-left text-[15px] text-text hover:bg-subtle focus-visible:bg-subtle";

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`More actions for ${session.title}`}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="flex size-11 items-center justify-center rounded-md text-text hover:bg-subtle"
      >
        <span aria-hidden="true" className="text-[20px] leading-none">
          ⋯
        </span>
      </button>
      {open ? (
        // The menu handles arrow keys, Escape and Tab for the menu items inside it.
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${session.title}`}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-raised p-1"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              choose(() => {
                actions.markDone(session);
              });
            }}
          >
            Mark as done
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              choose(() => {
                askMove(session);
              });
            }}
          >
            Move to another day
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              choose(() => {
                askSkip(session);
              });
            }}
          >
            Skip this session
          </button>
        </div>
      ) : null}
    </div>
  );
}
