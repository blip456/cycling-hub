/**
 * P9: theme choice. "system" = no data-theme attribute, so tokens.css follows prefers-color-scheme.
 * index.html reads the same localStorage key before first paint to avoid a flash; keep the two in sync.
 * The Settings switch arrives in Sprint 1.
 */
export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "system" | "light" | "dark";

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY);
    root.removeAttribute("data-theme");
    root.style.colorScheme = "";
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
    root.setAttribute("data-theme", choice);
    root.style.colorScheme = choice;
  }
}
