import type { IsoDate } from "@/features/athlete";

/** The columns of `planned_sessions` the summary and calendar screens read. */
export type PlanSessionRow = {
  id: string;
  plan_id: string;
  week_number: number;
  phase: string;
  session_date: IsoDate;
  kind: string;
  title: string;
  duration_min: number;
  quality_min: number;
  steps: unknown;
  reason: string;
  status: string;
  activity_id: string | null;
  match_source: string | null;
};

/** The columns of `training_plans` the screens read. */
export type PlanRow = {
  id: string;
  start_date: IsoDate;
  weeks: number;
  ftp_w: number;
};

/** The active plan with all its sessions; both are empty when there is no active plan. */
export type PlanData = { plan: PlanRow | null; sessions: PlanSessionRow[] };

/** One entry of the change log (`plan_changes`) that the summaries mention. */
export type PlanChangeRow = {
  created_at: string;
  reason: string;
  undone_at: string | null;
};

/** What the summaries need from the stream of one ride (null when the ride has no stored stream). */
export type RideMetrics = {
  normalizedPowerW: number | null;
  powerZoneMinutes: number[] | null;
  hrZoneMinutes: number[] | null;
};

export type SummaryKind = "session" | "week" | "month";
