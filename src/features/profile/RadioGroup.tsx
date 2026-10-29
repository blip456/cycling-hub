import { useId } from "react";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Extra text under the label, for answers that need a word of explanation. */
  detail?: string;
}

interface RadioGroupProps<T extends string> {
  legend: string;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  helper?: string;
  error?: string | undefined;
  /** Lay the options out in a row on wide screens (short labels only). */
  inline?: boolean;
}

/**
 * A fieldset with a visible legend and native radio buttons (arrow keys move the selection), 44 px rows.
 * Error first, then helper, both linked with aria-describedby (3.3.1).
 */
export function RadioGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  helper,
  error,
  inline = false,
}: RadioGroupProps<T>) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="mb-1 text-[13px] font-semibold text-text">{legend}</legend>
      <div className={inline ? "flex flex-col sm:flex-row sm:gap-5" : "flex flex-col"}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-[15px]"
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className="size-5 shrink-0 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <span className="min-w-0">
              {option.label}
              {option.detail ? (
                <span className="block text-[13px] text-muted">{option.detail}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-[13px] font-medium text-text">
          <span aria-hidden="true" className="mr-1 text-accent">
            !
          </span>
          {error}
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="mt-1.5 text-[13px] text-muted">
          {helper}
        </p>
      ) : null}
    </fieldset>
  );
}
