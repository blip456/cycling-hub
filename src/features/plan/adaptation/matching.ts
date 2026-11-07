/**
 * The PO's own corrections of a match (R6, R6b): which sessions a ride can count for, and what to write when
 * the PO picks one (or none). A manual choice is locked (`match_source` "manual"): the next evaluation never
 * changes it. Unlinking is a locked unlink: `match_source` "manual" with no ride. Pure.
 */
import { diffDays, type IsoDate } from "@/features/athlete";
import { isIgnoredRide } from "../adapt";
import type { PlanSession, SessionChange } from "../data";
import { formatDay, formatDuration } from "../data";

/** Sessions within this many days of the ride are offered (R6b). */
export const PICK_WINDOW_DAYS = 2;

export type PickRide = { id: string; date: IsoDate; movingMinutes: number; commute: boolean };

export type Candidate = {
  session: PlanSession;
  /** "Long ride, Sat 24 Oct". */
  label: string;
  /** "150 min, best fit", "45 min, missed", "60 min, already has a ride". */
  note: string;
};

/** The session a ride counts for now, if any. */
export function sessionOfRide(
  rideId: string,
  sessions: readonly PlanSession[],
): PlanSession | null {
  return sessions.find((s) => s.activityId === rideId) ?? null;
}

function apart(ride: PickRide, session: PlanSession): number {
  return Math.abs(diffDays(ride.date, session.date) ?? Number.POSITIVE_INFINITY);
}

/** How close the ride's time is to the session's: 1 is a perfect fit. */
function fit(ride: PickRide, session: PlanSession): number {
  if (session.durationMin <= 0) return 0;
  const ratio = ride.movingMinutes / session.durationMin;
  return Math.min(ratio, 1 / ratio);
}

/** The sessions the ride can count for: within two days, not the event, best fit first. */
export function candidates(ride: PickRide, sessions: readonly PlanSession[]): Candidate[] {
  const near = sessions
    .filter(
      (s) => s.kind !== "event" && s.status !== "skipped" && apart(ride, s) <= PICK_WINDOW_DAYS,
    )
    .sort(
      (a, b) =>
        apart(ride, a) - apart(ride, b) ||
        fit(ride, b) - fit(ride, a) ||
        (a.date < b.date ? -1 : 1),
    );
  const best = near.filter((s) => s.activityId === null || s.activityId === ride.id)[0];
  return near.map((session) => {
    const parts = [formatDuration(session.durationMin)];
    if (session.activityId !== null && session.activityId !== ride.id) {
      parts.push("already has a ride");
    } else if (session.id === best?.id) parts.push("best fit");
    if (session.status === "missed") parts.push("missed");
    return {
      session,
      label: `${session.title}, ${formatDay(session.date)}`,
      note: parts.join(", "),
    };
  });
}

function unlink(session: PlanSession, today: IsoDate): SessionChange {
  return {
    id: session.id,
    patch: {
      activityId: null,
      matchSource: "manual",
      status: session.date < today ? "missed" : "planned",
    },
  };
}

/**
 * What to write when the ride is made to count for `target` (null: for no session, an extra ride). The
 * session that had the ride loses it (a locked unlink); a session that had another ride gives it up (that
 * ride then counts as extra, R6-PO2).
 */
export function manualMatch(
  ride: PickRide,
  target: PlanSession | null,
  sessions: readonly PlanSession[],
  today: IsoDate,
): SessionChange[] {
  const current = sessionOfRide(ride.id, sessions);
  const changes: SessionChange[] = [];
  if (current && current.id !== target?.id) changes.push(unlink(current, today));
  if (target) {
    changes.push({
      id: target.id,
      patch: { activityId: ride.id, matchSource: "manual", status: "done" },
    });
  }
  return changes;
}

/** The line under "Counts as": how the match came about. */
export function matchReason(ride: PickRide, session: PlanSession): string {
  if (session.matchSource === "manual") return "You chose this match.";
  const days = diffDays(session.date, ride.date) ?? 0;
  const when =
    days === 0
      ? "same day"
      : `${String(Math.abs(days))} ${Math.abs(days) === 1 ? "day" : "days"} ${days < 0 ? "before" : "after"} the session`;
  return `Matched automatically: ${when}, close to the planned time.`;
}

/** "Planned 150 min, done 142 min (95 %)." */
export function matchFacts(ride: PickRide, session: PlanSession): string {
  const planned = session.durationMin;
  const percent = planned > 0 ? Math.round((ride.movingMinutes / planned) * 100) : 0;
  return `Planned ${formatDuration(planned)}, done ${formatDuration(ride.movingMinutes)} (${String(percent)} %).`;
}

/** True when matching leaves this ride out unless the PO links it (a commute or under 20 minutes). */
export function isLeftOut(ride: PickRide): boolean {
  return isIgnoredRide({
    id: ride.id,
    date: ride.date,
    movingMinutes: ride.movingMinutes,
    avgPowerW: null,
    commute: ride.commute,
  });
}
