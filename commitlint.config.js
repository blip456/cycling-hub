// Conventional Commits (https://www.conventionalcommits.org). Used by the commit-msg hook and by
// CI for every commit and the PR title. Keep SCOPES in sync with the PR title check in ci.yml.

/** Product areas, then technical areas. Scopes are optional. */
export const SCOPES = [
  "app",
  "auth",
  "import",
  "rides",
  "settings",
  "design",
  "db",
  "ci",
  "deps",
  "docs",
  "release",
];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", SCOPES],
    // Release-please and GitHub write long URLs in bodies; warn instead of failing.
    "body-max-line-length": [1, "always", 100],
    "footer-max-line-length": [1, "always", 100],
  },
};
