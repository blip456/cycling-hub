#!/usr/bin/env node
// Build-time data for What's new (G2) and What's next (G3), so the app never calls GitHub at runtime.
//
//   CHANGELOG.md     (written by release-please)       -> src/features/release/generated/changelog.json
//   docs/backlog.md  (the "Sprint format" sections)     -> src/features/release/generated/roadmap.json
//
// The output is gitignored. package.json runs this before dev, build, lint, typecheck and the tests, and
// vite.config.ts runs it again when one of the two sources changes during `pnpm dev`. A broken sprint
// entry in the backlog fails the run, and with it the build (backlog "Sprint format").

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {"feature" | "fix" | "technical"} ChangeType */
/** @typedef {{ type: ChangeType; text: string }} ChangeEntry */
/** @typedef {{ version: string; date: string | null; entries: ChangeEntry[] }} Release */
/** @typedef {"planned" | "in progress" | "shipped"} SprintStatus */
/** @typedef {{ version: string; title: string; sprint: number; status: SprintStatus; tagline: string }} RoadmapItem */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_DIR = join(ROOT, "src/features/release/generated");

// ---------------------------------------------------------------------------------------------------
// CHANGELOG.md (release-please)
// ---------------------------------------------------------------------------------------------------

/** release-please section titles (release-please-config.json) -> the three labels of P18. */
const SECTION_TYPES = /** @type {Record<string, ChangeType>} */ ({
  features: "feature",
  "bug fixes": "fix",
  performance: "fix",
  reverts: "technical",
  technical: "technical",
});
const TYPE_ORDER = /** @type {ChangeType[]} */ (["feature", "fix", "technical"]);

// "## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-10-23)" or, for the first
// release, "## 0.1.0 (2026-10-17)".
const RELEASE_HEADING =
  /^##\s+\[?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?(?:\([^)]*\))?\s*(?:\((\d{4}-\d{2}-\d{2})\))?\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const ITEM = /^[*-]\s+(.+)$/;
