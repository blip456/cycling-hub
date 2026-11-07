/* global document, window, getComputedStyle */
// Design audit for the foundation screens (sign-in, forgot and reset password, Settings, What's new,
// What's next, not found, the phone drawer, the status card) and the Inter font check (P20, P36).
//
//   VITE_SUPABASE_URL=http://sb.test VITE_SUPABASE_PUBLISHABLE_KEY=k pnpm build
//   pnpm preview --port 4173 &
//   node scripts/design-audit/foundation.mjs            # BASE=http://127.0.0.1:4173, SHOTS=<dir> for screenshots
//
// Needs Playwright (PLAYWRIGHT=<path to playwright/index.mjs>, default /opt/node-tools). Supabase is mocked:
// the page gets a fake session and every PostgREST call answers with fixed JSON. Exit code 1 when a font
// check fails or any computed style breaks the spec; the report lists the first examples per rule.

import { mkdirSync } from "node:fs";

const { chromium } = await import(
  process.env.PLAYWRIGHT ?? "/opt/node-tools/node_modules/playwright/index.mjs"
);
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// ---- spec (DESIGN.md section 3) ----
const SCALE = [
  { name: "display", size: 44, line: 46, weights: [600], ls: -0.025 },
  { name: "stat", size: 32, line: 36, weights: [600], ls: -0.025 },
  { name: "heading", size: 24, line: 30, weights: [600], ls: -0.015 },
  { name: "title", size: 20, line: 26, weights: [600], ls: -0.01 },
  { name: "body-lg", size: 17, line: 24, weights: [600], ls: -0.01 },
  { name: "body", size: 15, line: 22, weights: [400, 500, 600], ls: 0 },
  { name: "caption", size: 13, line: 18, weights: [400, 500, 600], ls: 0 },
];
const RADII = new Set([0, 6, 8, 12, 16, 20]);

// ---- fake session and Supabase ----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 36000;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u1", exp, role: "authenticated", aud: "authenticated" })}.sig`;
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "rider@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
};
const session = {
  access_token: jwt,
  refresh_token: "r",
  expires_at: exp,
  expires_in: 36000,
  token_type: "bearer",
  user,
};

async function open(browser, { w, h, scheme, signedIn, outdated }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  if (signedIn) {
    await ctx.addInitScript(
      (s) => localStorage.setItem("sb-sb-auth-token", JSON.stringify(s)),
      session,
    );
  }
  const page = await ctx.newPage();
  await page.route("http://sb.test/**", async (route) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    const json = (body) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify(body),
      });
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    const url = route.request().url();
    if (url.includes("profiles"))
      return json({
        weight_reminder_day: 1,
        weight_reminder_enabled: true,
        last_seen_version: outdated ? "0.0.1" : "99.0.0",
      });
    if (url.includes("/auth/v1/user")) return json(user);
    return json([]);
  });
  return { ctx, page };
}

