/** The planned_sessions columns for a session of a diff (the same layout `sessionInserts` writes for a new plan). */
import type { Database } from "@/lib/supabase/database.types";
import type { SessionData } from "../adapt";
import { joinReason, kindToDb, qualityOf, toJson } from "../data/mapping";
import type { StoredPhase } from "../data/types";

type SessionInsert = Database["public"]["Tables"]["planned_sessions"]["Insert"];

/** Columns that hold the plan content of a session. Status, ride and match are not part of it. */
export function contentColumns(
  session: SessionData,
  phase: StoredPhase,
): Omit<SessionInsert, "plan_id" | "status" | "activity_id" | "match_source"> {
  return {
    week_number: session.week,
    phase,
    session_date: session.date,
    kind: kindToDb(session.kind),
    title: session.title,
    duration_min: Math.round(session.durationMin),
    planned_load: Math.round(session.load * 10) / 10,
    quality_min: Math.round(qualityOf(session)),
    steps: toJson(session.steps),
    reason: joinReason(session.reason, session.strengthNote).slice(0, 1000),
    indoor: session.kind === "event" ? null : session.indoor,
    moved_from: session.movedFrom,
    day_order: 0,
  };
}
