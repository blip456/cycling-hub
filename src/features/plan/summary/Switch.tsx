import { useId } from "react";

/**
 * A real switch (role="switch") in a 44 px row: the position and the label tell the state, never colour
 * alone. Same look as the weight reminder switch in Settings.
 */
export function Switch({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
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
        onClick={() => {
          onChange(!checked);
        }}
        className="flex min-h-12 w-full items-center gap-3 rounded-md text-left text-[15px] hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span id={labelId} className="grow">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={
            "relative h-8 w-[52px] shrink-0 rounded-full border-2 transition-colors " +
            (checked ? "border-accent bg-accent" : "border-input-border bg-track")
          }
        >
          <span
            className={
              "absolute top-0.5 size-6 rounded-full motion-safe:transition-[left] " +
              (checked ? "left-[22px] bg-on-accent" : "left-0.5 bg-muted")
            }
          />
        </span>
      </button>
      {helper ? (
        <p id={helperId} className="pb-1 text-[13px] text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
