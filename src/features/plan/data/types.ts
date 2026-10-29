import type { IsoDate } from "@/features/athlete";
import type { Intake, SessionKind, SessionStatus, Step } from "../engine";

/** Plan status in the database (training_plans.status). */
export type PlanStatus = "active" | "replaced" | "completed" | "cancelled";

/** Phase column of a planned session: the engine's phase, with recovery weeks as their own phase. */
export type StoredPhase = "base" | "build" | "peak" | "recovery" | "taper";

/** A training plan row in the shape the screens use. */
export type StoredPlan = {
  id: string;
  startDate: IsoDate;
  /** Number of weeks (4 to 12). */
  weeks: number;
  status: PlanStatus;
  /** The intake the plan was built from; null when the stored JSON cannot be read. */
  intake: Intake | null;
  ftp: number;
  weightKg: number | null;
  engineVersion: string;
  fingerprint: string;
  undoneFingerprint: string | null;
  createdAt: string;
};

/** A planned session row in the shape the screens use (`kind` is the engine's SessionKind). */
export type PlanSession = {
  id: string;
  planId: string;
  date: IsoDate;
  /** 1-based. */
  week: number;
  phase: StoredPhase;
  kind: SessionKind;
  title: string;
  durationMin: number;
  load: number;
  qualityMin: number;
  steps: Step[];
  reason: string;
  /** Off-bike strength note of that day (muscle building); null if none. */
  strengthNote: string | null;
  status: SessionStatus;
  /** Null follows the plan's environment (the profile). */
  indoor: boolean | null;
  activityId: string | null;
  matchSource: "auto" | "manual" | null;
  movedFrom: IsoDate | null;
  dayOrder: number;
};

/** What changes when the PO marks, skips or moves a session or switches indoor and outdoor. */
export type SessionPatch = {
  status?: SessionStatus;
  date?: IsoDate;
  movedFrom?: IsoDate | null;
  indoor?: boolean | null;
};
