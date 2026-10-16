import { useMutation } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button, FormAlert, PasswordField, TextField } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessages } from "@/lib/auth/errors";
import { fieldErrors, signInSchema } from "@/lib/auth/schemas";
import { AuthLayout } from "./AuthLayout";

/** A1 / A2: email + password sign-in. No sign-up anywhere (A1). */
export function SignInPage() {
  const { signIn, signedOutReason } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => signIn(values.email, values.password),
    onSuccess: (result) => {
      // On success the session arrives through onAuthStateChange and RedirectIfSignedIn navigates
      // back to the page in `state.from`.
      if (result.ok) return;
      setFormError(authErrorMessages[result.error]);
      if (result.error === "invalid_credentials") {
        // A2: keep the email, clear and focus the password.
        setPassword("");
        passwordRef.current?.focus();
      }
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next = fieldErrors(parsed.error);
      setErrors(next);
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <AuthLayout title="Sign in">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      {!formError && signedOutReason === "expired" ? (
        <FormAlert tone="info">It has been 30 days. Please sign in again.</FormAlert>
      ) : null}
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
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" block disabled={mutation.isPending} className="mt-1">
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center">
        <Link
          to="/forgot-password"
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold text-accent hover:bg-subtle"
        >
          Forgot password?
        </Link>
      </p>
    </AuthLayout>
  );
}
