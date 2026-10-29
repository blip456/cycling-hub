import { EmptyState } from "@/components/ui";

// owned by week stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** T5, T6: the Week tab, the Plan page default (today's session on top, then the week). */
export function WeekPage() {
  return (
    <section aria-labelledby="plan-week">
      <h2 id="plan-week" className="mb-4 text-lg font-semibold tracking-tight">
        This week
      </h2>
      <EmptyState>The weekly view is coming.</EmptyState>
    </section>
  );
}
