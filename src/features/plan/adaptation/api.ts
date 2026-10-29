/** Supabase side of the adaptation: reading what an evaluation needs and writing its result. */
import { fetchCurrentBaseline } from "@/features/baseline/api";
import { fetchRides } from "@/features/rides/api";
import { fetchWeightEntries } from "@/features/weight/api";
import { getSupabase } from "@/lib/supabase/client";
import type { StatusUpdate } from "../adapt";
import {
  fetchActivePlan,
  fetchActiveWeightGoal,
  fetchPlanProfile,
  fetchPlanSessions,
} from "../data/api";
import { toJson } from "../data/mapping";
import { payloadFromJson, type PlanChange } from "./changes";
import { contentColumns } from "./rows";
import type { RunnerApi } from "./runner";

const INSERT_CHUNK = 100;

/** The runner's API on the database. Every function throws on a failed request; the runner catches it. */
export function createSupabaseRunnerApi(userId: string): RunnerApi {
  return {
    async load() {
      const plan = await fetchActivePlan();
      if (!plan) return null;
      const [sessions, rides, weights, baseline, profile, goal] = await Promise.all([
        fetchPlanSessions(plan.id),
        fetchRides(),
        fetchWeightEntries(),
        fetchCurrentBaseline(),
        fetchPlanProfile(userId),
        fetchActiveWeightGoal(),
      ]);
      return {
        plan,
        sessions,
        rides,
        weights,
        baseline: {
          ftp: baseline?.ftp_w ?? null,
          lthr: baseline?.lthr ?? null,
          maxHr: baseline?.max_hr ?? null,
        },
        profile,
        goal,
      };
    },

    async writeStatuses(updates: readonly StatusUpdate[]) {
      for (const update of updates) {
        const { error } = await getSupabase()
          .from("planned_sessions")
          .update({
            status: update.status,
            activity_id: update.activityId,
            match_source: update.matchSource,
          })
          .eq("id", update.id);
        if (error) throw new Error(error.message);
      }
    },

    async writeDiff(planId, diff, phaseOfWeek) {
      const supabase = getSupabase();
      // Deleted first so a date is free before a session is put on it; deleting without an id (the inverse of
      // an insert) only removes a session that is still planned.
      for (const entry of diff.delete) {
        const query = supabase.from("planned_sessions").delete();
        const { error } = entry.id
          ? await query.eq("id", entry.id)
          : await query
              .eq("plan_id", planId)
              .eq("session_date", entry.date)
              .eq("status", "planned");
        if (error) throw new Error(error.message);
      }
      for (const entry of diff.update) {
        const { error } = await supabase
          .from("planned_sessions")
          .update(contentColumns(entry.after, phaseOfWeek(entry.after.week)))
          .eq("id", entry.id);
        if (error) throw new Error(error.message);
      }
      const rows = diff.insert.map((entry) => ({
        ...contentColumns(entry.session, phaseOfWeek(entry.session.week)),
        plan_id: planId,
        status: entry.session.status,
        activity_id: entry.activityId ?? null,
        match_source: entry.matchSource ?? null,
        ...(entry.id ? { id: entry.id } : {}),
      }));
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const { error } = await supabase
          .from("planned_sessions")
          .insert(rows.slice(i, i + INSERT_CHUNK));
        if (error) throw new Error(error.message);
      }
    },

    async insertChange({ planId, reason, payload }) {
      const { data, error } = await getSupabase()
        .from("plan_changes")
        .insert({ plan_id: planId, reason, changes: toJson(payload), undone_at: null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },

    async writePlan(planId, write) {
      const columns = {
        ...(write.fingerprint !== undefined ? { input_fingerprint: write.fingerprint } : {}),
        ...(write.undoneFingerprint !== undefined
          ? { undone_fingerprint: write.undoneFingerprint }
          : {}),
        ...(write.ftp !== undefined ? { ftp_w: write.ftp } : {}),
        ...(write.weeks !== undefined ? { weeks: write.weeks } : {}),
        ...(write.intake ? { intake: toJson(write.intake) } : {}),
      };
      const { error } = await getSupabase().from("training_plans").update(columns).eq("id", planId);
      if (error) throw new Error(error.message);
    },

    async markUndone(changeId, at) {
      const { error } = await getSupabase()
        .from("plan_changes")
        .update({ undone_at: at })
        .eq("id", changeId);
      if (error) throw new Error(error.message);
    },
  };
}

/** The most recent updates of a plan, newest first. Rows whose stored JSON cannot be read are left out. */
export async function fetchPlanChanges(planId: string, limit: number): Promise<PlanChange[]> {
  const { data, error } = await getSupabase()
    .from("plan_changes")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.flatMap((row) => {
    const payload = payloadFromJson(row.changes);
    return payload
      ? [
          {
            id: row.id,
            planId: row.plan_id,
            createdAt: row.created_at,
            undoneAt: row.undone_at,
            message: row.reason,
            payload,
          },
        ]
      : [];
  });
}
