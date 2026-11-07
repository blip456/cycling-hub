/**
 * When a session counts as done or missed (docs/plan/engine-rules.md section 11, working default R5-PO1).
 * Pure: it reads the sessions and the matches and says what to write.
 */
import type { IsoDate } from "@/features/athlete";
import { between } from "./dates";
import { LATE_IMPORT_DAYS } from "./match";
import type { Match, StatusUpdate, StoredSession } from "./types";

/**
 * Status updates for the sessions whose status or match changed.
 *
 * - A session with a matched ride is done (the link is `auto`, or stays `manual` when locked).
 * - A session without a ride is missed as soon as its day is over (the date is before `today`), checked at
 *   every evaluation; today and later it is planned. A late import that matches turns missed back to done.
 * - Skipped is a PO action and never changed here. A session the PO marked done without a ride (manual, no
 *   ride) stays done. A manual unlink stays unlinked (planned or missed by date).
 */
export function markStatuses(
  sessions: readonly StoredSession[],
  matches: readonly Match[],
  today: IsoDate,
): StatusUpdate[] {
  const byId = new Map(matches.map((match) => [match.sessionId, match]));
  // Older than the matching window: a done session stays done, whatever the ride list says.
  const older = (session: StoredSession): boolean =>
    between(today, session.date) < -LATE_IMPORT_DAYS;
  const updates: StatusUpdate[] = [];
  for (const session of sessions) {
    if (session.status === "skipped") continue;
    const match = byId.get(session.id);
    let next: StatusUpdate;
    if (match) {
      next = {
        id: session.id,
        status: "done",
        activityId: match.rideId,
        matchSource: match.by === "manual" ? "manual" : "auto",
      };
    } else if (session.status === "done" && (session.matchSource === "manual" || older(session))) {
      continue;
    } else {
      next = {
        id: session.id,
        status: session.date < today ? "missed" : "planned",
        activityId: null,
        matchSource: session.matchSource === "manual" ? "manual" : null,
      };
    }
    if (
      next.status !== session.status ||
      next.activityId !== session.activityId ||
      next.matchSource !== session.matchSource
    ) {
      updates.push(next);
    }
  }
  return updates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The sessions with status updates applied. Does not change the input. */
export function applyStatuses(
  sessions: readonly StoredSession[],
  updates: readonly StatusUpdate[],
): StoredSession[] {
  const byId = new Map(updates.map((update) => [update.id, update]));
  return sessions.map((session) => {
    const update = byId.get(session.id);
    return update
      ? {
          ...session,
          status: update.status,
          activityId: update.activityId,
          matchSource: update.matchSource,
        }
      : session;
  });
}
