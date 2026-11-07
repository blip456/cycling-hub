import { useId } from "react";

/**
 * Segmented control (DESIGN.md): a --track container (radius 12, 3 px padding, 44 high) with radio semantics.
 * The selected segment is --raised with a 1 px inset --input-border edge and a heavier weight, so the state is
 * never colour alone. Arrow keys move the selection (native radios in one group).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex h-11 gap-0.5 rounded-md bg-track p-[3px] ${className}`}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={
            "flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-sm px-4 text-body font-medium text-muted " +
            "transition-colors duration-(--dur-fast) hover:text-text has-checked:bg-raised has-checked:font-semibold has-checked:text-text " +
            "has-checked:shadow-[inset_0_0_0_1px_var(--input-border)] " +
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          }
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onChange(option.value);
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
