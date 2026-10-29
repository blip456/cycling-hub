import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyStoredTheme, applyTheme, getStoredTheme, THEME_STORAGE_KEY } from "./theme";

function themeColors() {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
    (m) => m.content,
  );
}

describe("theme", () => {
  beforeEach(() => {
    // The two theme-color metas from index.html.
    document.head.innerHTML =
      '<meta name="theme-color" content="#F2F5F9" media="(prefers-color-scheme: light)">' +
      '<meta name="theme-color" content="#111318" media="(prefers-color-scheme: dark)">';
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    document.head.innerHTML = "";
  });

  it("defaults to System", () => {
    expect(getStoredTheme()).toBe("system");
  });

  it.each(["light", "dark"] as const)("applies and stores %s", (choice) => {
    applyTheme(choice);
    const root = document.documentElement;
    expect(root).toHaveAttribute("data-theme", choice);
    expect(root.style.colorScheme).toBe(choice);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(choice);
    expect(getStoredTheme()).toBe(choice);
    const color = choice === "light" ? "#F2F5F9" : "#111318";
    expect(themeColors()).toEqual([color, color]);
  });

  it("System removes the attribute and the stored value, and restores both theme colours", () => {
    applyTheme("light");
    applyTheme("system");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(themeColors()).toEqual(["#F2F5F9", "#111318"]);
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(getStoredTheme()).toBe("system");
  });

  it.each(["light", "dark"] as const)("applies the stored %s choice at startup", (choice) => {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
    applyStoredTheme();
    expect(document.documentElement).toHaveAttribute("data-theme", choice);
    expect(document.documentElement.style.colorScheme).toBe(choice);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(choice);
  });

  it("leaves System alone at startup", () => {
    applyStoredTheme();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
