import { z } from "zod";
import type { IsoDate } from "@/features/athlete";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  ENVIRONMENTS,
  EVENT_DURATIONS,
  LEVELS,
  PURPOSES,
  SESSION_STATUSES,
  type Intake,
  type Plan,
  type PlannedSession,
  type SessionKind,
  type SessionStatus,
  type Step,
  type Week,
} from "../engine";
import type { PlanSession, PlanStatus, StoredPhase, StoredPlan } from "./types";

type PlanRow = Database["public"]["Tables"]["training_plans"]["Row"];
type SessionRow = Database["public"]["Tables"]["planned_sessions"]["Row"];
export type PlanInsert = Database["public"]["Tables"]["training_plans"]["Insert"];
export type SessionInsert = Omit<
  Database["public"]["Tables"]["planned_sessions"]["Insert"],
  "plan_id"
>;

// ---- kinds ---------------------------------------------------------------------------------------

/** The database writes kinds in snake_case; the engine in kebab-case (and `long`, `vo2`). */
const KIND_FROM_DB: Record<string, SessionKind> = {
  recovery: "recovery",
  endurance: "endurance",
  long_ride: "long",
  tempo: "tempo",
  sweet_spot: "sweet-spot",
  threshold: "threshold",
  vo2max: "vo2",
  sprint: "sprint",
  torque: "torque",
  openers: "openers",
  test: "test",
  event: "event",
};

const KIND_TO_DB: Record<SessionKind, string> = {
  recovery: "recovery",
  endurance: "endurance",
  long: "long_ride",
  tempo: "tempo",
  "sweet-spot": "sweet_spot",
  threshold: "threshold",
  vo2: "vo2max",
  sprint: "sprint",
  torque: "torque",
  openers: "openers",
  test: "test",
  event: "event",
};

/** Database kind to the engine's kind; null for a value the engine does not know. */
export function kindFromDb(kind: string): SessionKind | null {
  return KIND_FROM_DB[kind] ?? null;
}

export function kindToDb(kind: SessionKind): string {
  return KIND_TO_DB[kind];
}

export function phaseToDb(week: Week | undefined): StoredPhase {
  if (!week) return "base";
  if (week.type === "recovery") return "recovery";
  return week.phase;
}

function phaseFromDb(phase: string): StoredPhase {
  return phase === "base" ||
    phase === "build" ||
    phase === "peak" ||
    phase === "recovery" ||
    phase === "taper"
    ? phase
    : "base";
}

// ---- steps ---------------------------------------------------------------------------------------

const stepSchema = z.object({
  kind: z.enum(["warm-up", "work", "rest", "easy", "cool-down"]),
  label: z.string(),
  durationSec: z.number(),
  durationMin: z.number(),
  target: z.object({
    percentFtp: z.number(),
    minPercent: z.number(),
    maxPercent: z.number().nullable(),
    watts: z.object({
      target: z.number().nullable(),
      min: z.number().nullable(),
      max: z.number().nullable(),
    }),
    powerZone: z.number().nullable(),
    exact: z.boolean(),
  }),
  heartRate: z
    .object({
      zoneFrom: z.number(),
      zoneTo: z.number(),
      min: z.number(),
      max: z.number().nullable(),
      reference: z.enum(["lthr", "max-hr"]),
    })
    .nullable(),
  powerLeads: z.boolean(),
  cadence: z.string().nullable(),
});

/** Steps from the jsonb column. Steps that cannot be read give an empty list: the page then shows the totals only. */
export function stepsFromJson(json: unknown): Step[] {
  const parsed = z.array(stepSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}

// ---- intake --------------------------------------------------------------------------------------

const score = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const intakeSchema = z.object({
  purposes: z.array(z.enum(PURPOSES)),
  levelAnswers: z.object({
    experience: score,
    weeklyHours: score,
    intervals: score,
    longestRide: score,
    hardSessions: score,
  }),
  levelOverride: z.enum(LEVELS).optional(),
  hoursPerWeek: z.number(),
  availableDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])),
  environment: z.enum(ENVIRONMENTS),
  event: z
    .object({
      name: z.string(),
      date: z.string(),
      duration: z.enum(EVENT_DURATIONS).optional(),
    })
    .optional(),
  startDate: z.string().optional(),
  weightKg: z.number().optional(),
  weightGoal: z.object({ targetKg: z.number(), targetDate: z.string() }).optional(),
  weightRateCapPercent: z.number().optional(),
  recoveryEvery: z.union([z.literal(3), z.literal(4)]).optional(),
  ftpTest: z.enum(["twenty-minute", "ramp"]).optional(),
});

/** The intake stored with a plan, or null when it is missing or not in the expected shape. */
export function intakeFromJson(json: unknown): Intake | null {
  const parsed = intakeSchema.safeParse(json);
  if (!parsed.success) return null;
  const v = parsed.data;
  return {
    purposes: v.purposes,
    levelAnswers: v.levelAnswers,
    ...(v.levelOverride ? { levelOverride: v.levelOverride } : {}),
    hoursPerWeek: v.hoursPerWeek,
    availableDays: v.availableDays,
    environment: v.environment,
    ...(v.event
      ? {
          event: {
            name: v.event.name,
            date: v.event.date,
            ...(v.event.duration ? { duration: v.event.duration } : {}),
          },
        }
      : {}),
    ...(v.startDate ? { startDate: v.startDate } : {}),
    ...(v.weightKg !== undefined ? { weightKg: v.weightKg } : {}),
    ...(v.weightGoal ? { weightGoal: v.weightGoal } : {}),
    ...(v.weightRateCapPercent !== undefined
      ? { weightRateCapPercent: v.weightRateCapPercent }
      : {}),
    ...(v.recoveryEvery ? { recoveryEvery: v.recoveryEvery } : {}),
    ...(v.ftpTest ? { ftpTest: v.ftpTest } : {}),
  };
}

