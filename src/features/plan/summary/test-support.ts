/** Shared fixtures of the summary tests: an engine plan as the database stores it, a ride row and a profile. */
import { buildPlan } from "../engine";
import { EXAMPLE_B } from "../engine/fixtures";
import type { Plan, PlannedSession } from "../engine";
import type { ProfileFacts, RideRow } from "./adapt";
import type { PlanData, PlanSessionRow } from "./types";

export const PLAN: Plan = buildPlan(EXAMPLE_B);

const DB_KIND: Partial<Record<PlannedSession["kind"], string>> = {
  long: "long_ride",
  "sweet-spot": "sweet_spot",
  vo2: "vo2max",
};

/** An engine plan as the database would store it (snake_case kinds, a recovery week has phase `recovery`). */
function rowsOf(plan: Plan): PlanSessionRow[] {
  return plan.sessions.map((s, index) => {
    const week = plan.weeks[s.week - 1];
    return {
      id: `session-${index}`,
      plan_id: "plan-1",
      week_number: s.week,
      phase: week?.type === "recovery" ? "recovery" : (week?.phase ?? "base"),
      session_date: s.date,
      kind: DB_KIND[s.kind] ?? s.kind,
      title: s.title,
      duration_min: s.durationMin,
      quality_min: s.steps.some((st) => st.kind === "work" && st.target.percentFtp >= 88) ? 30 : 0,
      steps: JSON.parse(JSON.stringify(s.steps)) as unknown,
      reason: s.reason,
      status: "planned",
      activity_id: null,
      match_source: null,
    };
  });
}

export const ROWS = rowsOf(PLAN);
export const PLAN_DATA: PlanData = {
  plan: { id: "plan-1", start_date: PLAN.startDate, weeks: PLAN.weeks.length, ftp_w: 250 },
  sessions: ROWS,
};

export function rideRow(overrides: Partial<RideRow> = {}): RideRow {
  return {
    id: "ride-1",
    start_local: "2026-10-28T08:10:00",
    distance_m: 60_000,
    moving_time_s: 7200,
    elevation_m: 400,
    average_watts: 170,
    average_heartrate: 140,
    max_heartrate: 160,
    ...overrides,
  };
}

export const PROFILE: ProfileFacts = {
  trainingPurposes: ["weight_loss", "endurance"],
  level: "committed",
  weeklyHours: 8,
  ridingEnvironment: "both",
  availableDays: ["tue", "thu", "sat", "sun"],
  eventName: "100 km ride",
  eventDate: "2027-01-17",
  goal: null,
};
