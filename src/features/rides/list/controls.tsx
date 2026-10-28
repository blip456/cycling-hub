import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import type { GroupBy } from "../format";
import { fieldClass } from "./field-class";

/** Week / Month segmented control (DESIGN.md): native radios, so arrow keys move the selection. */
export function GroupBySwitch({
  value,
  onChange,
}: {
  value: GroupBy;
  onChange: (value: GroupBy) => void;
}) {
  const name = useId();
  const options: { value: GroupBy; label: string }[] = [
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Group rides by"
      className="flex h-11 shrink-0 gap-0.5 rounded-[12px] bg-track p-[3px]"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={
            "relative flex min-w-[72px] cursor-pointer items-center justify-center rounded-[9px] px-4 text-[15px] font-medium text-muted " +
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

/** Checkbox row (DESIGN.md): 20 px box, the whole row with its label is the 44 px target. */
export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 text-[15px]">
      <span className="relative flex size-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
          className={
            "peer size-5 cursor-pointer appearance-none rounded-[6px] border-2 border-input-border " +
            "checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          }
        />
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable={false}
          className="pointer-events-none absolute inset-0 hidden size-5 text-on-accent peer-checked:block"
        >
          <path
            d="m5.5 10.5 3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {children}
    </label>
  );
}

/** Label above, field below (DESIGN.md input). */
export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] leading-[18px] font-semibold">
      {children}
    </label>
  );
}

export function SelectField({
  label,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <select id={id} className={`${fieldClass} appearance-none pr-10`} {...rest}>
          {children}
        </select>
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          aria-hidden="true"
          focusable={false}
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text"
        >
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
