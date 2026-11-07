import { addDays, type IsoDate, type WeightEntry } from "@/features/athlete";
import { summarizeMonth, summarizeSession, summarizeWeek, type SummaryOptions } from "../export";
import {
  contextFrom,
  goalsFrom,
  mondayOf,
  monthInput,
  rideDate,
  rideFromRow,
  sessionInput,
  weekInput,
  type ProfileFacts,
  type RideRow,
} from "./adapt";
import type { Subject } from "./subject";
import type { PlanChangeRow, PlanData, PlanSessionRow, RideMetrics } from "./types";

/** Everything loaded for a summary or the calendar page. */
export type SummarySource = {
  plan: PlanData;
  changes: readonly PlanChangeRow[];
  rides: readonly (RideRow & { strava_id: number })[];
  baseline: { ftp: number | null; lthr: number | null; maxHr: number | null };
  weight: readonly WeightEntry[];
  profile: ProfileFacts;
  weightGoal: { targetKg: number; targetDate: IsoDate } | null;
};

function ridesInRange(source: SummarySource, from: IsoDate, to: IsoDate) {
  return source.rides.filter((r) => rideDate(r) >= from && rideDate(r) <= to);
}

/** The planned session a subject names, or null (also for a dropped one). */
export function findSession(source: SummarySource, id: string): PlanSessionRow | null {
  return source.plan.sessions.find((s) => s.id === id) ?? null;
}

/** The rides whose stream results the summary of a subject needs (the matched ride, or the rides of the range). */
export function ridesNeeded(source: SummarySource, subject: Subject) {
  if (subject.kind === "session") {
    const row = findSession(source, subject.id);
    const ride = row?.activity_id ? source.rides.find((r) => r.id === row.activity_id) : undefined;
    return ride ? [ride] : [];
  }
  if (subject.kind === "week") {
    const start = mondayOf(subject.date);
    return ridesInRange(source, start, addDays(start, 6) ?? start);
  }
  const first = `${subject.year}-${String(subject.month).padStart(2, "0")}-01`;
  const next =
    subject.month === 12
      ? `${subject.year + 1}-01-01`
      : `${subject.year}-${String(subject.month + 1).padStart(2, "0")}-01`;
  return ridesInRange(source, first, addDays(next, -1) ?? first);
}

/** The summary text for a subject. `metrics` holds the stream results by ride id (missing means no results). */
export function buildSummary(
  subject: Subject,
  source: SummarySource,
  metrics: ReadonlyMap<string, RideMetrics | null>,
  madeAt: Date,
  options: SummaryOptions,
): string {
  const rides = new Map(
    source.rides.map((r) => [r.id, rideFromRow(r, metrics.get(r.id) ?? null)] as const),
  );
  const lookups = { plan: source.plan, ftp: source.baseline.ftp, rides, changes: source.changes };
  const context = contextFrom({
    madeAt,
    ...source.baseline,
    goals: goalsFrom(source.profile, source.weightGoal),
    weight: source.weight,
  });
  if (subject.kind === "session") {
    const row = findSession(source, subject.id);
    const input = row === null ? null : sessionInput(row, lookups);
    return summarizeSession(
      input ?? { session: null, ride: null, match: null, week: null },
      context,
      options,
    );
  }
  if (subject.kind === "week")
    return summarizeWeek(weekInput(subject.date, lookups), context, options);
  return summarizeMonth(monthInput(subject.year, subject.month, lookups), context, options);
}
