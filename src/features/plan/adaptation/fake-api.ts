/**
 * An in-memory database for the runner tests: the plan, its session rows, the rides, the weight log and the
 * stored updates. It implements `RunnerApi` the way the Supabase API does (the same row layout, read back
 * with the real `sessionFromRow`), counts every write and can be told to fail.
 */
import { vi } from "vitest";
import type { IsoDate, WeightEntry } from "@/features/athlete";
import type { Ride } from "@/features/rides/api";
import { buildPlan, type PlanInput } from "../engine";
import type { PlanProfile } from "../data/api";
import { planFromRow, sessionFromRow, sessionInserts, toJson } from "../data/mapping";
import type { PlanSession, StoredPlan } from "../data/types";
import { purposesToProfile } from "../data/intake";
import type { PlanChange } from "./changes";
import { contentColumns } from "./rows";
import type { RunnerApi } from "./runner";

const USER = "u1";
const NOW = "2026-10-26T08:00:00Z";

export type FakeDb = {
  plan: StoredPlan;
  sessions: PlanSession[];
  changes: PlanChange[];
  rides: Ride[];
  weights: WeightEntry[];
  profile: PlanProfile;
  baseline: { ftp: number | null; lthr: number | null; maxHr: number | null };
};

/** The database right after the plan of `input` was created (the way `createPlan` stores it). */
export function fakeDb(input: PlanInput): FakeDb {
  const engine = buildPlan(input);
  const plan = planFromRow({
    id: "plan-1",
    user_id: USER,
    status: "active",
    undone_fingerprint: null,
    created_at: NOW,
    updated_at: NOW,
    start_date: engine.startDate,
    weeks: engine.weeks.length,
    intake: toJson(input.intake),
    ftp_w: input.ftp ?? 250,
    weight_kg: null,
    engine_version: engine.engineVersion,
    input_fingerprint: engine.fingerprint,
  });
  const sessions = sessionInserts(engine).flatMap((row, i): PlanSession[] => {
    const session = sessionFromRow({
      id: `s-${String(i)}`,
      plan_id: plan.id,
      user_id: USER,
      activity_id: null,
      match_source: null,
      moved_from: null,
      created_at: NOW,
      updated_at: NOW,
      ...row,
      indoor: row.indoor ?? null,
      reason: row.reason ?? "",
      status: row.status ?? "planned",
      steps: row.steps ?? [],
      planned_load: row.planned_load ?? 0,
      quality_min: row.quality_min ?? 0,
      day_order: row.day_order ?? 0,
    });
    return session ? [session] : [];
  });
  const { intake } = input;
  return {
    plan,
    sessions,
    changes: [],
    rides: [],
    weights: [],
    profile: {
      ridingEnvironment: intake.environment,
      weeklyHours: intake.hoursPerWeek,
      trainingPurposes: purposesToProfile(intake.purposes),
      levelAnswers: [
        intake.levelAnswers.experience,
        intake.levelAnswers.weeklyHours,
        intake.levelAnswers.intervals,
        intake.levelAnswers.longestRide,
        intake.levelAnswers.hardSessions,
      ],
      eventName: intake.event?.name ?? null,
      eventDate: intake.event?.date ?? null,
      availableDays: [...intake.availableDays],
    },
    baseline: { ftp: input.ftp, lthr: input.lthr ?? null, maxHr: input.maxHr ?? null },
  };
}

let rideCounter = 0;

/** A ride on `date` of `minutes` with the given average power (null: no power meter). */
export function fakeRide(date: IsoDate, minutes: number, watts: number | null = 180): Ride {
  rideCounter += 1;
  return {
    id: `ride-${String(rideCounter)}-${date}`,
    strava_id: rideCounter,
    name: "Ride",
    sport_type: "Ride",
    start_local: `${date}T09:00:00`,
    start_at: `${date}T08:00:00Z`,
    distance_m: 40000,
    moving_time_s: minutes * 60,
    elevation_m: 100,
    commute: false,
    trainer: false,
    average_watts: watts,
    max_watts: null,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    polyline: null,
  };
}

/**
 * The history of a plan the app has followed all along: every session before `before` was ridden (a ride,
 * linked and done), except on the `skip` dates, which stay as stored (planned, to be marked missed).
 */
export function addHistory(db: FakeDb, before: IsoDate, skip: readonly IsoDate[] = []): void {
  db.sessions = db.sessions.map((s) => {
    if (s.date >= before || skip.includes(s.date) || s.kind === "event") return s;
    const ride = fakeRide(s.date, s.durationMin);
    db.rides.push(ride);
    return { ...s, status: "done", activityId: ride.id, matchSource: "auto" };
  });
}

