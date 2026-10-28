import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { Button, FormAlert, TextField } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessages } from "@/lib/auth/errors";
import { fieldErrors, forgotPasswordSchema } from "@/lib/auth/schemas";
import { AuthLayout } from "./AuthLayout";

const RESEND_SECONDS = 60;

/** A3 (enter email) and A4 (check your email). The outcome never reveals whether the address has an account. */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (address: string) => requestPasswordReset(address),
    onSuccess: (result, address) => {
      if (!result.ok) {
        setFormError(authErrorMessages[result.error]);
        return;
      }
      setSentTo(address);
      setSecondsLeft(RESEND_SECONDS);
    },
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [secondsLeft]);

  useEffect(() => {
    if (sentTo) headingRef.current?.focus();
  }, [sentTo]);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      emailRef.current?.focus();
      return;
    }
    setError(undefined);
    mutation.mutate(parsed.data.email);
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" back={{ to: "/sign-in", label: "Sign in" }}>
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <p className="mb-8 text-[15px] text-text">
            If an account exists for this address, a reset link is on its way.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/sign-in" className={buttonClass("primary", "w-full")}>
            Back to sign in
          </Link>
          <Button
            variant="secondary"
            block
            disabled={secondsLeft > 0 || mutation.isPending}
            onClick={() => {
              setFormError(null);
              mutation.mutate(sentTo);
            }}
          >
            {secondsLeft > 0 ? `Resend link (available in ${secondsLeft} s)` : "Resend link"}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" back={{ to: "/sign-in", label: "Sign in" }}>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <p className="mb-6 text-[15px] text-muted">
        We will email you a link to choose a new password.
      </p>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <TextField
          ref={emailRef}
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          error={error}
          helper="The link works once and expires after 1 hour."
        />
        <Button type="submit" block disabled={mutation.isPending} className="mt-1">
          {mutation.isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
