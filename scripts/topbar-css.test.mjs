// @vitest-environment node

// Page background and phone top bar (P25, DESIGN.md "Side menu and top bar"): the splash is a fixed layer and
// the top bar paints the same splash, so the bar blends in at every scroll position. See src/styles/app.css.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
// Comments removed: the CSS explains the iOS problem in prose, and only declarations count here.
const css = read("../src/styles/app.css").replace(/\/\*[\s\S]*?\*\//g, "");
const shell = read("../src/components/AppShell.tsx");

/** Text of the first rule that starts with `selector`. */
function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("page background and phone top bar", () => {
  it("draws the splash as a fixed layer, not with background-attachment (iOS ignores it)", () => {
    expect(css).not.toMatch(/background-attachment/);
    const layer = rule("body::before");
    expect(layer).toContain("position: fixed");
    expect(layer).toContain("var(--page, var(--bg))");
    // Sized to the largest viewport, so iOS does not leave a flat strip under the collapsing toolbar.
    expect(layer).toContain("height: 100lvh");
  });

  it("keeps fields at 16 px on touch screens, so iOS does not zoom into them", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\) \{\s*input,\s*select,\s*textarea \{\s*font-size: 16px;/,
    );
  });

  it("paints the same splash in the top bar so it blends in at any scroll position", () => {
    const bar = rule(".topbar::before");
    expect(bar).toContain("position: fixed");
    expect(bar).toContain("var(--page, var(--bg))");
    expect(bar).toContain("background-size: 100% 100dvh");
    expect(bar).toContain("env(safe-area-inset-top)");
  });

  it("does not give the phone header a flat colour", () => {
    const header = /<header className="([^"]*)"/.exec(shell)?.[1] ?? "";
    expect(header).toContain("topbar");
    expect(header).not.toMatch(/\bbg-/);
  });
});
