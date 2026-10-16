import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { AuthContext, type AuthContextValue, type AuthResult, type AuthStatus, type SignedOutReason } from "./auth-context";
import { toAuthErrorKind } from "./errors";
import { initialAuthUrl } from "./initial-url";
import { isSessionExpired } from "./session-age";

/** How often the 30-day rule is re-checked while the app stays open (it is also checked on resume). */
const AGE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function tryGetClient(): { client: SupabaseClient | null; error: string | null } {
  try {
    return { client: getSupabase(), error: null };
  } catch (error) {
    return { client: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [{ client, error: configError }] = useState(tryGetClient);
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "misconfigured");
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(initialAuthUrl.isRecovery);
  const [signedOutReason, setSignedOutReason] = useState<SignedOutReason>(null);
  const recoveryRef = useRef(recovery);
  recoveryRef.current = recovery;

  const expire = useCallback(async () => {
    if (!client) return;
    setSignedOutReason("expired");
    await client.auth.signOut({ scope: "local" });
    queryClient.clear();
  }, [client, queryClient]);

  /** Applies a session from Supabase, enforcing the 30-day rule (A3). */
  const applySession = useCallback(
    (next: Session | null) => {
      // A password reset link creates a fresh session; the rule applies again once the password is saved.
      if (next && !recoveryRef.current && isSessionExpired(next.user.last_sign_in_at)) {
        // Never call Supabase from inside onAuthStateChange (it holds a lock); defer it.
        setTimeout(() => void expire(), 0);
        setSession(null);
        setStatus("signedOut");
        return;
      }
      setSession(next);
      setStatus(next ? "signedIn" : "signedOut");
    },
    [expire],
  );

  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setRecovery(true);
      }
      applySession(next);
    });

    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      void client.auth.getSession().then(({ data: { session: current } }) => applySession(current));
    };
    document.addEventListener("visibilitychange", recheck);
    const timer = window.setInterval(recheck, AGE_CHECK_INTERVAL_MS);

    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.clearInterval(timer);
    };
  }, [client, applySession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!client) return { ok: false, error: "unknown" };
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: toAuthErrorKind(error) };
        setSignedOutReason(null);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAuthErrorKind(error) };
      }
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    setSignedOutReason(null);
    // Local scope: signing out on the phone keeps the desktop session (and vice versa).
    await client.auth.signOut({ scope: "local" });
    queryClient.clear();
  }, [client, queryClient]);

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!client) return { ok: false, error: "unknown" };
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          const kind = toAuthErrorKind(error);
          // A4: the outcome must not reveal whether the address has an account.
          if (kind === "network" || kind === "rate_limited") return { ok: false, error: kind };
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAuthErrorKind(error) };
      }
    },
    [client],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<AuthResult> => {
      if (!client) return { ok: false, error: "unknown" };
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) return { ok: false, error: toAuthErrorKind(error) };
        recoveryRef.current = false;
        setRecovery(false);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAuthErrorKind(error) };
      }
    },
    [client],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      recovery,
      recoveryError: initialAuthUrl.errorCode,
      signedOutReason,
      configError,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [status, session, recovery, signedOutReason, configError, signIn, signOut, requestPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
