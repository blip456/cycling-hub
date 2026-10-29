/** Public API of the plan adaptation: pure, deterministic, UI-free and Supabase-free. */
export { evaluatePlan } from "./evaluate";
export type {
  AdaptationUpdate,
  EvaluateInput,
  EvaluateOutcome,
  EvaluateResult,
  PreviousInputs,
} from "./evaluate";
export { INACTIVE_DAYS, OVERLOAD_FACTOR } from "./evaluate";
export { isIgnoredRide, matchRides, plannedPercentFtp } from "./match";
export { applyStatuses, markStatuses } from "./status";
export { noPowerWarning, NO_POWER_MIN_SESSIONS, NO_POWER_WINDOW_DAYS } from "./no-power";
export type { NoPowerWarning } from "./no-power";
export {
  applyDiff,
  describeChange,
  diffStored,
  invertDiff,
  isEmptyDiff,
  isFrozen,
  mergePlan,
  sameSession,
  sessionData,
} from "./merge";
export { rampBackCaps, rebuildFuture } from "./rebuild";
export { weightState, STALLED_NO_ROOM_NOTICE } from "./weight-state";
export type { WeightCheck, WeightState, WeightStateGoal, WeightStateKind } from "./weight-state";
export type * from "./types";
