import type { ComponentType, SVGProps } from "react";
import { ImportIcon, RidesIcon, SettingsIcon } from "./icons";

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** P7: the side menu destinations. Later epics add items here. */
export const navItems: NavItem[] = [
  { to: "/rides", label: "Rides", Icon: RidesIcon },
  { to: "/import", label: "Import", Icon: ImportIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

/** Pages below a menu item: the phone top bar shows Back to the parent instead of the menu button (G2, G3, C5). */
export interface SubPage {
  to: string;
  label: string;
  parent: string;
}

export const subPages: SubPage[] = [
  // `:id` matches one path segment (the ride detail, B4).
  { to: "/rides/:id", label: "Ride", parent: "/rides" },
  { to: "/import/history", label: "Import history", parent: "/import" },
  { to: "/settings/whats-new", label: "What's new", parent: "/settings" },
  { to: "/settings/whats-next", label: "What's next", parent: "/settings" },
];

/** Whether `pathname` is `to` or below it; a `:param` segment in `to` matches any one segment. */
function matchesSubPage(to: string, pathname: string): boolean {
  const pattern = to.split("/");
  const path = pathname.split("/");
  if (path.length < pattern.length) return false;
  return pattern.every((part, i) => {
    const segment = path[i] ?? "";
    return part.startsWith(":") ? segment !== "" : part === segment;
  });
}

/** The sub-page for a path, including its own detail pages (e.g. /import/history/:id). */
export function subPageForPath(pathname: string): SubPage | undefined {
  return subPages.find((page) => matchesSubPage(page.to, pathname));
}

export function titleForPath(pathname: string): string {
  return (
    subPageForPath(pathname)?.label ??
    navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label ??
    "Cycling Hub"
  );
}