// release-please appends " ([#12](…)) ([abc1234](…))", sometimes ", closes [#3](…)".
const TRAILING_REFS = /\s*(?:,\s*closes\s+\[#.*|\(\[(?:#\d+|[0-9a-f]{7,40})\]\(.*)$/i;

/** Plain text: no scope prefix, no link suffixes, no markdown marks; first letter upper case. */
function cleanEntry(raw) {
  const text = raw
    .replace(TRAILING_REFS, "")
    .replace(/^\*\*[^*]+:\*\*\s*/, "") // "**import:** " scope prefix
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Parses a release-please CHANGELOG.md: releases newest first (file order), each with its date and its
 * entries labelled Feature / Fix / Technical. The "# Changelog" title, the "⚠ BREAKING CHANGES" notes
 * (the same commits also appear under their own type) and unknown headings are left out.
 * @param {string} markdown
 * @returns {Release[]}
 */
export function parseChangelog(markdown) {
  /** @type {Release[]} */
  const releases = [];
  /** @type {Release | null} */
  let release = null;
  /** @type {ChangeType | null} */
  let type = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      const match = RELEASE_HEADING.exec(line);
      release = match ? { version: match[1], date: match[2] ?? null, entries: [] } : null;
      if (release) releases.push(release);
      type = null;
      continue;
    }
    const section = SECTION_HEADING.exec(line);
    if (section) {
      type = SECTION_TYPES[section[1].toLowerCase()] ?? null;
      continue;
    }
    // Only top-level bullets: indented ones are commit body details.
    const item = ITEM.exec(rawLine);
    if (item && release && type) {
      const text = cleanEntry(item[1]);
      if (text) release.entries.push({ type, text });
    }
  }

  for (const r of releases) {
    r.entries.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  }
  return releases;
}

// ---------------------------------------------------------------------------------------------------
// docs/backlog.md (Sprint format)
// ---------------------------------------------------------------------------------------------------

export const STATUSES = /** @type {SprintStatus[]} */ (["planned", "in progress", "shipped"]);
const SPRINT_HEADING = /^##\s+v(\d+\.\d+\.\d+)(?:\s+[—–-]\s+(.*?))?\s*$/;
const FIELD = /^(Sprint|Status|Tagline):[ \t]*(.*?)\s*$/;

export class BacklogFormatError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(
      `docs/backlog.md does not follow the sprint format (see "## Sprint format" there):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "BacklogFormatError";
    this.problems = problems;
  }
}

/**
 * Parses the "## vX.Y.Z — Title" sections of the backlog (Sprint:, Status:, Tagline:). Everything under
 * "### Details" and every other heading is ignored, as are fenced code blocks (the format example).
 * Throws a BacklogFormatError listing every problem when the format is broken.
 * @param {string} markdown
 * @returns {RoadmapItem[]}
 */
export function parseBacklog(markdown) {
  /** @type {string[]} */
  const problems = [];
  /** @type {{ line: number; version: string; title: string; fields: Record<string, string>; inDetails: boolean }[]} */
  const sections = [];
  let current = null;
  let inFence = false;

  markdown.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    if (/^##\s/.test(line)) {
      const match = SPRINT_HEADING.exec(line);
      if (match) {
        current = {
          line: index + 1,
          version: match[1],
          title: match[2] ?? "",
          fields: {},
          inDetails: false,
        };
        sections.push(current);
      } else {
        if (/^##\s+v/i.test(line)) {
          problems.push(`line ${index + 1}: "${line}" is not "## vX.Y.Z — Title"`);
        }
        current = null;
      }
      return;
    }
    if (!current || current.inDetails) return;
    if (/^###\s/.test(line)) {
      current.inDetails = true;
      return;
    }
    const field = FIELD.exec(line);
    if (field) {
      if (field[1] in current.fields) {
        problems.push(`line ${index + 1}: v${current.version} has "${field[1]}:" twice`);
      }
      current.fields[field[1]] = field[2];
    }
  });

  /** @type {RoadmapItem[]} */
  const items = [];
  const seen = new Map();
  for (const s of sections) {
    const where = `line ${s.line}: v${s.version}`;
    const before = problems.length;
    if (seen.has(s.version)) {
      problems.push(`${where} appears twice (first on line ${seen.get(s.version)})`);
    } else {
      seen.set(s.version, s.line);
    }
    if (!s.title) problems.push(`${where} has no title ("## v${s.version} — Title")`);

    const sprint = s.fields.Sprint;
    if (!sprint) problems.push(`${where} has no "Sprint:" line`);
    else if (!/^\d+$/.test(sprint))
      problems.push(`${where}: "Sprint: ${sprint}" is not a whole number`);

    const status = s.fields.Status?.toLowerCase();
    if (!status) problems.push(`${where} has no "Status:" line`);
    else if (!STATUSES.includes(/** @type {SprintStatus} */ (status)))
      problems.push(`${where}: "Status: ${s.fields.Status}" is not one of ${STATUSES.join(" | ")}`);

    if (!s.fields.Tagline) problems.push(`${where} has no "Tagline:" line`);

    if (problems.length === before) {
      items.push({
        version: s.version,
        title: s.title,
        sprint: Number(sprint),
        status: /** @type {SprintStatus} */ (status),
        tagline: s.fields.Tagline,
      });
    }
  }

  if (problems.length > 0) throw new BacklogFormatError(problems);
  return items;
}

/** What's next: everything that has not shipped yet, in backlog order. */
export function upcoming(items) {
  return items.filter((item) => item.status !== "shipped");
}

// ---------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------

/**
 * Reads the sources and writes the two JSON files. A missing CHANGELOG.md (no release yet) gives an
 * empty list; a missing or broken backlog throws.
 * @param {{ root?: string; outDir?: string }} [options]
 */
export function buildReleaseData({ root = ROOT, outDir = OUT_DIR } = {}) {
  const changelogPath = join(root, "CHANGELOG.md");
  const releases = existsSync(changelogPath)
    ? parseChangelog(readFileSync(changelogPath, "utf8"))
    : [];
  const roadmap = upcoming(parseBacklog(readFileSync(join(root, "docs/backlog.md"), "utf8")));

  mkdirSync(outDir, { recursive: true });
  writeJson(join(outDir, "changelog.json"), { releases });
  writeJson(join(outDir, "roadmap.json"), { items: roadmap });
  return { releases, roadmap };
}

/** Writes only when the content changes, so watchers (vite, vitest) are not triggered for nothing. */
function writeJson(path, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  writeFileSync(path, content);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Optional: --root <dir> --out <dir> (used by the tests).
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? resolve(process.argv[i + 1]) : undefined;
  };
  try {
    const { releases, roadmap } = buildReleaseData({
      root: arg("--root") ?? ROOT,
      outDir: arg("--out") ?? OUT_DIR,
    });
    console.log(
      `release data: ${releases.length} release(s) in What's new, ${roadmap.length} item(s) in What's next`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
