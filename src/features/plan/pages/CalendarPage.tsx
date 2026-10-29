import { EmptyState } from "@/components/ui";

// owned by calendar stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** R10: the ICS download. */
export function CalendarPage() {
  return (
    <section aria-labelledby="plan-calendar">
      <h2 id="plan-calendar" className="mb-4 text-lg font-semibold tracking-tight">
        Calendar
      </h2>
      <EmptyState>The calendar export is coming.</EmptyState>
    </section>
  );
}
