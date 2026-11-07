import { AlertIcon } from "./icons";
import { buttonClass, type ButtonVariant } from "./button-class";
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, `${block ? "w-full" : ""} ${className}`)}
      {...rest}
    />
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "id"> {
  label: string;
  helper?: string;
  error?: string | undefined;
  /** Extra element inside the input row, after the input (e.g. a Show button). */
  trailing?: ReactNode;
}

/** Label above, helper below, error linked through aria-describedby. Never a placeholder. */
export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, helper, error, trailing, className = "", ...rest },
  ref,
) {
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
      <div
        className={
          "flex min-h-11 items-center rounded-md border bg-surface " +
          "focus-within:outline-2 focus-within:outline-(--focus) " +
          (error
            ? "border-danger focus-within:border-danger"
            : "border-input-border hover:border-muted focus-within:border-focus")
        }
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-h-11 w-full min-w-0 flex-1 rounded-md bg-transparent px-3.5 text-body text-text outline-none"
          {...rest}
        />
        {trailing}
      </div>
      {error ? (
        <p
          id={errorId}
          className="mt-1.5 flex items-start gap-1.5 text-caption font-medium text-danger"
        >
          <AlertIcon width={16} height={16} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="mt-1.5 text-caption text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
});

type PasswordFieldProps = Omit<FieldProps, "type" | "trailing">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextField
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        trailing={
          <button
            type="button"
            onClick={() => {
              setVisible((v) => !v);
            }}
            aria-pressed={visible}
            aria-label={visible ? "Hide password" : "Show password"}
            className="mr-1 min-h-11 min-w-11 shrink-0 rounded-sm px-2.5 text-body font-semibold text-accent hover:bg-fill"
          >
            {visible ? "Hide" : "Show"}
          </button>
        }
      />
    );
  },
);

/** Form-level message above the form, announced to screen readers (A2). */
export function FormAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        "mb-5 flex items-start gap-2 rounded-md px-4 py-3 text-body text-text " +
        (tone === "error" ? "bg-danger-soft" : "bg-accent-soft")
      }
    >
      {tone === "error" ? (
        <AlertIcon width={18} height={18} className="mt-0.5 shrink-0 text-danger" />
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface px-5 py-8 text-body text-muted">{children}</p>;
}
