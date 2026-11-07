// Shared button styles, so links can look like buttons (kept apart from ui.tsx for fast refresh).
// DESIGN.md section 9: height 44, radius 12, padding 0 20, 15 px / 600; one primary per screen.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "danger";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-body font-semibold " +
  "transition-colors duration-(--dur-fast) " +
  "disabled:cursor-not-allowed disabled:bg-fill disabled:text-muted aria-disabled:cursor-not-allowed " +
  "aria-disabled:bg-fill aria-disabled:text-muted";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
  secondary: "bg-fill text-text hover:bg-fill-hover",
  // Text button: transparent / accent, hover accent-soft.
  ghost: "text-accent hover:bg-accent-soft",
  // Destructive in the page (fill, danger text; add a trash icon). The solid "danger" is for the confirm dialog only.
  destructive: "bg-fill text-danger hover:bg-fill-hover",
  danger: "bg-danger text-on-danger hover:opacity-90",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`.trim();
}
