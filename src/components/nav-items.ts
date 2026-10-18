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
  { to: "/import/history", label: "Import history", parent: "/import" },
  { to: "/settings/whats-new", label: "What's new", parent: "/settings" },
  { to: "/settings/whats-next", label: "What's next", parent: "/settings" },
];

/** The sub-page for a path, including its own detail pages (e.g. /import/history/:id). */
export function subPageForPath(pathname: string): SubPage | undefined {
  return subPages.find((page) => pathname === page.to || pathname.startsWith(`${page.to}/`));
}

export function titleForPath(pathname: string): string {
  return (
    subPageForPath(pathname)?.label ??
    navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label ??
    "Cycling Hub"
  );
}
