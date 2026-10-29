import { EmptyState } from "@/components/ui";

// owned by session stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** T7, T8: the session detail at /plan/session/:id. */
export function SessionPage() {
  return (
    <section aria-labelledby="plan-session">
      <h2 id="plan-session" className="mb-4 text-lg font-semibold tracking-tight">
        Session
      </h2>
      <EmptyState>The session detail is coming.</EmptyState>
    </section>
  );
}
