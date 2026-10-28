/** The running app version, from package.json at build time (vite.config.ts). */
export const APP_VERSION: string = __APP_VERSION__;

function parse(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** -1, 0 or 1 like a sort comparator; null when either version is not semver. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/**
 * True when `current` is a newer release than `lastSeen`. An unreadable stored value counts as older,
 * so the card shows once and then stores a clean value.
 */
export function isNewerThanSeen(current: string, lastSeen: string): boolean {
  const order = compareVersions(current, lastSeen);
  return order === null ? parse(current) !== null : order > 0;
}

/** "2026-10-23" → "23 Oct 2026" (DESIGN.md date style). */
export function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
