// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseChangelog } from "./build-release-data.mjs";
import { nextVersion, parseCommit, releaseNotes } from "./next-release.mjs";

describe("parseCommit", () => {
  it("reads type, scope and description", () => {
    expect(parseCommit("feat(import): read export v2")).toEqual({
      type: "feat",
      scope: "import",
      breaking: false,
      description: "read export v2",
    });
  });

  it("drops the squash-merge PR number from the subject", () => {
    expect(parseCommit("fix(app): keep the theme (#42)")?.description).toBe("keep the theme");
  });

  it("marks breaking changes from the ! or a BREAKING CHANGE footer", () => {
    expect(parseCommit("feat!: drop the old import")?.breaking).toBe(true);
    expect(parseCommit("feat: new export", "BREAKING CHANGE: file format changed")?.breaking).toBe(
      true,
    );
  });

  it("returns null for subjects that are not Conventional Commits", () => {
    expect(parseCommit("Merge pull request #22 from blip456/dev")).toBeNull();
  });
});

describe("nextVersion", () => {
  const commit = (type, breaking = false) => ({ type, scope: null, breaking, description: "x" });

  it("bumps a patch for fix and perf", () => {
    expect(nextVersion("1.0.0", [commit("fix")])).toBe("1.0.1");
    expect(nextVersion("1.0.0", [commit("perf")])).toBe("1.0.1");
  });

  it("bumps a minor for feat", () => {
    expect(nextVersion("1.0.3", [commit("fix"), commit("feat")])).toBe("1.1.0");
  });

  it("bumps a major for a breaking change from 1.0.0 on", () => {
    expect(nextVersion("1.4.2", [commit("feat", true)])).toBe("2.0.0");
  });

  it("bumps a minor for a breaking change before 1.0.0", () => {
    expect(nextVersion("0.3.0", [commit("feat", true)])).toBe("0.4.0");
  });

  it("makes no release for types that do not change the app", () => {
    expect(nextVersion("1.0.0", [commit("docs"), commit("chore"), commit("ci")])).toBeNull();
    expect(nextVersion("1.0.0", [])).toBeNull();
  });

  it("refuses a tag that is not a semantic version", () => {
    expect(() => nextVersion("v1", [commit("fix")])).toThrow();
  });
});

describe("releaseNotes", () => {
  const commits = [
    { type: "feat", scope: "import", breaking: false, description: "read export v2" },
    { type: "fix", scope: null, breaking: false, description: "keep the theme" },
    { type: "perf", scope: "rides", breaking: false, description: "load the list faster" },
    { type: "docs", scope: "backlog", breaking: false, description: "plan sprint 3" },
  ];

  it("writes the sections that What's new reads back with the same labels", () => {
    const [release] = parseChangelog(releaseNotes("1.1.0", "2026-11-07", commits));
    expect(release).toMatchObject({ version: "1.1.0", date: "2026-11-07" });
    expect(release.entries).toEqual([
      { type: "feature", text: "Read export v2" },
      { type: "fix", text: "Keep the theme" },
      { type: "fix", text: "Load the list faster" },
      { type: "technical", text: "Plan sprint 3" },
    ]);
  });

  it("leaves out sections without entries", () => {
    const notes = releaseNotes("1.0.1", "2026-11-07", [commits[1]]);
    expect(notes).toContain("### Bug Fixes");
    expect(notes).not.toContain("### Features");
    expect(notes).not.toContain("### Technical");
  });
});
