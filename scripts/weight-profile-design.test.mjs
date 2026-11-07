// @vitest-environment node

// Guards the Weight and Profile areas against design drift (DESIGN.md sections 3, 5, 9): type tokens only,
// no weights or families outside the spec, no card outlines or accent bars, no centred text, no "!" error marks.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = ["src/features/weight", "src/features/profile"].flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => `${dir}/${name}`),
);

const FORBIDDEN = [
  [/\btext-\[\d+(\.\d+)?(px|rem)\]/, "arbitrary text size, use the text-* tokens"],
  [/\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/, "Tailwind text size"],
  [/\bfont-(bold|extrabold|black|thin|extralight|light|mono|serif|italic)\b/, "weight or family"],
  [/\b(uppercase|italic|underline|tracking-\S+|leading-\S+)\b/, "text style outside the scale"],
  [/\brounded-(2xl|3xl|\[)/, "radius outside the tokens"],
  [/\btext-center\b/, "centred text (only sign-in and button labels)"],
  [/\boutline-text\b|\bborder-l-4\b|inset_4px/, "outline or accent bar on a card or row"],
  [
    /aria-hidden="true" className="mr-1 text-accent"/,
    "error mark: use FieldError with the alert icon",
  ],
];

describe("weight and profile design rules", () => {
  for (const file of files) {
    it(`${file} follows the type, shape and error rules`, () => {
      const source = readFileSync(join(root, file), "utf8");
      for (const [pattern, why] of FORBIDDEN) {
        expect(source.match(pattern)?.[0], `${file}: ${why}`).toBeUndefined();
      }
    });
  }
});
