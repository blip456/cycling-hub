import { describe, expect, it } from "vitest";

/**
 * Design rules that are cheap to guard in the source (DESIGN.md sections 3 to 5): type only through the scale
 * utilities, no uppercase or letter-spaced labels, no monospace, no glows, no raw colours, no pills.
 */
const modules = import.meta.glob<string>(["./*.ts", "./*.tsx", "!./*.test.ts", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const files = Object.entries(modules).map(([name, source]) => ({ name, source }));

const rules: { rule: string; pattern: RegExp }[] = [
  {
    rule: "off-scale font size (use text-caption ... text-display)",
    pattern: /\btext-\[\d+(\.\d+)?px\]/,
  },
  {
    rule: "Tailwind text size (use the scale utilities)",
    pattern: /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/,
  },
  {
    rule: "bold or light weight (400, 500 and 600 only)",
    pattern: /\bfont-(bold|extrabold|black|light|thin|extralight)\b/,
  },
  { rule: "monospace", pattern: /\bfont-mono\b/ },
  { rule: "uppercase or capitalised labels", pattern: /\b(uppercase|lowercase|capitalize)\b/ },
  { rule: "letter spacing outside the scale utilities", pattern: /\btracking-/ },
  { rule: "line height outside the scale utilities", pattern: /\bleading-/ },
  { rule: "italic or underline", pattern: /\b(italic|underline)\b/ },
  { rule: "centred text", pattern: /\btext-center\b/ },
  { rule: "shadow or glow", pattern: /\b(drop-)?shadow(?!-\[inset)/ },
  { rule: "pill radius", pattern: /\brounded-full\b/ },
  { rule: "raw colour", pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/ },
];

describe("baseline design rules", () => {
  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const { rule, pattern } of rules) {
    it(`has no ${rule}`, () => {
      const hits = files.filter(({ source }) => pattern.test(source)).map(({ name }) => name);
      expect(hits).toEqual([]);
    });
  }
});
