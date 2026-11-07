// @vitest-environment node

// Design rules for the Plan screens (src/features/plan, DESIGN.md): the rules a screen cannot show are guarded
// here so a later change cannot bring them back. The type scale utilities are guarded in design-tokens.test.mjs.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../src/features/plan", import.meta.url));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) files.push(path);
  }
};
walk(root);

// Round parts of controls (radio button, switch, spinner) and the checked border of a control are not cards.
const CONTROL_FILES = /(components\/parts|summary\/Switch|components\/intake\/Summary)\.tsx$/;

const RULES = [
  [/\brounded-(xl|2xl|3xl|full)\b/, "card and control radii are 8, 12 and 16 (rounded-sm, md, lg)"],
  [/\bfont-mono\b/, "no monospace (DESIGN.md typography)"],
  [/[←→↑↓✓✕⋯›‹▲▼✎]/, "icons are SVG line icons (components/icons.tsx), not text glyphs"],
  [
    /\b(shadow-(sm|md|lg|xl|2xl)|shadow-card)\b/,
    "no resting shadows; only shadow-raised on floating things",
  ],
  [/#[0-9a-fA-F]{3,8}\b|\brgba?\(/, "colours come from tokens"],
  [/\bplaceholder=/, "no placeholders (CLAUDE.md)"],
  [
    /\bborder-(accent|dashed)\b|\bborder-2 border-transparent\b/,
    "no outline on cards; tone steps separate them",
  ],
];

describe("Plan screens follow the design rules", () => {
  it.each(RULES)("has nothing matching %s (%s)", (re, why) => {
    const hits = [];
    for (const file of files) {
      if (
        CONTROL_FILES.test(file) &&
        /rounded-\(xl|2xl|3xl|full\)|border-\(accent/.test(String(re))
      )
        continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (re.test(line))
            hits.push(`${file.replace(root, "src/features/plan")}:${i + 1}: ${why}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