export type FakeApi = RunnerApi & {
  db: FakeDb;
  /** Every write call, in order: "statuses", "diff", "change", "plan", "pin", "undone". */
  writes: string[];
  failOn: (
    name: "statuses" | "diff" | "change" | "plan" | "pin" | "undone" | "load" | null,
  ) => void;
};

/** A `RunnerApi` on `db`. Calls are spies; `failOn` makes the named write reject once it is reached. */
export function fakeApi(db: FakeDb): FakeApi {
  let failing: string | null = null;
  const writes: string[] = [];
  const guard = (name: string) => {
    if (failing === name) throw new Error(`${name} failed`);
    writes.push(name);
  };
  const api: FakeApi = {
    db,
    writes,
    failOn: (name) => {
      failing = name;
    },
    load: vi.fn<RunnerApi["load"]>(() => {
      if (failing === "load") return Promise.reject(new Error("offline"));
      return Promise.resolve({
        plan: db.plan,
        sessions: db.sessions.map((s) => ({ ...s })),
        rides: db.rides,
        weights: db.weights,
        baseline: db.baseline,
        profile: db.profile,
        goal: null,
      });
    }),
    writeStatuses: vi.fn<RunnerApi["writeStatuses"]>((updates) => {
      guard("statuses");
      db.sessions = db.sessions.map((s) => {
        const update = updates.find((u) => u.id === s.id);
        return update
          ? {
              ...s,
              status: update.status,
              activityId: update.activityId,
              matchSource: update.matchSource,
            }
          : s;
      });
      return Promise.resolve();
    }),
    writeDiff: vi.fn<RunnerApi["writeDiff"]>((planId, diff, phaseOfWeek) => {
      guard("diff");
      for (const entry of diff.delete) {
        db.sessions = db.sessions.filter((s) =>
          entry.id ? s.id !== entry.id : !(s.date === entry.date && s.status === "planned"),
        );
      }
      for (const entry of diff.update) {
        db.sessions = db.sessions.map((s) => {
          if (s.id !== entry.id) return s;
          const row = sessionFromRow({
            ...rowOf(s),
            ...contentColumns(entry.after, phaseOfWeek(entry.after.week)),
          });
          return row ?? s;
        });
      }
      for (const entry of diff.insert) {
        const row = sessionFromRow({
          ...rowOf(null),
          id: entry.id ?? `new-${entry.session.date}`,
          plan_id: planId,
          ...contentColumns(entry.session, phaseOfWeek(entry.session.week)),
          status: entry.session.status,
          activity_id: entry.activityId ?? null,
          match_source: entry.matchSource ?? null,
        });
        if (row) db.sessions.push(row);
      }
      db.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return Promise.resolve();
    }),
    insertChange: vi.fn<RunnerApi["insertChange"]>(({ planId, reason, payload }) => {
      guard("change");
      const id = `c-${String(db.changes.length + 1)}`;
      db.changes.unshift({
        id,
        planId,
        createdAt: "2026-12-03T09:00:00Z",
        undoneAt: null,
        message: reason,
        payload,
      });
      return Promise.resolve(id);
    }),
    writePlan: vi.fn<RunnerApi["writePlan"]>((_planId, write) => {
      guard(write.fingerprint !== undefined || write.ftp !== undefined ? "plan" : "pin");
      db.plan = {
        ...db.plan,
        ...(write.fingerprint !== undefined ? { fingerprint: write.fingerprint } : {}),
        ...(write.undoneFingerprint !== undefined
          ? { undoneFingerprint: write.undoneFingerprint }
          : {}),
        ...(write.ftp !== undefined ? { ftp: write.ftp } : {}),
        ...(write.intake ? { intake: write.intake } : {}),
      };
      return Promise.resolve();
    }),
    markUndone: vi.fn<RunnerApi["markUndone"]>((changeId, at) => {
      guard("undone");
      db.changes = db.changes.map((c) => (c.id === changeId ? { ...c, undoneAt: at } : c));
      return Promise.resolve();
    }),
  };
  return api;
}

/** A session as the `planned_sessions` row it was read from (for `sessionFromRow`). */
function rowOf(session: PlanSession | null) {
  return {
    id: session?.id ?? "x",
    plan_id: session?.planId ?? "plan-1",
    user_id: USER,
    activity_id: session?.activityId ?? null,
    match_source: session?.matchSource ?? null,
    moved_from: session?.movedFrom ?? null,
    created_at: NOW,
    updated_at: NOW,
    indoor: session?.indoor ?? null,
    status: session?.status ?? "planned",
    day_order: 0,
    kind: "endurance",
    title: "",
    duration_min: 0,
    planned_load: 0,
    quality_min: 0,
    steps: [],
    reason: "",
    phase: "base",
    session_date: session?.date ?? "",
    week_number: session?.week ?? 1,
  };
}
