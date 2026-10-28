import { NavLink } from "react-router";
import { navItems } from "./nav-items";

/** Menu content shared by the phone drawer and the permanent desktop side bar (N1b, P7, P8). */
export function SideMenu({ onNavigate }: { onNavigate?: () => void }) {
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
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors " +
                  // Light theme has --raised == --surface, so the states use accent-soft / bg to stay visible.
                  (isActive
                    ? "bg-accent-soft font-semibold text-text"
                    : "text-muted hover:bg-bg hover:text-text")
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
      <p className="mt-auto px-3 pt-6 text-[13px] text-muted tabular-nums">
        Version {__APP_VERSION__}
      </p>
    </div>
  );
}
