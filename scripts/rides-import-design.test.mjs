// @vitest-environment node

// Guards the Rides and Import screens against design drift (DESIGN.md sections 3 to 5, P20, P21, P24):
// type comes from the text-* scale utilities, one family, no bold/italic/uppercase/underline/tracking
// overrides, no raw colours, radii only from the spec, shadows only the floating one.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const AREAS = [
  "src/features/rides",
  "src/features/import",
  "src/pages/RidesPage.tsx",
  "src/pages/RideDetailPage.tsx",
  "src/pages/ImportPage.tsx",
  "src/pages/ImportHistoryPage.tsx",
  "src/pages/ImportDetailPage.tsx",
];

function sources(path) {
  const full = join(root, path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => {
    if (name === "fixtures") return [];
    const child = join(path, name);
    if (statSync(join(root, child)).isDirectory()) return sources(child);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [child] : [];
  });
}

const files = AREAS.flatMap(sources);

const RULES = [
  [
    "arbitrary or Tailwind font size (use text-display ... text-caption)",
    /\btext-(\[\d|xs\b|sm\b|base\b|lg\b|xl\b|\dxl\b)/,
  ],
  ["tracking override (the scale utilities set it)", /\btracking-/],
  ["leading override (the scale utilities set it)", /\bleading-(?!\[)/],
  ["bold, light or monospace font", /\bfont-(bold|extrabold|black|light|thin|mono)\b/],
  ["uppercase or other text transform", /\b(uppercase|lowercase|capitalize)\b/],
  ["italic", /\bitalic\b/],
  ["underline", /\bunderline\b/],
  ["raw colour", /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/],
  ["radius outside the spec (6, rounded-sm/md/lg/xl/2xl/full)", /\brounded-\[(?!6px\])/],
  ["shadow other than --shadow-raised or the inset edge", /\bshadow-(?!raised\b|\[inset)/],
];

describe("Rides and Import follow the design system", () => {
  it("finds the screens' sources", () => {
    expect(files.length).toBeGreaterThan(20);
  });
  for (const [name, pattern] of RULES) {
    it(`has no ${name}`, () => {
      const hits = files.flatMap((file) =>
        readFileSync(join(root, file), "utf8")
          .split("\n")
          .flatMap((line, i) => {
            const code = line.replace(/^\s*(\/\/|\*|\/\*).*/, "");
            return pattern.test(code) ? [`${file}:${i + 1}: ${line.trim()}`] : [];
          }),
      );
      expect(hits).toEqual([]);
    });
  }
});
