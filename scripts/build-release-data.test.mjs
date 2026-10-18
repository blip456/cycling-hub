// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  BacklogFormatError,
  buildReleaseData,
  parseBacklog,
  parseChangelog,
  upcoming,
} from "./build-release-data.mjs";
import { changelogFileSchema, roadmapFileSchema } from "../src/features/release/schemas.ts";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const realBacklog = readFileSync(new URL("../docs/backlog.md", import.meta.url), "utf8");

describe("parseChangelog", () => {
  const releases = parseChangelog(fixture("CHANGELOG.release-please.md"));

  it("reads every release, newest first, with its date", () => {
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ["0.2.0", "2026-10-23"],
      ["0.1.0", "2026-10-17"],
    ]);
  });

  it("labels entries Feature / Fix / Technical, in that order", () => {
    expect(releases[0].entries).toEqual([
      { type: "feature", text: "Import rides from your export file" },
      { type: "feature", text: "The import history keeps files that were not imported" },
      { type: "feature", text: "Add What's new and What's next" },
      { type: "fix", text: "Sign-in keeps you signed in for 30 days on iOS" },
      { type: "fix", text: "Load the ride list faster" },
      { type: "technical", text: "Database checks run on every pull request" },
    ]);
  });

  it("strips link suffixes, scopes, headings and the breaking-change notes", () => {
    const text = JSON.stringify(releases);
    expect(text).not.toMatch(/\]\(|github\.com|\*\*|Changelog|BREAKING|closes/);
  });

  it("handles the first release heading without a compare link", () => {
    expect(releases[1].entries.map((e) => e.type)).toEqual(["feature", "feature", "technical"]);
  });

  it("returns nothing for an empty changelog", () => {
    expect(parseChangelog("# Changelog\n")).toEqual([]);
    expect(parseChangelog("")).toEqual([]);
  });
});

const entry = (lines) => ["# Backlog", "", ...lines, "", "### Details", "", "Stripped."].join("\n");

