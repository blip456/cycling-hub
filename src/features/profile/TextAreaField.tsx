import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "placeholder" | "id"
> {
  label: string;
  helper?: string;
  error?: string | undefined;
  /** Shown below the field, right-aligned, e.g. "0 / 200". */
  counter?: string;
}

/** Same pattern as TextField: label above, error then helper below, linked with aria-describedby. */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, helper, error, counter, className = "", ...rest }, ref) {
    const id = useId();
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;
    const describedBy =
      [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
          {label}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={
            "block min-h-24 w-full resize-y rounded-md border bg-surface px-3.5 py-2.5 text-base text-text " +
            "focus:border-accent focus:outline-2 focus:outline-accent " +
            (error ? "border-accent" : "border-input-border")
          }
          {...rest}
        />
        {counter ? <p className="mt-1.5 text-right text-[13px] text-muted">{counter}</p> : null}
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
      </div>
    );
  },
);
