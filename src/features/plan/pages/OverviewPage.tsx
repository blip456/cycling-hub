import { EmptyState } from "@/components/ui";

// owned by overview stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** T4: the Overview tab (12 weeks, phases, load bar). */
export function OverviewPage() {
  return (
    <section aria-labelledby="plan-overview">
      <h2 id="plan-overview" className="mb-4 text-lg font-semibold tracking-tight">
        Plan overview
      </h2>
      <EmptyState>The plan overview is coming.</EmptyState>
    </section>
  );
}
