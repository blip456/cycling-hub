/**
 * Data layer of the Plan pages: Supabase queries and React Query hooks for the plan, its sessions, the plan
 * fields of the profile and the weight goal, plus the pure helpers the screens share. The adaptation UI
 * (changes, missed sessions, matching) builds on these hooks.
 */
export { deletePlan } from "./api";
export type {
  NewPlan,
  PlanProfile,
  PlanProfilePatch,
  SessionChange,
  WeightGoalRecord,
} from "./api";
export { EMPTY_PLAN_PROFILE } from "./api";
export {
  planKeys,
  useActiveWeightGoal,
  useCreatePlan,
  useCurrentWeight,
  usePlan,
  usePlanData,
  usePlanProfile,
  usePlanSession,
  usePlanSessions,
  useReplacePlan,
  useSavePlanProfile,
  useUpdateSessions,
  type CreatePlanVariables,
  type PlanData,
} from "./hooks";
export { assumptionLines } from "./assumptions";
export * from "./edit";
export * from "./intake";
export { kindFromDb, kindToDb } from "./mapping";
export * from "./model";
export { applyPatch, inversePatch } from "./patch";
export type { PlanSession, PlanStatus, SessionPatch, StoredPhase, StoredPlan } from "./types";
export { usePlanActions, type PlanActions } from "./use-plan-actions";
export { currentWeight, type CurrentWeight } from "./weight";
