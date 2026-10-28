// Shared button styles, so links can look like buttons (kept apart from ui.tsx for fast refresh).
export type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "bg-subtle text-text hover:bg-fill-hover",
  ghost: "text-accent hover:bg-subtle",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`.trim();
}
