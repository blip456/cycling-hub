// Conventional Commits (https://www.conventionalcommits.org). Used by the commit-msg hook and by
// CI for every commit (ci.yml) and the PR title (pr-title.yml).

/** Product areas, then technical areas. Scopes are optional. */
export const SCOPES = [
  "app",
  "auth",
  "import",
  "rides",
  "settings",
  "extension",
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
