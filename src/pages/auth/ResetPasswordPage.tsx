import { useMutation } from "@tanstack/react-query";
import { useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { FlashState } from "@/components/AppShell";
import { buttonClass } from "@/components/button-class";
import { Button, FormAlert, PasswordField } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessages } from "@/lib/auth/errors";
import { fieldErrors, newPasswordSchema } from "@/lib/auth/schemas";
import { AuthLayout } from "./AuthLayout";

/**
 * A5: opened from the reset email. Supabase signs the user in with a recovery session
 * (PASSWORD_RECOVERY / #type=recovery); saving the new password keeps them signed in (A5 → B1).
 */
export function ResetPasswordPage() {
  const { status, session, recoveryError, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (value: string) => updatePassword(value),
    onSuccess: (result) => {
      if (result.ok) {
        const state: FlashState = { flash: "Password changed." };
        void navigate("/rides", { replace: true, state });
        return;
      }
      if (result.error === "session_missing") {
        setLinkInvalid(true);
      } else if (result.error === "weak_password" || result.error === "same_password") {
        setError(authErrorMessages[result.error]);
        passwordRef.current?.focus();
      } else {
        setFormError(authErrorMessages[result.error]);
      }
    },
  });

  if (status === "loading") {
    return <AuthLayout title="Choose a new password">{null}</AuthLayout>;
  }

  if (linkInvalid || recoveryError || status !== "signedIn") {
    return (
      <AuthLayout title="Link expired">
        <p className="mb-8 text-[15px] text-text">This link has expired or was already used.</p>
        <Link to="/forgot-password" className={buttonClass("primary", "w-full")}>
          Send a new link
        </Link>
      </AuthLayout>
    );
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsed = newPasswordSchema.safeParse({ password });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).password);
      passwordRef.current?.focus();
      return;
    }
    setError(undefined);
    mutation.mutate(parsed.data.password);
  };

  return (
    <AuthLayout title="Choose a new password">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* Hidden username so password managers save the new password on the right entry. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={session?.user.email ?? ""}
          readOnly
          hidden
        />
        <PasswordField
          ref={passwordRef}
          label="New password"
          name="new-password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
          error={error}
          helper="At least 12 characters. Several words together are easy to remember."
        />
        <Button type="submit" block disabled={mutation.isPending} className="mt-1">
          {mutation.isPending ? "Saving…" : "Save and sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
