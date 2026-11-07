// @vitest-environment node

// Guards the design foundation against drift (DESIGN.md, P20, P36):
//  - the type scale in DESIGN.md = tokens.css = tokens.json = the text-* utilities in app.css,
//  - tokens.css colours = tokens.json colours,
//  - one font family stack everywhere, Inter shipped with the app (imported once, precached, CSP),
//  - no off-scale type classes in the areas that are already clean (all of src with TYPE_SCALE_STRICT=1).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const tokensCss = read("src/styles/tokens.css");
const appCss = read("src/styles/app.css");
const design = read("docs/design/DESIGN.md");
const json = JSON.parse(read("docs/design/tokens.json"));

const norm = (v) =>
  v
    .replace(/["\s]+/g, "")
    .replace(/−/g, "-")
    .toLowerCase();
const cssVar = (name) => {
  const m = tokensCss.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(m, name).not.toBeNull();
  return m[1].trim();
};

const SCALE = ["display", "stat", "heading", "title", "body-lg", "body", "caption"];

/** Rows of the type-scale table in DESIGN.md: `| `--fs-body` | 15 / 22 | 400 (buttons 600) | 0 | ... |`. */
function designRows() {
  const rows = {};
  const re = /^\| `--fs-([a-z-]+)` \| (\d+) \/ (\d+) \| (\d+)[^|]*\| ([^|]+) \|/gm;
  for (const m of design.matchAll(re)) {
    const tracking = m[5].trim();
    rows[m[1]] = {
      size: `${m[2]}px`,
      line: `${m[3]}px`,
      weight: m[4],
      tracking: tracking === "0" ? "0" : norm(tracking),
    };
  }
  return rows;
}

const TRACKING_VAR = {
  display: "--tracking-display",
  stat: "--tracking-display",
  heading: "--tracking-heading",
  title: "--tracking-tight",
  "body-lg": "--tracking-tight",
  body: null,
  caption: null,
};
const DEFAULT_WEIGHT = { body: "400", caption: "400" };

/** Declarations of `@utility text-<name> { ... }` in app.css. */
function utility(name) {
  const m = appCss.match(new RegExp(`@utility text-${name} \\{([^}]*)\\}`));
  expect(m, `@utility text-${name}`).not.toBeNull();
  return m[1];
}

describe("type scale", () => {
  const rows = designRows();

  it("DESIGN.md lists all seven tokens", () => {
    expect(Object.keys(rows).sort()).toEqual([...SCALE].sort());
  });

  it.each(SCALE)("%s: DESIGN.md = tokens.css = tokens.json", (name) => {
    const row = rows[name];
    expect(cssVar(`--fs-${name}`)).toBe(row.size);
    expect(cssVar(`--lh-${name}`)).toBe(row.line);
    const tracking = TRACKING_VAR[name] ? norm(cssVar(TRACKING_VAR[name])) : "0";
    expect(tracking).toBe(row.tracking);
    const token = json.font.scale[name];
    expect(token.$value.fontSize).toBe(row.size);
    expect(token.$value.lineHeight).toBe(row.line);
    expect(String(token.$value.fontWeight)).toBe(row.weight);
    expect(norm(token.$value.letterSpacing ?? "0")).toBe(row.tracking);
    expect(token.utility).toBe(`text-${name}`);
  });

  it.each(SCALE)(
    "text-%s utility sets size, line height, tracking and weight from the tokens",
    (name) => {
      const css = norm(utility(name));
      expect(css).toContain(`font-size:var(--fs-${name});`);
      expect(css).toContain(`line-height:var(--lh-${name});`);
      const tracking = TRACKING_VAR[name] ? `var(${TRACKING_VAR[name]})` : "0";
      expect(css).toContain(`letter-spacing:${tracking};`);
      const weight = DEFAULT_WEIGHT[name] ? "--fw-regular" : "--fw-semibold";
      expect(css).toContain(`font-weight:var(--tw-font-weight,var(${weight}));`);
    },
  );

  it("DESIGN.md documents every utility", () => {
    for (const name of SCALE) expect(design).toContain(`text-${name}`);
  });

  it("uses only the weights 400, 500 and 600", () => {
    expect(cssVar("--fw-regular")).toBe("400");
    expect(cssVar("--fw-medium")).toBe("500");
    expect(cssVar("--fw-semibold")).toBe("600");
  });
});

describe("colour tokens", () => {
  /** The first block that starts with `selector {`, up to its closing brace at line start. */
  function block(selector) {
    const start = tokensCss.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return tokensCss.slice(start, tokensCss.indexOf("\n}", start));
  }
  const themes = {
    dark: block(':root,\n[data-theme="dark"]'),
    light: block('[data-theme="light"]'),
  };

  it.each(["dark", "light"])("tokens.json %s colours equal tokens.css", (theme) => {
    for (const [key, token] of Object.entries(json.color[theme])) {
      const m = themes[theme].match(new RegExp(`${token.cssVar}:\\s*([^;]+);`));
      expect(m, `${theme} ${token.cssVar}`).not.toBeNull();
      expect(norm(m[1]), `${theme} ${key}`).toBe(norm(token.$value));
    }
  });

  it.each(["dark", "light"])("tokens.json %s metric colours equal tokens.css", (theme) => {
    for (const [key, token] of Object.entries(json.metric)) {
      if (!token.cssVar) continue;
      const m = themes[theme].match(new RegExp(`${token.cssVar}:\\s*([^;]+);`));
      expect(m, `${theme} ${token.cssVar}`).not.toBeNull();
      expect(norm(m[1]), `${theme} ${key}`).toBe(norm(token[theme].$value));
    }
  });
});

describe("fonts (P20, P36)", () => {
  it("has one --font-sans stack: Inter Variable first, in tokens.css, app.css and tokens.json", () => {
    const css = cssVar("--font-sans");
    expect(css.startsWith('"Inter Variable", "Inter"')).toBe(true);
    const theme = appCss.match(/--font-sans:\s*([^;]+);/);
    expect(norm(theme[1])).toBe(norm(css));
    const fromJson = json.font.family.sans.$value
      .map((f) => (f.includes(" ") ? `"${f}"` : f))
      .join(", ");
    expect(norm(fromJson)).toBe(norm(css));
  });

  it("has no monospace anywhere in the stack", () => {
    expect(appCss.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /ui-monospace|SFMono|Menlo|Consolas|monospace/,
    );
  });

  it("applies the family and tabular numbers on html, and the family on controls and code", () => {
    expect(appCss).toMatch(/html \{[^}]*font-family: var\(--font-sans\);/);
    expect(appCss).toMatch(/html \{[^}]*font-variant-numeric: var\(--font-numeric\);/);
    expect(appCss).toMatch(/html \{[^}]*font-synthesis: none;/);
    expect(appCss).toMatch(/html \{[^}]*-webkit-text-size-adjust: 100%;/);
    expect(appCss).toMatch(/textarea,[\s\S]*?pre,\s*code,[\s\S]*?\{[^}]*font-family: inherit;/);
  });

  it("imports the self-hosted font once, in main.tsx", () => {
    const hits = [];
    const walk = (dir) => {
      for (const name of readdirSync(join(root, dir))) {
        const path = `${dir}/${name}`;
        if (statSync(join(root, path)).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && /@fontsource/.test(read(path))) hits.push(path);
      }
    };
    walk("src");
    expect(hits).toEqual(["src/main.tsx"]);
    expect(read("src/main.tsx")).toContain('import "@fontsource-variable/inter";');
  });

  it("precaches the font files in the service worker and preloads the Latin subset", () => {
    const vite = read("vite.config.ts");
    expect(vite).toMatch(/globPatterns:[^\]]*woff2/);
    expect(vite).toContain("inter-latin-wght-normal");
  });

  it("allows self-hosted fonts in the CSP and loads no third-party font", () => {
    const csp = JSON.parse(read("vercel.json")).headers[0].headers.find(
      (h) => h.key === "Content-Security-Policy",
    ).value;
    expect(csp).toMatch(/font-src 'self'/);
    expect(read("index.html")).not.toMatch(/fonts\.(googleapis|gstatic)|rsms\.me|use\.typekit/);
  });
});

describe("type classes in source", () => {
  // Areas that are clean always; the whole of src when TYPE_SCALE_STRICT=1 (the release gate).
  const CLEAN = [
    "src/components",
    "src/pages/auth",
    "src/pages/SettingsPage.tsx",
    "src/pages/WhatsNewPage.tsx",
    "src/pages/WhatsNextPage.tsx",
    "src/pages/NotFoundPage.tsx",
    "src/pages/ConfigErrorPage.tsx",
    "src/features/settings",
    "src/features/release",
  ];
  const targets = process.env.TYPE_SCALE_STRICT === "1" ? ["src"] : CLEAN;
  const files = [];
  const walk = (path) => {
    const abs = join(root, path);
    if (statSync(abs).isDirectory()) {
      for (const name of readdirSync(abs)) walk(`${path}/${name}`);
    } else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.endsWith(".d.ts")) {
      files.push(path);
    }
  };
  targets.forEach(walk);

  const FORBIDDEN = [
    [/\btext-\[\d+(\.\d+)?(px|rem)\]/, "arbitrary text size"],
    [
      /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/,
      "Tailwind text size, use text-caption/body/body-lg/title/heading/stat/display",
    ],
    [
      /\bfont-(bold|extrabold|black|thin|extralight|light|mono|serif|italic)\b/,
      "weight or family outside the spec",
    ],
    [
      /"[^"]*\b(italic|uppercase|lowercase|capitalize|underline|line-through)\b[^"]*"/,
      "text style outside the spec",
    ],
    [/\btracking-(tighter|tight|normal|wide|wider|widest|\[)/, "tracking outside the scale"],
    [/\bleading-/, "line height outside the scale"],
  ];

  it.each(FORBIDDEN)("has no class matching %s (%s)", (re, why) => {
    const hits = [];
    for (const file of files) {
      read(file)
        .split("\n")
        .forEach((line, i) => {
          // Prose in comments may name the classes it forbids.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (re.test(line)) hits.push(`${file}:${i + 1}: ${why}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
