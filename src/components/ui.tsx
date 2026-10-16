import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "bg-subtle text-text hover:bg-border",
  ghost: "text-accent hover:bg-subtle",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({ variant = "primary", block = false, className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, `${block ? "w-full" : ""} ${className}`)} {...rest} />;
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
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text">
        {label}
      </label>
      <div
        className={
          "flex min-h-11 items-center rounded-xl border bg-surface focus-within:border-accent " +
          "focus-within:outline-2 focus-within:outline-accent " +
          (error ? "border-accent" : "border-input-border")
        }
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl bg-transparent px-3.5 text-base text-text outline-none"
          {...rest}
        />
        {trailing}
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
    </div>
  );
});

type PasswordFieldProps = Omit<FieldProps, "type" | "trailing">;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(props, ref) {
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
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="mr-1 min-h-11 min-w-11 shrink-0 rounded-lg px-2.5 text-[14px] font-semibold text-accent hover:bg-subtle"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
});

/** Form-level message above the form, announced to screen readers (A2). */
export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        "mb-5 rounded-xl px-4 py-3 text-[15px] text-text " + (tone === "error" ? "bg-subtle" : "bg-accent-soft")
      }
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[15px] text-muted">{children}</p>;
}
