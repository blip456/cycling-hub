import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { AuthErrorKind } from "./errors";

export type AuthStatus = "loading" | "signedIn" | "signedOut" | "misconfigured";

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorKind };

/** Why the user was signed out, if not by choice. Shown on the sign-in page. */
export type SignedOutReason = "expired" | null;

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** Set while the user arrived from a password reset link (PASSWORD_RECOVERY / type=recovery). */
  recovery: boolean;
  /** Error code from a reset link that failed (e.g. otp_expired). */
  recoveryError: string | null;
  signedOutReason: SignedOutReason;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
