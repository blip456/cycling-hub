/**
 * The app version for the build (`__APP_VERSION__`, vite.config.ts). Since D10 a release is a git tag and a
 * GitHub release; package.json is not bumped any more. So the version is the newest of package.json and
 * the releases in the generated What's new data (scripts/build-release-data.mjs), which holds the published
 * releases. A production build runs only after its release is published, so it shows its own version.
 * Pure (no Node or DOM APIs): vite.config.ts imports it.
 */

function semver(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** The highest semantic version of `packageVersion` and the release versions (invalid ones are skipped). */
export function appVersion(packageVersion: string, releaseVersions: readonly string[]): string {
  let best = packageVersion;
  let bestParts = semver(packageVersion);
  for (const version of releaseVersions) {
    const parts = semver(version);
    if (!parts) continue;
    const newer =
      bestParts === null ||
      parts[0] > bestParts[0] ||
      (parts[0] === bestParts[0] &&
        (parts[1] > bestParts[1] || (parts[1] === bestParts[1] && parts[2] > bestParts[2])));
    if (newer) {
      best = version.trim().replace(/^v/, "");
      bestParts = parts;
    }
  }
  return best;
}

/** The release versions in the generated changelog JSON; [] when it is missing or not in that shape. */
export function releaseVersions(json: unknown): string[] {
  if (typeof json !== "object" || json === null || !("releases" in json)) return [];
  const { releases } = json;
  if (!Array.isArray(releases)) return [];
  return releases.flatMap((release: unknown) =>
    typeof release === "object" &&
    release !== null &&
    "version" in release &&
    typeof release.version === "string"
      ? [release.version]
      : [],
  );
}
