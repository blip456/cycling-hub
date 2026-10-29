import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui";
import { buttonClass } from "@/components/button-class";

/** A swatch in the zone token colour with the zone as text next to it: "Z4 · Threshold" (never colour alone). */
export function ZoneLabel({ zone, label }: { zone: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-sm"
        style={{ backgroundColor: `var(--zone-${String(Math.min(Math.max(zone, 1), 7))})` }}
      />
      <span>{label}</span>
    </span>
  );
}

/** T9a: grey shapes in the form of the page, with a text for screen readers. */
export function PlanSkeleton({ desktop }: { desktop: boolean }) {
  const shape = "rounded-2xl bg-surface motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]";
  return (
    <div role="status">
      <span className="sr-only">Loading your plan</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className={`${shape} h-28`} />
        <div className={`${shape} h-11 w-48`} />
        {desktop ? (
          <div className="grid grid-cols-7 gap-3">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`${shape} h-40`} />
            ))}
          </div>
        ) : (
          [0, 1, 2, 3].map((i) => <div key={i} className={`${shape} h-16`} />)
        )}
      </div>
    </div>
  );
}

/** T9b: the page body when the plan could not be loaded. */
export function PlanLoadError({ retry }: { retry: () => void }) {
  return (
    <div className="max-w-[560px] rounded-2xl bg-surface px-5 py-6">
      <h2 className="text-[17px] font-semibold">We could not load your plan</h2>
      <p className="mt-1 text-[15px] text-muted">
        Your plan is safe. The page could not reach the server.
      </p>
      <Button variant="secondary" className="mt-3" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

/** A link that looks like a button. */
export function LinkButton({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link to={to} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

/** A row of a definition list with a muted label (for summaries). */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}

/** A radio or checkbox row with a label and an optional line of help: the whole row is the 44 px target. */
export function ChoiceRow({
  type,
  name,
  value,
  checked,
  onChange,
  focusFirst,
  disabled,
  describedBy,
  invalid,
  children,
  note,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  focusFirst?: boolean;
  disabled?: boolean;
  describedBy?: string | undefined;
  invalid?: boolean;
  children: ReactNode;
  note?: string | undefined;
}) {
  return (
    <label
      className={
        "flex min-h-11 items-start gap-3 rounded-md px-1 py-2 text-[15px] text-text " +
        (disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer")
      }
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled ?? false}
        onChange={onChange}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        {...(focusFirst ? { "data-autofocus": "" } : {})}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block font-medium">{children}</span>
        {note ? <span className="block text-[13px] text-muted">{note}</span> : null}
      </span>
    </label>
  );
}
