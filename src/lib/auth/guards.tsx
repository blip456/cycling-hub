import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./auth-context";

function Pending() {
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center text-[15px] text-muted"
    >
      Loading…
    </div>
  );
}

/** Routes behind sign-in: signed-out visitors go to /sign-in and come back after signing in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Pending />;
  if (status !== "signedIn") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/sign-in" replace state={{ from }} />;
  }
  return children;
}

/**
 * Sign-in and forgot-password are for signed-out visitors only. After signing in this sends the user back
 * to the page RequireAuth stored in `state.from` (the session arrives through onAuthStateChange).
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Pending />;
  if (status === "signedIn") {
    const from = (location.state as { from?: unknown } | null)?.from;
    const target =
      typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/rides";
    return <Navigate to={target} replace />;
  }
  return children;
}
