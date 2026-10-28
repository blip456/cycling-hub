// @vitest-environment node

// Zone colour tokens (P53): --zone-1 to --zone-7 in src/styles/tokens.css, at least 3:1 on the page,
// surface and raised tones in both themes, and in sync with docs/design/tokens.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const css = read("../src/styles/tokens.css");
const json = JSON.parse(read("../docs/design/tokens.json"));

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every `--name: #hex;` in file order: dark block, light block, system-light media block. */
function values(name) {
  const re = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`, "g");
  return [...css.matchAll(re)].map((m) => m[1].toUpperCase());
}

const THEMES = ["dark", "light", "light (system)"];
const SURFACES = ["--bg", "--surface", "--raised"];
const NUMBERS = [1, 2, 3, 4, 5, 6, 7];
const zone = (n) => values(`--zone-${n}`);

describe("zone colour tokens", () => {
  it("defines --zone-1 to --zone-7 in the dark, light and system-light blocks", () => {
    for (const n of NUMBERS) expect(zone(n)).toHaveLength(THEMES.length);
  });

  it.each(THEMES.map((theme, i) => [theme, i]))(
    "has at least 3:1 against the page, surface and raised tones in %s",
    (_theme, i) => {
      for (const surfaceName of SURFACES) {
        const surface = values(surfaceName)[i];
        for (const n of NUMBERS) {
          expect(contrast(zone(n)[i], surface)).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );

  it("uses seven different colours per theme", () => {
    for (let i = 0; i < THEMES.length; i += 1) {
      expect(new Set(NUMBERS.map((n) => zone(n)[i])).size).toBe(7);
    }
  });

  it("matches docs/design/tokens.json", () => {
    for (const n of NUMBERS) {
      const entry = json.zone[String(n)];
      expect(entry.cssVar).toBe(`--zone-${n}`);
      expect(entry.dark.$value.toUpperCase()).toBe(zone(n)[0]);
      expect(entry.light.$value.toUpperCase()).toBe(zone(n)[1]);
    }
  });
});
