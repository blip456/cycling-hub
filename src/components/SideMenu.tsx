import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { navItems } from "./nav-items";

/**
 * Menu content shared by the phone drawer and the permanent desktop side bar (N1b, P7, P8). On desktop
 * the status card goes in `status`, at the bottom above the version (P31, DS8).
 */
export function SideMenu({ onNavigate, status }: { onNavigate?: () => void; status?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <p className="px-3 pb-6 text-base font-semibold tracking-tight text-text">Cycling Hub</p>
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {navItems.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors " +
                  // DESIGN.md: hover is the --fill tone step; active is accent-soft. Desktop: on the page background.
                  (isActive
                    ? "bg-accent-soft font-semibold text-text"
                    : "text-muted hover:bg-fill hover:text-text")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={isActive ? "text-accent" : undefined} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {status ? <div className="mt-auto pt-6">{status}</div> : null}
      <p className={`px-3 text-[13px] text-muted tabular-nums ${status ? "pt-3" : "mt-auto pt-6"}`}>
        Version {__APP_VERSION__}
      </p>
    </div>
  );
}
