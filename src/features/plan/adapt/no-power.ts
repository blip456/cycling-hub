/**
 * The warning for sessions without power data (docs/plan/engine-rules.md section 14, P64, wireframe R7).
 * The plan never changes because of it: it is a status card with the way to fix it.
 */
import type { IsoDate } from "@/features/athlete";
import { between } from "./dates";
import type { AdaptRide, StoredSession } from "./types";

/** Done sessions without power in the window that raise the warning (`NO_POWER_WARNING`). */
export const NO_POWER_MIN_SESSIONS = 4;
/** The window in days, today included: the last 28 days. */
export const NO_POWER_WINDOW_DAYS = 28;

export type NoPowerWarning = {
  /** Number of done sessions without power in the window. */
  count: number;
  /** Dates of those sessions, oldest first. */
  dates: IsoDate[];
  /** The sessions, oldest first (for the "how to fix" list). */
  sessions: { id: string; date: IsoDate; title: string }[];
  /** Card title, e.g. "No power data on 5 sessions". */
  title: string;
  /** Card text: what does not happen first (R7). */
  message: string;
};

/**
 * The warning when 4 or more done sessions in the last 28 days (today and the 27 days before) have a matched
 * ride without power data; null below that, which makes the card go away. A session counts through its
 * matched ride (`activityId`); done without a ride, and a ride that is not in `rides`, do not count.
 */
export function noPowerWarning(
  sessions: readonly StoredSession[],
  rides: readonly AdaptRide[],
  today: IsoDate,
): NoPowerWarning | null {
  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
  const without = sessions
    .filter((session) => {
      if (session.status !== "done" || session.activityId === null) return false;
      const offset = between(session.date, today);
      if (offset < 0 || offset >= NO_POWER_WINDOW_DAYS) return false;
      const ride = ridesById.get(session.activityId);
      return ride !== undefined && (ride.avgPowerW === null || !(ride.avgPowerW > 0));
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  if (without.length < NO_POWER_MIN_SESSIONS) return null;
  return {
    count: without.length,
    dates: without.map((session) => session.date),
    sessions: without.map(({ id, date, title }) => ({ id, date, title })),
    title: `No power data on ${without.length} sessions`,
    message: "The plan stays the same. Power targets cannot be checked on these sessions.",
  };
}
