/**
 * P9: theme choice, System (default) / Light / Dark. "system" = no data-theme attribute, so tokens.css
 * follows prefers-color-scheme. index.html reads the same localStorage key before first paint to avoid a
 * flash; keep the key and the colours below in sync with it.
 */
export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** --bg per theme (tokens.css): the browser and status bar colour of the installed app. */
export const THEME_COLORS = { light: "#F2F5F9", dark: "#111318" } as const;

export function getStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): fall back to the system setting.
    return "system";
  }
}

/** Stores the choice and applies it at once: data-theme, color-scheme and the theme-color metas. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not stored, but still applied for this visit.
  }

  if (choice === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "";
  } else {
    root.setAttribute("data-theme", choice);
    root.style.colorScheme = choice;
  }

  // index.html has one theme-color meta per colour scheme (media="(prefers-color-scheme: …)").
  // System restores each to its own scheme; an explicit choice sets both to that theme's colour.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = (meta.getAttribute("media") ?? "").includes("light") ? "light" : "dark";
    meta.content = THEME_COLORS[choice === "system" ? scheme : choice];
  });
}
