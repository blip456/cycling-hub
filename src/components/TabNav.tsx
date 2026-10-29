import type { ReactNode } from "react";
import { NavLink } from "react-router";

export interface TabItem {
  to: string;
  label: string;
  /** Match only this exact path (the first tab, whose path is the parent of the others). */
  end?: boolean;
}

/**
 * Route-based tabs for a page with a few sibling views (Weight: Log and Trend; Baseline: Baseline, Zones,
 * History; P48). Each tab is a link with its own URL, so the browser Back button, deep links and screen
 * readers work without extra behaviour: `aria-current="page"` marks the current tab, and the current tab
 * is also bold with an underline, so colour is never the only signal. 44 px targets.
 */
export function TabNav({
  label,
  tabs,
  trailing,
}: {
  label: string;
  tabs: readonly TabItem[];
  /** An action at the end of the tab row (Plan options). It is not a tab. */
  trailing?: ReactNode;
}) {
  return (
    <nav aria-label={label} className="mb-5">
      <ul className="flex gap-1 border-b border-border">
        {tabs.map(({ to, label: text, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end ?? false}
              className={({ isActive }) =>
                "-mb-px flex min-h-11 items-center border-b-2 px-4 text-[15px] " +
                (isActive
                  ? "border-accent font-semibold text-text"
                  : "border-transparent text-muted hover:text-text")
              }
            >
              {text}
            </NavLink>
          </li>
        ))}
        {trailing ? <li className="ml-auto">{trailing}</li> : null}
      </ul>
    </nav>
  );
}
