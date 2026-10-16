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

export function titleForPath(pathname: string): string {
  return (
    navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.label ??
    "Cycling Hub"
  );
}