// ---- in-page walk ----
function walk() {
  const out = { text: [], controls: [], shapes: [], overflow: false, fontFaces: [] };
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/) ?? s.match(/color\(srgb ([^)]+)\)/);
    if (!m) return null;
    const p = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    if (s.startsWith("color(")) return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1];
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let base = parse(getComputedStyle(document.documentElement).getPropertyValue("--bg") || "") ?? [
      17, 19, 24, 1,
    ];
    const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim();
    if (bg.startsWith("#")) {
      const n = parseInt(bg.slice(1), 16);
      base = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    let acc = base;
    for (const c of layers.reverse()) {
      acc = [0, 1, 2].map((i) => c[i] * c[3] + acc[i] * (1 - c[3])).concat(1);
    }
    return acc;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""}`;

  document.fonts.forEach((f) => out.fontFaces.push(`${f.family} ${f.weight} ${f.status}`));
  out.overflow = document.documentElement.scrollWidth > window.innerWidth;

  const all = [...document.body.querySelectorAll("*")];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim() !== "")
      .map((n) => n.textContent.trim())
      .join(" ");
    const isField = el.matches("input:not([type=checkbox]):not([type=radio]),textarea,select");
    if (own !== "" || isField) {
      const col = parse(cs.color);
      const bg = bgOf(el);
      out.text.push({
        el: label(el),
        text: own.slice(0, 40),
        family: cs.fontFamily,
        size: parseFloat(cs.fontSize),
        line: cs.lineHeight === "normal" ? "normal" : parseFloat(cs.lineHeight),
        weight: Number(cs.fontWeight),
        ls:
          cs.letterSpacing === "normal"
            ? 0
            : parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize),
        style: cs.fontStyle,
        transform: cs.textTransform,
        decoration: cs.textDecorationLine,
        align: cs.textAlign,
        digits: /\d/.test(own),
        tabular: cs.fontVariantNumeric.includes("tabular-nums"),
        synthesis: cs.fontSynthesis,
        contrast: col ? Number(ratio(col, bg).toFixed(2)) : null,
        large:
          parseFloat(cs.fontSize) >= 24 ||
          (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700),
      });
    }
    if (el.matches("a[href],button,input,select,textarea,[role=switch],[role=radio],summary")) {
      const hidden =
        el.classList.contains("sr-only") || (cs.position === "absolute" && r.width <= 1);
      const inline = el.matches("a") && cs.display === "inline";
      if (!hidden) {
        out.controls.push({
          el: label(el),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inline,
        });
      }
    }
    const radius = parseFloat(cs.borderTopLeftRadius);
    const shadow = cs.boxShadow;
    const isFloating = el.closest("[data-placement=floating],dialog") !== null;
    out.shapes.push({
      el: label(el),
      radius,
      full: radius >= 999 || cs.borderTopLeftRadius.includes("%"),
      shadow: shadow !== "none" && !/inset/.test(shadow) ? shadow : "",
      floating: isFloating,
      outline:
        cs.outlineStyle !== "none" && cs.outlineWidth !== "0px" && document.activeElement !== el
          ? cs.outlineStyle
          : "",
    });
  }
  return out;
}

const failures = new Map();
const note = (rule, where, detail) => {
  const list = failures.get(rule) ?? [];
  list.push(`${where}: ${detail}`);
  failures.set(rule, list);
};

let textCount = 0;
function check(where, m) {
  textCount += m.text.length;
  if (m.overflow) note("horizontal overflow", where, "page scrolls sideways");
  for (const t of m.text) {
    const id = `${t.el} "${t.text}"`;
    if (!/^"?Inter Variable"?,/.test(t.family))
      note("font family not Inter Variable first", where, `${id} ${t.family}`);
    if (/mono|courier/i.test(t.family)) note("monospace", where, id);
    if (t.style !== "normal") note("italic", where, id);
    if (t.transform !== "none") note("text-transform", where, `${id} ${t.transform}`);
    if (t.decoration !== "none" && !/Show|Hide/.test(t.text))
      note("underline or strike", where, `${id} ${t.decoration}`);
    if (![400, 500, 600].includes(t.weight))
      note("weight outside 400/500/600", where, `${id} ${t.weight}`);
    if (t.size < 13) note("size below 13", where, `${id} ${t.size}`);
    const step = SCALE.find((s) => s.size === t.size);
    if (!step) note("off-scale font size", where, `${id} ${t.size}px`);
    else {
      if (t.line !== step.line)
        note("line height off scale", where, `${id} ${t.size}/${t.line} want ${step.line}`);
      if (!step.weights.includes(t.weight))
        note("weight wrong for size", where, `${id} ${t.size}px ${t.weight}`);
      if (Math.abs(t.ls - step.ls) > 0.002)
        note(
          "letter spacing off scale",
          where,
          `${id} ${t.size}px ${t.ls.toFixed(3)}em want ${step.ls}`,
        );
    }
    if (t.digits && !t.tabular) note("digits without tabular-nums", where, id);
    if (t.synthesis !== "none") note("font-synthesis not none", where, id);
    if (t.contrast !== null && t.contrast < (t.large ? 3 : 4.5))
      note("text contrast below AA", where, `${id} ${t.contrast}`);
  }
  for (const c of m.controls) {
    if (c.inline) continue;
    if (c.h < 44 && !/^input\.sr-only/.test(c.el))
      note("touch target below 44 px", where, `${c.el} "${c.name}" ${c.w}x${c.h}`);
  }
  for (const s of m.shapes) {
    if (!s.full && !RADII.has(Math.round(s.radius)))
      note("radius off spec", where, `${s.el} ${s.radius}`);
    if (s.shadow && !s.floating) note("shadow on a resting element", where, `${s.el} ${s.shadow}`);
  }
}

// ---- fonts: computed family, loaded face and the font Chromium really used ----
async function checkFonts(browser) {
  const { ctx, page } = await open(browser, { w: 1280, h: 800, scheme: "dark", signedIn: true });
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector("main h1", { state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  const problems = [];
  const info = await page.evaluate(() => {
    const kinds = [
      "h1",
      "h2",
      "p",
      "span",
      "a",
      "button",
      "label",
      "input",
      "select",
      "textarea",
      "pre",
      "code",
      "td",
      "small",
      "strong",
      "em",
    ];
    const host = document.createElement("div");
    host.id = "font-probe";
    host.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
    for (const k of kinds) {
      const el = document.createElement(k);
      if (k === "input") el.value = "Inter 0123";
      else if (k === "select") el.innerHTML = "<option>Inter 0123</option>";
      else if (k === "td") {
        const t = document.createElement("table");
        const tr = t.insertRow();
        const cell = tr.insertCell();
        cell.textContent = "Inter 0123";
        cell.dataset.probe = "td";
        host.append(t);
        continue;
      } else el.textContent = "Inter 0123";
      el.dataset.probe = k;
      host.append(el);
    }
    document.body.append(host);
    return kinds.map((k) => {
      const el = host.querySelector(`[data-probe="${k}"]`);
      return { kind: k, family: getComputedStyle(el).fontFamily };
    });
  });
  for (const i of info) {
    if (!i.family.startsWith('"Inter Variable"'))
      problems.push(`${i.kind}: computed family ${i.family}`);
  }
  const faces = await page.evaluate(() =>
    [...document.fonts].map((f) => `${f.family}|${f.status}|${f.unicodeRange.slice(0, 20)}`),
  );
  if (!faces.some((f) => f.startsWith("Inter Variable|loaded")))
    problems.push(`no Inter Variable face loaded: ${faces.join("; ")}`);
  if (!(await page.evaluate(() => document.fonts.check('600 15px "Inter Variable"', "Inter 0123"))))
    problems.push("document.fonts.check failed for 600 15px");
  if (!(await page.evaluate(() => document.fonts.check('400 13px "Inter Variable"', "Inter 0123"))))
    problems.push("document.fonts.check failed for 400 13px");

  // The font Chromium really painted, per probe element (CDP), so a silent fallback cannot pass.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: "[data-probe]",
  });
  for (const nodeId of nodeIds) {
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    const { attributes } = await cdp.send("DOM.getAttributes", { nodeId });
    const kind = attributes[attributes.indexOf("data-probe") + 1];
    const used = fonts.map((f) => `${f.familyName}${f.isCustomFont ? "*" : ""}`);
    // Controls paint their value in a shadow tree; getPlatformFontsForNode can report none for them.
    if (fonts.length > 0 && !fonts.every((f) => f.isCustomFont && /Inter/.test(f.familyName)))
      problems.push(`${kind}: painted with ${used.join(", ")}`);
    if (fonts.length === 0 && !["input", "select", "textarea"].includes(kind))
      problems.push(`${kind}: no platform font reported`);
  }
  // Preload and precache.
  const html = await (await ctx.request.get(`${BASE}/`)).text();
  if (!/rel="preload"[^>]*as="font"[^>]*inter-latin-wght-normal/.test(html))
    problems.push("Latin subset is not preloaded in index.html");
  const sw = await (await ctx.request.get(`${BASE}/sw.js`)).text();
  for (const f of ["inter-latin-wght-normal", "inter-latin-ext-wght-normal"]) {
    if (!sw.includes(f)) problems.push(`service worker does not precache ${f}`);
  }
  await ctx.close();
  return problems;
}

const browser = await chromium.launch();
const fontProblems = await checkFonts(browser);

const SCREENS = [
  { id: "sign-in", path: "/sign-in", signedIn: false },
  { id: "forgot", path: "/forgot-password", signedIn: false },
  { id: "reset-expired", path: "/reset-password", signedIn: false },
  { id: "settings", path: "/settings", signedIn: true },
  { id: "whats-new", path: "/settings/whats-new", signedIn: true },
  { id: "whats-next", path: "/settings/whats-next", signedIn: true },
  { id: "not-found", path: "/nope", signedIn: true },
  { id: "status-card", path: "/settings", signedIn: true, outdated: true },
  { id: "drawer", path: "/settings", signedIn: true, drawer: true, phoneOnly: true },
];
let measured = 0;
for (const s of SCREENS) {
  for (const w of [390, 1280]) {
    if (s.phoneOnly && w !== 390) continue;
    for (const scheme of ["dark", "light"]) {
      const { ctx, page } = await open(browser, {
        w,
        h: 900,
        scheme,
        signedIn: s.signedIn,
        outdated: s.outdated,
      });
      await page.goto(BASE + s.path);
      await page.waitForTimeout(900);
      if (s.drawer) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.waitForTimeout(500);
      }
      const where = `${s.id} ${w} ${scheme}`;
      check(where, await page.evaluate(walk));
      measured += 1;
      if (SHOTS)
        await page.screenshot({ path: `${SHOTS}/${s.id}-${w}-${scheme}.png`, fullPage: true });
      await ctx.close();
    }
  }
}
await browser.close();

console.log(`fonts: ${fontProblems.length === 0 ? "ok" : "FAILED"}`);
for (const p of fontProblems) console.log(`  ${p}`);
console.log(`screens measured: ${measured}, text elements checked: ${textCount}`);
let total = 0;
for (const [rule, list] of [...failures].sort()) {
  const unique = [...new Set(list)];
  total += unique.length;
  console.log(`\n${rule}: ${unique.length}`);
  for (const l of unique.slice(0, 5)) console.log(`  ${l}`);
}
console.log(`\nviolations: ${total}`);
process.exit(fontProblems.length > 0 || total > 0 ? 1 : 0);
