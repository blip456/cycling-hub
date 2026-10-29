import { EmptyState } from "@/components/ui";

// owned by summary stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** R11: summary of a session, a week or a month to copy. */
export function SummaryPage() {
  return (
    <section aria-labelledby="plan-summary">
      <h2 id="plan-summary" className="mb-4 text-lg font-semibold tracking-tight">
        Summary
      </h2>
      <EmptyState>The summary is coming.</EmptyState>
    </section>
  );
}
