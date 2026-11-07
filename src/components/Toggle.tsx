import { useId } from "react";

/**
 * The toggle (DESIGN.md, Toggle): a real switch (role="switch") in a row of at least 44 px. The label
 * sits on the left, the track on the right; position and the label tell the state, never colour alone.
 * Helper text sits below, wired with aria-describedby. `rowClassName` lets a host group set its own row
 * padding and hover.
 */
export function Toggle({
  label,
  checked,
  onChange,
  helper,
  disabled = false,
  rowClassName = "min-h-12 rounded-md hover:bg-fill",
  helperClassName = "pb-1",
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  disabled?: boolean;
  rowClassName?: string;
  helperClassName?: string;
}) {
  const labelId = useId();
  const helperId = useId();
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={helper ? helperId : undefined}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={`flex w-full items-center gap-3 text-left text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${rowClassName}`}
      >
        <span id={labelId} className="grow">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={
            "relative h-8 w-[52px] shrink-0 rounded-2xl border-2 motion-safe:transition-colors " +
            (checked ? "border-accent bg-accent" : "border-input-border bg-track")
          }
        >
          <span
            className={
              "absolute top-0.5 size-6 rounded-xl motion-safe:transition-[left] " +
              (checked ? "left-[22px] bg-on-accent" : "left-0.5 bg-muted")
            }
          />
        </span>
      </button>
      {helper ? (
        <p id={helperId} className={`text-caption text-muted ${helperClassName}`}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}
