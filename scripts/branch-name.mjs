#!/usr/bin/env node
// Branch names: <type>/<kebab-case-description> (decision D4). Single source of truth for the
// lefthook pre-push hook and the "Branch name" CI job.
//
// Usage: node scripts/branch-name.mjs [branch]   (defaults to the current branch)
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const BRANCH_TYPES = ["feat", "fix", "hotfix", "chore", "docs", "refactor", "test", "ci"];

// Branches that are not named by hand: the long-lived branches, the release PR branch that
// release-please opens, and Claude Code session branches.
const EXEMPT = [/^main$/, /^dev$/, /^release-please--/, /^claude\/[A-Za-z0-9._-]+$/];

const PATTERN = new RegExp(`^(${BRANCH_TYPES.join("|")})/[a-z0-9]+(-[a-z0-9]+)*$`);

export const BRANCH_RULE = `Branch names are <type>/<description>
  types: ${BRANCH_TYPES.map((t) => `${t}/`).join(", ")}
  description: lower case a-z and 0-9, words joined by single hyphens
  examples: feat/ride-list, fix/import-timezone, chore/update-dependencies, ci/repo-foundation`;

/** Returns null when the name is valid, otherwise the reason it is not. */
export function checkBranchName(name) {
  if (EXEMPT.some((re) => re.test(name))) return null;
  if (PATTERN.test(name)) return null;
  const slash = name.indexOf("/");
  if (slash === -1) return `"${name}" has no <type>/ prefix.`;
  const type = name.slice(0, slash);
  if (!BRANCH_TYPES.includes(type)) return `"${type}/" is not an allowed branch type.`;
  return `"${name.slice(slash + 1)}" is not a kebab-case description.`;
}

export function currentBranch(cwd) {
  try {
    const name = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return name && name !== "HEAD" ? name : null; // HEAD = detached, nothing to check
  } catch {
    return null;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const name = process.argv[2] || currentBranch();
  const problem = name ? checkBranchName(name) : null;
  if (problem) {
    console.error(`Invalid branch name: ${problem}\n\n${BRANCH_RULE}`);
    console.error(`\nRename it with: git branch -m <type>/<description>`);
    process.exit(1);
  }
  if (name) console.log(`Branch name "${name}" is valid.`);
}
