/**
 * Rows to the adaptation's types. The adaptation works on `StoredSession` (the engine's session plus id,
 * ride and match); the database has no columns for the engine's `slot`, `mainSet` and `ladderStep`, so they
 * are derived from the stored kind and steps here, the way the engine writes them (checked against the
 * engine's own plans in `stored.test.ts`). Pure: no React, no Supabase.
 */
import type { IsoDate } from "@/features/athlete";
import type { Ride } from "@/features/rides/api";
import type { AdaptRide, StoredSession } from "../adapt";
import {
  isLadderKind,
  ladderFor,
  scoreLevel,
  sessionLoad,
  type Intake,
  type Level,
  type PlannedSession,
  type SessionSlot,
  type Step,
} from "../engine";
import type { PlanSession } from "../data";

/** The level the plan was built for (its ladders depend on it). */
export function levelOfIntake(intake: Intake): Level {
  return scoreLevel(intake.levelAnswers, intake.hoursPerWeek, intake.levelOverride).level;
}

type Derived = Pick<PlannedSession, "mainSet" | "ladderStep">;

/** The main set as the plan writes it ("3x15", sprints "6x8s") and its step on the ladder, from the steps. */
function derive(kind: PlanSession["kind"], steps: readonly Step[], level: Level): Derived {
  if (kind === "openers") return { mainSet: "3x1", ladderStep: null };
  const ladderKind = kind === "long" ? "tempo" : kind;
  if (!isLadderKind(ladderKind)) return { mainSet: null, ladderStep: null };
  const work = steps.filter((s) => s.kind === "work");
  const first = work[0];
  if (!first) return { mainSet: null, ladderStep: null };
  const length = ladderKind === "sprint" ? Math.round(first.durationSec) : first.durationMin;
  const mainSet = `${String(work.length)}x${String(length)}${kind === "sprint" ? "s" : ""}`;
  const ladderStep = ladderFor(level, ladderKind).findIndex(
    ([repeats, minutes]) => repeats === work.length && minutes === length,
  );
  return { mainSet, ladderStep: ladderStep < 0 ? null : ladderStep };
}

function slotOf(session: PlanSession, hardOrder: ReadonlyMap<string, number>): SessionSlot {
  if (session.kind === "long") return "long";
  if (session.kind === "openers") return "openers";
  if (session.kind === "event") return "event";
  const order = hardOrder.get(session.id);
  if (order === undefined) return "easy";
  return order === 0 ? "q1" : "q2";
}

/**
 * The stored sessions of a plan as the adaptation reads them. `intake` gives the level (for the ladders)
 * and the setting that fills `indoor` where a row follows the plan's environment (null).
 */
export function toStoredSessions(
  sessions: readonly PlanSession[],
  intake: Intake,
): StoredSession[] {
  const level = levelOfIntake(intake);
  // The hard sessions of a week besides the long ride: the first one by date is Q1, the next Q2.
  const hardOrder = new Map<string, number>();
  const perWeek = new Map<number, number>();
  const byDate = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const s of byDate) {
    if (s.kind === "long" || s.kind === "event" || s.kind === "openers") continue;
    if (!isLadderKind(s.kind) && s.kind !== "test") continue;
    const count = perWeek.get(s.week) ?? 0;
    hardOrder.set(s.id, count);
    perWeek.set(s.week, count + 1);
  }
  return sessions.map((s): StoredSession => {
    const derived = derive(s.kind, s.steps, level);
    return {
      date: s.date,
      week: s.week,
      slot: slotOf(s, hardOrder),
      kind: s.kind,
      title: s.title,
      durationMin: s.durationMin,
      steps: s.steps,
      reason: s.reason,
      indoor: s.indoor ?? (s.kind === "event" ? false : intake.environment === "indoor"),
      status: s.status,
      load: sessionLoad(s.steps),
      mainSet: derived.mainSet,
      ladderStep: derived.ladderStep,
      strengthNote: s.strengthNote,
      id: s.id,
      activityId: s.activityId,
      matchSource: s.matchSource,
      movedFrom: s.movedFrom,
    };
  });
}

/** The date part of a ride's local start time (the PO's own calendar day). */
export function rideDate(startLocal: string): IsoDate {
  return startLocal.slice(0, 10);
}

/** A ride as adaptation needs it. */
export function toAdaptRide(ride: Ride): AdaptRide {
  return {
    id: ride.id,
    date: rideDate(ride.start_local),
    movingMinutes: ride.moving_time_s / 60,
    avgPowerW: ride.average_watts,
    commute: ride.commute,
  };
}
