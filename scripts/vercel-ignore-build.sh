#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json → ignoreCommand). Exit 1 = build, exit 0 = skip. Decisions D10, T15.
#
# - main: never deployed (no production database yet): skip.
# - dev (the production branch): build only a commit that has a release tag. The release workflow creates
#   the tag and then calls the deploy hook, so the build reads the release it belongs to. Other dev pushes
#   are skipped.
# - every other branch (preview): build.
set -uo pipefail

branch="${VERCEL_GIT_COMMIT_REF:-}"
if [ "$branch" = "main" ]; then
  echo "main is not deployed (decision D10): skipping."
  exit 0
fi

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "Preview deployment (${branch:-unknown branch}): building."
  exit 1
fi

# The repository is public: the token (optional, GITHUB_RELEASES_TOKEN) only raises the rate limit.
repo="${VERCEL_GIT_REPO_OWNER:-}/${VERCEL_GIT_REPO_SLUG:-}"
auth=()
if [ -n "${GITHUB_RELEASES_TOKEN:-}" ]; then auth=(-H "Authorization: Bearer $GITHUB_RELEASES_TOKEN"); fi
if ! refs=$(curl -fsS "${auth[@]}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$repo/git/matching-refs/tags/v"); then
  echo "Production (dev): GitHub could not be reached: building."
  exit 1
fi

# Lightweight release tags point straight at the commit; look for this commit's SHA among them.
if node -e '
  const refs = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const sha = process.argv[1];
  process.exit(refs.some((ref) => ref.object && ref.object.sha === sha) ? 0 : 1);
' "${VERCEL_GIT_COMMIT_SHA:-}" <<<"$refs"; then
  echo "Production (dev): commit ${VERCEL_GIT_COMMIT_SHA:0:7} is released: building."
  exit 1
fi

echo "Production (dev): commit ${VERCEL_GIT_COMMIT_SHA:0:7} is not a release: skipping."
exit 0
