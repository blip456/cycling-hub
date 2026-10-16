/**
 * Snapshot of the auth parameters in the URL at start-up, taken before supabase-js reads and strips them.
 * Supabase's reset link lands on /reset-password with `#access_token=…&type=recovery`, or with
 * `#error=…&error_code=otp_expired` when the link is expired or already used.
 */
export interface InitialAuthUrl {
  isRecovery: boolean;
  errorCode: string | null;
}

export function readAuthParams(href: string): InitialAuthUrl {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);
  const errorCode = params.get("error_code") ?? params.get("error");
  return { isRecovery: params.get("type") === "recovery", errorCode };
}

export const initialAuthUrl: InitialAuthUrl =
  typeof window === "undefined" ? { isRecovery: false, errorCode: null } : readAuthParams(window.location.href);
