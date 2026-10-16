import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

export type AuthErrorKind =
  | "invalid_credentials"
  | "network"
  | "rate_limited"
  | "weak_password"
  | "same_password"
  | "session_missing"
  | "unknown";

/** Messages per A2. Wrong email and wrong password share one message, so nothing reveals whether an email exists. */
export const authErrorMessages: Record<AuthErrorKind, string> = {
  invalid_credentials: "Email or password is incorrect.",
  network: "No connection. Check your network and try again.",
  rate_limited: "Too many attempts. Try again in a few minutes.",
  weak_password: "Use at least 12 characters.",
  same_password: "Choose a password that is different from your current one.",
  session_missing: "This link has expired or was already used.",
  unknown: "Something went wrong. Try again.",
};

export function toAuthErrorKind(error: unknown): AuthErrorKind {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  if (isAuthRetryableFetchError(error)) return "network";
  if (error instanceof TypeError) return "network"; // fetch failed
  if (!isAuthError(error)) return "unknown";

  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
    return "rate_limited";
  }
  switch (error.code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_not_found":
    case "user_banned":
      return "invalid_credentials";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "session_missing";
  }
  if (error.name === "AuthSessionMissingError") return "session_missing";
  if (error.status === 400 && /invalid login credentials/i.test(error.message)) return "invalid_credentials";
  if (error.status === 0) return "network";
  return "unknown";
}
