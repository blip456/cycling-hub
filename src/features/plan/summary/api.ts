import { downloadRideStreams, fetchCurrentBaseline } from "@/features/baseline/api";
import { getSupabase } from "@/lib/supabase/client";
import { rideMetrics } from "./stream-metrics";
import type { PlanChangeRow, PlanData, PlanRow, PlanSessionRow, RideMetrics } from "./types";

// This folder reads the plan with its own small queries (the plan screens have their own data layer).

const PLAN_COLUMNS = "id, start_date, weeks, ftp_w";
const SESSION_COLUMNS =
  "id, plan_id, week_number, phase, session_date, kind, title, duration_min, quality_min, steps, reason, status, activity_id, match_source";

/** The active plan and all its sessions (RLS: own rows only); no active plan gives no sessions. */
export async function fetchPlanData(): Promise<PlanData> {
  const { data: plan, error } = await getSupabase()
    .from("training_plans")
    .select(PLAN_COLUMNS)
    .eq("status", "active")
    .maybeSingle()
    .overrideTypes<PlanRow | null, { merge: false }>();
  if (error) throw new Error(error.message);
  if (plan === null) return { plan: null, sessions: [] };
  const { data: sessions, error: sessionsError } = await getSupabase()
    .from("planned_sessions")
    .select(SESSION_COLUMNS)
    .eq("plan_id", plan.id)
    .order("session_date", { ascending: true })
    .order("day_order", { ascending: true })
    .overrideTypes<PlanSessionRow[], { merge: false }>();
  if (sessionsError) throw new Error(sessionsError.message);
  return { plan, sessions };
}

/** The change log of a plan, oldest first. */
export async function fetchPlanChanges(planId: string): Promise<PlanChangeRow[]> {
  const { data, error } = await getSupabase()
    .from("plan_changes")
    .select("created_at, reason, undone_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true })
    .overrideTypes<PlanChangeRow[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/** The baseline values the summaries print and compute zones from. */
export type SummaryBaseline = { ftp: number | null; lthr: number | null; maxHr: number | null };

export async function fetchSummaryBaseline(): Promise<SummaryBaseline> {
  const row = await fetchCurrentBaseline();
  return { ftp: row?.ftp_w ?? null, lthr: row?.lthr ?? null, maxHr: row?.max_hr ?? null };
}

/**
 * Normalised power and zone minutes of one ride, from its stored stream. A ride without a stream, or one
 * that cannot be read, gives null: the summary then says the data is missing instead of failing.
 */
export async function fetchRideMetrics(
  ride: { stravaId: number },
  baseline: SummaryBaseline,
): Promise<RideMetrics | null> {
  try {
    const streams = await downloadRideStreams(ride);
    return streams === null ? null : rideMetrics(streams, baseline);
  } catch {
    return null;
  }
}
