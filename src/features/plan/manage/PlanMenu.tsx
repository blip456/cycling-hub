import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronRightIcon } from "@/components/icons";

const itemClass =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-semibold hover:bg-subtle";

/**
 * The plan options on the Plan page and the Overview: Edit plan and Remove plan. A button that opens a short list
 * (not an ARIA menu: plain links and buttons, so every key works as on any page). Escape closes it and gives the
 * focus back to the button; so does choosing "Remove plan" and then "Keep plan".
 */
export function PlanMenu() {
  const [open, setOpen] = useState(false);
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
        </ul>
      ) : null}
    </div>
  );
}
