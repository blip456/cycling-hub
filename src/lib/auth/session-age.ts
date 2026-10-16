/** A3: the app asks to sign in again 30 days after the last successful sign-in. */
export const MAX_SESSION_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when the last sign-in is older than `maxAgeDays` (or missing / unreadable, which is treated as
 * expired so a broken value never keeps a session alive). A sign-in "in the future" (clock skew) is fine.
 */
export function isSessionExpired(
  lastSignInAt: string | Date | null | undefined,
  now: Date = new Date(),
  maxAgeDays: number = MAX_SESSION_AGE_DAYS,
): boolean {
  if (lastSignInAt === null || lastSignInAt === undefined || lastSignInAt === "") return true;
  const signedInMs = lastSignInAt instanceof Date ? lastSignInAt.getTime() : Date.parse(lastSignInAt);
  if (Number.isNaN(signedInMs)) return true;
  return now.getTime() - signedInMs > maxAgeDays * DAY_MS;
}
