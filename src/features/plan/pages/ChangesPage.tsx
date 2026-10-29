import { EmptyState } from "@/components/ui";

// owned by changes stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** R4: what moved and why, Undo all. */
export function ChangesPage() {
  return (
    <section aria-labelledby="plan-changes">
      <h2 id="plan-changes" className="mb-4 text-lg font-semibold tracking-tight">
        Plan changes
      </h2>
      <EmptyState>The list of plan changes is coming.</EmptyState>
    </section>
  );
}
