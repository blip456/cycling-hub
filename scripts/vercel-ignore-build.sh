#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json → ignoreCommand), decision T4 / backlog v0.1.0 item 15.
# Exit 1 = build, exit 0 = skip.
#
# - Previews (dev and every other branch): always build.
# - Production (main): build only the release commit that release-please creates, so the version
#   shown in the app always matches a release. Other pushes to main (dev -> main merges) are
#   deployed when their release PR is merged.
set -uo pipefail

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "Preview deployment (${VERCEL_GIT_COMMIT_REF:-unknown branch}): building."
  exit 1
fi

message="${VERCEL_GIT_COMMIT_MESSAGE:-$(git log -1 --pretty=%B 2>/dev/null)}"

# Release PR merged with "Squash and merge": the commit message is the PR title.
if [[ "$message" == "chore(release):"* ]]; then
  echo "Production: release commit ($(head -n 1 <<<"$message")): building."
  exit 1
fi

# Release PR merged with a merge commit: the release bumped the manifest in this commit.
if git rev-parse -q --verify HEAD^ >/dev/null 2>&1 &&
  ! git diff --quiet --diff-filter=M HEAD^ HEAD -- .release-please-manifest.json 2>/dev/null; then
  echo "Production: this commit changes .release-please-manifest.json (a release): building."
  exit 1
fi

echo "Production: not a release commit; skipping. Merge the release PR to deploy production."
exit 0
