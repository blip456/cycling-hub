import type { PlanSession, SessionPatch } from "./types";

/** A session with a patch applied (the same change the database update makes). */
export function applyPatch(session: PlanSession, patch: SessionPatch): PlanSession {
  return {
    ...session,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.movedFrom !== undefined ? { movedFrom: patch.movedFrom } : {}),
    ...(patch.indoor !== undefined ? { indoor: patch.indoor } : {}),
    ...(patch.activityId !== undefined ? { activityId: patch.activityId } : {}),
    ...(patch.matchSource !== undefined ? { matchSource: patch.matchSource } : {}),
  };
}

/** The patch that puts a session back as it is now, for the fields `patch` changes. */
export function inversePatch(session: PlanSession, patch: SessionPatch): SessionPatch {
  return {
    ...(patch.status !== undefined ? { status: session.status } : {}),
    ...(patch.date !== undefined ? { date: session.date } : {}),
    ...(patch.movedFrom !== undefined ? { movedFrom: session.movedFrom } : {}),
    ...(patch.indoor !== undefined ? { indoor: session.indoor } : {}),
    ...(patch.activityId !== undefined ? { activityId: session.activityId } : {}),
    ...(patch.matchSource !== undefined ? { matchSource: session.matchSource } : {}),
  };
}
