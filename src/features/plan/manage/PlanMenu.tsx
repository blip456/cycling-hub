import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { ChevronRightIcon } from "@/components/icons";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import { dangerSolidButtonClass } from "@/features/rides/detail/danger-button";
import type { StoredPlan } from "../data";
import { useRemovePlan } from "./use-remove-plan";

const itemClass =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-semibold hover:bg-subtle";

/** What is removed and what stays, in plain English (P82). */
function RemoveDialog({
  open,
  pending,
  onRemove,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Remove this plan?"
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            className={`${dangerSolidButtonClass} w-full`}
            aria-disabled={pending}
            onClick={() => {
              if (!pending) onRemove();
            }}
          >
            {pending ? "Removing plan" : "Remove plan"}
          </button>
          <button
            type="button"
            // The safe choice gets the focus when the dialog opens.
            data-autofocus
            className={buttonClass("secondary", "w-full")}
            onClick={onClose}
          >
            Keep plan
          </button>
        </>
      }
    >
      <p>
        <strong className="font-semibold text-text">This is removed:</strong>
      </p>
      <ul className="mt-1 list-disc pl-5">
        <li>All planned sessions.</li>
        <li>
          The plan history: the sessions you marked as done or missed, and the log of plan updates.
        </li>
      </ul>
      <p className="mt-3">
        <strong className="font-semibold text-text">This stays:</strong>
      </p>
      <ul className="mt-1 list-disc pl-5">
        <li>Your rides.</li>
        <li>Your profile, your weight log and your weight goal.</li>
        <li>Your baseline (FTP and zones).</li>
      </ul>
      <p className="mt-3 font-semibold text-text">This cannot be undone.</p>
      <p className="mt-1">You can build a new plan afterwards.</p>
    </ConfirmDialog>
  );
}

/**
 * The plan options on the Plan page and the Overview: Edit plan and Remove plan. A button that opens a short list
 * (not an ARIA menu: plain links and buttons, so every key works as on any page). Escape closes it and gives the
 * focus back to the button; so does choosing "Remove plan" and then "Keep plan".
 */
export function PlanMenu({ plan }: { plan: StoredPlan }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const remove = useRemovePlan();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="-mb-px inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[15px] font-semibold text-accent hover:bg-subtle"
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        Plan options
        <ChevronRightIcon
          aria-hidden="true"
          width={16}
          height={16}
          className={open ? "-rotate-90" : "rotate-90"}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl bg-raised p-1 shadow-raised"
        >
          <li>
            <Link
              to="/plan/edit"
              className={itemClass}
              onClick={() => {
                setOpen(false);
              }}
            >
              Edit plan
            </Link>
          </li>
          <li>
            <button
              type="button"
              className={`${itemClass} text-danger`}
              onClick={() => {
                setOpen(false);
                setConfirm(true);
              }}
            >
              Remove plan
            </button>
          </li>
        </ul>
      ) : null}
      <RemoveDialog
        open={confirm}
        pending={remove.isPending}
        onRemove={() => {
          void remove.remove(plan.id).then(() => {
            setConfirm(false);
          });
        }}
        onClose={() => {
          setConfirm(false);
          buttonRef.current?.focus();
        }}
      />
    </div>
  );
}
