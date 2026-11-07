#!/usr/bin/env node
// Works out the next semantic version from the Conventional Commits since the last vX.Y.Z tag, and the
// GitHub release notes for it (decisions D10 and T15). .github/workflows/release.yml runs it on every push
// to dev. It writes release=true|false and version=X.Y.Z to $GITHUB_OUTPUT when that is set.
//
//   node scripts/next-release.mjs --out <notes.md>
//
// Bumps (D5, refined by D10): a breaking change is a major bump from 1.0.0 on and a minor bump before
// that; feat is a minor bump; fix and perf are patch bumps. Commits of any other type (docs, chore, ci,
// refactor, …) make no release on their own; they are listed under Technical in the next release.

import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
// "feat(import)!: text" or "fix: text"; squash merges add " (#12)" to the subject, which is removed.
const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+?)\s*$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;

/**
 * @typedef {{ type: string; scope: string | null; breaking: boolean; description: string }} Commit
 */

/** @returns {Commit | null} null when the subject is not a Conventional Commit. */
export function parseCommit(subject, body = "") {
  const match = HEADER.exec(subject.replace(/\s+\(#\d+\)$/, "").trim());
  if (!match) return null;
  return {
    type: match[1].toLowerCase(),
    scope: match[2] ?? null,
    breaking: match[3] === "!" || BREAKING_FOOTER.test(body),
    description: match[4],
  };
}

/** @returns {string | null} the next version, or null when no commit calls for a release. */
export function nextVersion(current, commits) {
  const match = SEMVER.exec(current);
  if (!match) throw new Error(`not a semantic version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (commits.some((c) => c.breaking)) {
    return major >= 1 ? `${major + 1}.0.0` : `0.${minor + 1}.0`;
  }
  if (commits.some((c) => c.type === "feat")) return `${major}.${minor + 1}.0`;
  if (commits.some((c) => c.type === "fix" || c.type === "perf")) {
    return `${major}.${minor}.${patch + 1}`;
  }
  return null;
}

// Same sections as release-please used (release-please-config.json); parseChangelog in
// build-release-data.mjs reads them back, so the in-app What's new keeps its three labels.
const SECTIONS = [
  ["Features", (c) => c.type === "feat"],
  ["Bug Fixes", (c) => c.type === "fix"],
  ["Performance", (c) => c.type === "perf"],
  ["Reverts", (c) => c.type === "revert"],
  ["Technical", (c) => !["feat", "fix", "perf", "revert"].includes(c.type)],
];

/** Markdown for the GitHub release body: "## X.Y.Z (date)" and one section per change type. */
export function releaseNotes(version, date, commits) {
  const lines = [`## ${version} (${date})`];
  for (const [title, belongs] of SECTIONS) {
    const items = commits.filter(belongs);
    if (items.length === 0) continue;
    lines.push("", `### ${title}`, "");
    for (const c of items) {
      lines.push(c.scope ? `* **${c.scope}:** ${c.description}` : `* ${c.description}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lastTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*"]);
  } catch {
    return null;
  }
}

/** Conventional commits since the tag (or since the start), oldest first. */
function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const log = git(["log", "--reverse", range, "--format=%s%x1f%b%x1e"]);
  return log
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ""] = record.split("\x1f");
      return parseCommit(subject, body);
    })
    .filter(Boolean);
}

function today() {
  // The release date in the Brussels calendar day (sv-SE formats as YYYY-MM-DD).
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
}

function main(argv) {
  const outIndex = argv.indexOf("--out");
  const out = outIndex >= 0 ? argv[outIndex + 1] : undefined;

  const tag = lastTag();
  const current = tag ? tag.slice(1) : "0.0.0";
  const commits = commitsSince(tag);
  const version = nextVersion(current, commits);
  const release = version !== null;

  if (out) writeFileSync(out, release ? releaseNotes(version, today(), commits) : "");
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `release=${release}\nversion=${version ?? ""}\n`);
  }
  console.log(
    release
      ? `Next release: v${version} (from ${current}, ${commits.length} conventional commits)`
      : `No release: nothing since ${tag ?? "the first commit"} calls for a version bump.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
