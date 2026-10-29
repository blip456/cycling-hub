import { EmptyState } from "@/components/ui";

// owned by intake stream: this file is yours; the route and the menu item are already wired (nav-items.ts, App.tsx).

/** T1.0 to T3: the intake stepper at /plan/new. */
export function IntakePage() {
  return (
    <section aria-labelledby="plan-intake">
      <h2 id="plan-intake" className="mb-4 text-lg font-semibold tracking-tight">
        Build your plan
      </h2>
      <EmptyState>The plan intake is coming.</EmptyState>
    </section>
  );
}