describe("parseBacklog", () => {
  it("parses the real docs/backlog.md without errors", () => {
    const items = parseBacklog(realBacklog);
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["sprint", "status", "tagline", "title", "version"]);
      expect(item.tagline.length).toBeGreaterThan(0);
    }
    expect(items.find((i) => i.version === "0.2.0")).toMatchObject({
      title: "Import & settings",
      sprint: 1,
    });
  });

  it("keeps only version, title, sprint, status and tagline", () => {
    const items = parseBacklog(
      entry(["## v1.2.0 — Rides", "Sprint: 4", "Status: In progress", "Tagline: All your rides."]),
    );
    expect(items).toEqual([
      {
        version: "1.2.0",
        title: "Rides",
        sprint: 4,
        status: "in progress",
        tagline: "All your rides.",
      },
    ]);
  });

  it("ignores Sprint/Status lines under ### Details and other headings", () => {
    const md = [
      "## How we work",
      "Status: whatever",
      "## v0.3.0 — Rides",
      "Sprint: 2",
      "Status: planned",
      "Tagline: Rides.",
      "### Details",
      "Status: broken",
      "Sprint: x",
    ].join("\n");
    expect(parseBacklog(md)).toEqual([
      { version: "0.3.0", title: "Rides", sprint: 2, status: "planned", tagline: "Rides." },
    ]);
  });

  it("ignores the format example inside a code fence", () => {
    const md = [
      "```markdown",
      "## v0.2.0 — Title",
      "Sprint: 1",
      "```",
      entry(["## v0.2.0 — Real", "Sprint: 1", "Status: planned", "Tagline: Real."]),
    ].join("\n");
    expect(parseBacklog(md)).toHaveLength(1);
  });

  it.each([
    ["a missing title", ["## v0.4.0", "Sprint: 3", "Status: planned", "Tagline: T."], /no title/],
    ["a missing sprint", ["## v0.4.0 — Zones", "Status: planned", "Tagline: T."], /no "Sprint:"/],
    [
      "a sprint that is not a number",
      ["## v0.4.0 — Zones", "Sprint: three", "Status: planned", "Tagline: T."],
      /not a whole number/,
    ],
    ["a missing status", ["## v0.4.0 — Zones", "Sprint: 3", "Tagline: T."], /no "Status:"/],
    [
      "an unknown status",
      ["## v0.4.0 — Zones", "Sprint: 3", "Status: done", "Tagline: T."],
      /"Status: done" is not one of/,
    ],
    ["a missing tagline", ["## v0.4.0 — Zones", "Sprint: 3", "Status: planned"], /no "Tagline:"/],
    [
      "an empty tagline",
      ["## v0.4.0 — Zones", "Sprint: 3", "Status: planned", "Tagline:"],
      /no "Tagline:"/,
    ],
    [
      "a malformed version heading",
      ["## v0.4 — Zones", "Sprint: 3", "Status: planned", "Tagline: T."],
      /is not "## vX.Y.Z — Title"/,
    ],
  ])("fails on %s", (_name, lines, message) => {
    expect(() => parseBacklog(entry(lines))).toThrow(message);
  });

  it("fails when a version appears twice and lists every problem", () => {
    const md = [
      "## v0.4.0 — Zones",
      "Sprint: 3",
      "Status: planned",
      "Tagline: T.",
      "## v0.4.0 — Zones again",
      "Sprint: 4",
      "Status: planned",
    ].join("\n");
    try {
      parseBacklog(md);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BacklogFormatError);
      expect(error.problems).toEqual([
        "line 5: v0.4.0 appears twice (first on line 1)",
        'line 5: v0.4.0 has no "Tagline:" line',
      ]);
    }
  });

  it("leaves shipped entries out of What's next", () => {
    const items = [
      { version: "0.1.0", title: "A", sprint: 0, status: "shipped", tagline: "A." },
      { version: "0.2.0", title: "B", sprint: 1, status: "in progress", tagline: "B." },
      { version: "0.3.0", title: "C", sprint: 2, status: "planned", tagline: "C." },
    ];
    expect(upcoming(items).map((i) => i.version)).toEqual(["0.2.0", "0.3.0"]);
  });
});

describe("buildReleaseData", () => {
  let dir;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function project({ changelog, backlog = realBacklog } = {}) {
    dir = mkdtempSync(join(tmpdir(), "release-data-"));
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs/backlog.md"), backlog);
    if (changelog) writeFileSync(join(dir, "CHANGELOG.md"), changelog);
    return dir;
  }

  it("writes empty What's new data when there is no CHANGELOG.md yet", () => {
    const root = project();
    buildReleaseData({ root, outDir: join(root, "out") });
    expect(JSON.parse(readFileSync(join(root, "out/changelog.json"), "utf8"))).toEqual({
      releases: [],
    });
    const roadmap = JSON.parse(readFileSync(join(root, "out/roadmap.json"), "utf8"));
    expect(roadmap.items.every((i) => i.status !== "shipped")).toBe(true);
  });

  it("writes the parsed changelog in the shape the app reads", () => {
    const root = project({ changelog: fixture("CHANGELOG.release-please.md") });
    buildReleaseData({ root, outDir: join(root, "out") });
    const read = (name) => JSON.parse(readFileSync(join(root, "out", name), "utf8"));
    expect(changelogFileSchema.parse(read("changelog.json")).releases).toHaveLength(2);
    expect(roadmapFileSchema.parse(read("roadmap.json")).items.length).toBeGreaterThan(0);
  });

  it("exits with a clear message on a broken backlog entry (the build fails)", () => {
    const root = project({
      backlog: realBacklog.replace(/^Tagline: All your rides.*$/m, "Tagline:"),
    });
    const script = fileURLToPath(new URL("./build-release-data.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--root", root, "--out", join(root, "out")], {
      encoding: "utf8",
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/sprint format/);
    expect(run.stderr).toMatch(/v0\.3\.0 has no "Tagline:" line/);
  });
});
