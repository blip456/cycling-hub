// @vitest-environment node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkBranchName } from "./branch-name.mjs";

describe("checkBranchName", () => {
  it.each([
    "feat/ride-list",
    "fix/import-timezone",
    "hotfix/sign-in-loop",
    "chore/update-dependencies",
    "docs/readme",
    "refactor/query-hooks",
    "test/import-parser",
    "ci/repo-foundation",
    "feat/issue-12-ride-detail",
    "feat/v2",
    "main",
    "dev",
    "release-please--branches--main",
    "release-please--branches--main--components--cycling-hub",
    "claude/friendly-franklin-eaxlxr",
  ])("accepts %s", (name) => {
    expect(checkBranchName(name)).toBeNull();
  });

  it.each([
    "cleanup",
    "design-system",
    "feature/ride-list",
    "bugfix/header",
    "release/v0.1.0",
    "feat/Ride-List",
    "feat/ride_list",
    "feat/ride--list",
    "feat/-ride-list",
    "feat/ride-list-",
    "feat/ride.list",
    "feat/",
    "feat/ride/list",
    "FEAT/ride-list",
    "main-backup",
    "development",
    "claude/",
  ])("rejects %s", (name) => {
    expect(checkBranchName(name)).not.toBeNull();
  });
});

describe("CLI", () => {
  const script = fileURLToPath(new URL("./branch-name.mjs", import.meta.url));
  const run = (name) => spawnSync("node", [script, name], { encoding: "utf8" });

  it("exits 0 for a valid name", () => {
    expect(run("feat/ride-list").status).toBe(0);
  });

  it("exits 1 and explains the rule for an invalid name", () => {
    const result = run("Feature/RideList");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid branch name");
    expect(result.stderr).toContain("feat/");
  });
});
