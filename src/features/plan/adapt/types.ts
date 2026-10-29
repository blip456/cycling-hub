/**
 * Shared types of the plan adaptation (docs/plan/engine-rules.md, sections 11 to 14). Pure data: no React,
 * no Supabase, no clock. The data layer maps database rows to these and back; `kind` values are the engine's
 * `SessionKind` (the database stores snake_case).
 */
import type { IsoDate } from "@/features/athlete";
import type { ChangeReason, PlannedSession, SessionChange } from "../engine";
import type { MatchInfo } from "../export/types";

/** `auto` is set by matching, `manual` by the PO (a link or an unlink) and is locked. */
export type MatchSource = "auto" | "manual";

/**
 * A planned session as the plan stores it: the engine's session plus its row id and its match. A session
 * with `matchSource` "manual" is locked: with `activityId` it is a fixed link, without it a fixed unlink (or a
 * "marked as done without a ride" when its status is done).
 */
export type StoredSession = PlannedSession & {
  /** Stable id: the calendar file derives its UID from it. */
  id: string;
  activityId: string | null;
  matchSource: MatchSource | null;
  /** The date this session was moved from after a miss (moved once, never again); null otherwise. */
  movedFrom: IsoDate | null;
};

/** A ride (imported activity) as adaptation needs it. */
export type AdaptRide = {
  id: string;
  date: IsoDate;
  /** Moving time in minutes. */
  movingMinutes: number;
  /** Average power in watts; null when the ride has no power data. */
  avgPowerW: number | null;
  /** Tagged commute: ignored by matching unless the PO links it. */
  commute?: boolean;
};

/** One ride linked to one session. `info` is what the summaries stream's `MatchInfo` needs. */
export type Match = {
  sessionId: string;
  sessionDate: IsoDate;
  rideId: string;
  rideDate: IsoDate;
  by: MatchInfo["by"];
  flags: MatchInfo["flags"];
  /** Minutes short of the planned time when the ride is short; null otherwise. */
  shortByMinutes: number | null;
  /** Ride moving time divided by planned minutes. */
  ratio: number;
  /** The ride is earlier than the session's day ("done early"). */
  doneEarly: boolean;
  /** Same data in the shape of the summaries (`by`, `flags`, `shortByMinutes`). */
  info: MatchInfo;
};

/** Result of matching: the links and the rides that count as extra (unplanned) rides. */
export type MatchResult = {
  matches: Match[];
  /** Rides that fit no session and are not ignored: extra rides (section 13). */
  extraRides: AdaptRide[];
};

/** A change of a stored session's status or match, for the data layer to write. */
export type StatusUpdate = {
  id: string;
  status: PlannedSession["status"];
  activityId: string | null;
  matchSource: MatchSource | null;
};

/** The plan content of a session (what a diff inserts or updates). */
export type SessionData = PlannedSession & { movedFrom: IsoDate | null };

export type DiffInsert = {
  /** Set when an Undo re-inserts a deleted session: the row keeps its id. */
  id?: string;
  session: SessionData;
  /** Set when a ride already counts for the new session (its status is then done). */
  activityId?: string | null;
  matchSource?: MatchSource | null;
};
/** A session changes in place: same id, same date (sessions are merged by date). */
export type DiffUpdate = { id: string; date: IsoDate; before: SessionData; after: SessionData };
/** `id` is missing for the inverse of an insert (the row has no id yet): delete by `date`, one session per date. */
export type DiffDelete = { id?: string; date: IsoDate; session: SessionData };

/** What to write to change the future sessions of a plan: keyed by session id and date. */
export type PlanDiff = {
  insert: DiffInsert[];
  update: DiffUpdate[];
  delete: DiffDelete[];
};

/** A session change with its reason, for the "Plan changes" screen (R4: Before, Now, Why). */
export type AdaptChange = SessionChange & {
  reasonCode: ChangeReason;
  /** One plain sentence ending with a full stop. */
  reason: string;
};

/** The Undo of an update. Restoring the previous fingerprint and pinning the undone one are both stored. */
export type UndoPlan = {
  description: string;
  /** Inverse of the diff: restores the previous future sessions. Statuses are not undone. */
  diff: PlanDiff;
  /** Store this as the plan's fingerprint again (the fingerprint before the update). */
  restoreFingerprint: string | null;
  /** Store this as "undone": the same inputs are not recalculated until an input changes. */
  undoneFingerprint: string;
};