/** Any plain value as a database JSON value (undefined keys drop out). */
export function toJson(value: unknown): NonNullable<Json> {
  return JSON.parse(JSON.stringify(value)) as NonNullable<Json>;
}

// ---- rows ----------------------------------------------------------------------------------------

function planStatus(status: string): PlanStatus {
  return status === "replaced" || status === "completed" || status === "cancelled"
    ? status
    : "active";
}

export function planFromRow(row: PlanRow): StoredPlan {
  return {
    id: row.id,
    startDate: row.start_date,
    weeks: row.weeks,
    status: planStatus(row.status),
    intake: intakeFromJson(row.intake),
    ftp: row.ftp_w,
    weightKg: row.weight_kg,
    engineVersion: row.engine_version,
    fingerprint: row.input_fingerprint,
    undoneFingerprint: row.undone_fingerprint,
    createdAt: row.created_at,
  };
}

/**
 * The planned_sessions table has no column for the off-bike strength note, so it is stored at the end of
 * `reason` after this marker and split off again when the row is read.
 */
const STRENGTH_MARKER = "\n\nStrength note: ";

/** `reason` and the strength note as one text for the `reason` column. */
export function joinReason(reason: string, strengthNote: string | null): string {
  return strengthNote === null ? reason : `${reason}${STRENGTH_MARKER}${strengthNote}`;
}

/** The text of the `reason` column as the reason and the strength note. */
export function splitReason(text: string): { reason: string; strengthNote: string | null } {
  const at = text.indexOf(STRENGTH_MARKER);
  if (at < 0) return { reason: text, strengthNote: null };
  return { reason: text.slice(0, at), strengthNote: text.slice(at + STRENGTH_MARKER.length) };
}

function sessionStatus(status: string): SessionStatus | null {
  return (SESSION_STATUSES as readonly string[]).includes(status)
    ? (status as SessionStatus)
    : null;
}

/** A session row as the screens use it; null for a row the screens do not show (dropped, unknown kind). */
export function sessionFromRow(row: SessionRow): PlanSession | null {
  const kind = kindFromDb(row.kind);
  const status = sessionStatus(row.status);
  if (kind === null || status === null) return null;
  const { reason, strengthNote } = splitReason(row.reason);
  return {
    id: row.id,
    planId: row.plan_id,
    date: row.session_date,
    week: row.week_number,
    phase: phaseFromDb(row.phase),
    kind,
    title: row.title,
    durationMin: row.duration_min,
    load: row.planned_load,
    qualityMin: row.quality_min,
    steps: stepsFromJson(row.steps),
    reason,
    strengthNote,
    status,
    indoor: row.indoor,
    activityId: row.activity_id,
    matchSource:
      row.match_source === "auto" || row.match_source === "manual" ? row.match_source : null,
    movedFrom: row.moved_from,
    dayOrder: row.day_order,
  };
}

/** The plan row to insert for an engine plan (status active; the caller replaces the old one first). */
export function planInsert(input: {
  plan: Plan;
  intake: Intake;
  ftp: number;
  weightKg: number | null;
}): PlanInsert {
  const { plan, intake, ftp, weightKg } = input;
  return {
    start_date: plan.startDate,
    weeks: plan.weeks.length,
    status: "active",
    intake: toJson(intake),
    ftp_w: Math.round(ftp),
    weight_kg: weightKg,
    engine_version: plan.engineVersion,
    input_fingerprint: plan.fingerprint,
  };
}

/** Minutes of work at 88 % FTP and up (the same measure as the engine's quality minutes). */
export function qualityOf(session: PlannedSession): number {
  return session.steps
    .filter((s) => s.kind === "work" && s.target.percentFtp >= 88)
    .reduce((sum, s) => sum + s.durationSec / 60, 0);
}

/** The session rows of an engine plan: one per session, in date order, `day_order` counting per day. */
export function sessionInserts(plan: Plan): SessionInsert[] {
  const perDay = new Map<IsoDate, number>();
  return plan.sessions.map((session) => {
    const order = perDay.get(session.date) ?? 0;
    perDay.set(session.date, order + 1);
    return {
      week_number: session.week,
      phase: phaseToDb(plan.weeks[session.week - 1]),
      session_date: session.date,
      kind: kindToDb(session.kind),
      title: session.title,
      duration_min: Math.round(session.durationMin),
      planned_load: Math.round(session.load * 10) / 10,
      quality_min: Math.round(qualityOf(session)),
      steps: toJson(session.steps),
      reason: joinReason(session.reason, session.strengthNote).slice(0, 1000),
      status: session.status,
      indoor: session.kind === "event" ? null : session.indoor,
      day_order: order,
    };
  });
}
