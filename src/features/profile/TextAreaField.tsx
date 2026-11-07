import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { FieldError } from "./form-parts";

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
        <label htmlFor={id} className="mb-1.5 block text-caption font-semibold text-text">
          {label}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={
            "block min-h-24 w-full resize-y rounded-md border bg-surface px-3.5 py-2.5 text-body text-text " +
            "focus:outline-2 focus:outline-(--focus) " +
            (error
              ? "border-danger focus:border-danger"
              : "border-input-border hover:border-muted focus:border-focus")
          }
          {...rest}
        />
        {counter ? <p className="mt-1.5 text-right text-caption text-muted">{counter}</p> : null}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
        {helper ? (
          <p id={helperId} className="mt-1.5 text-caption text-muted">
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);
