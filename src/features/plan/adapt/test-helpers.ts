/** Helpers for the adaptation tests: stored sessions from a plan, rides, and a one-step "apply" of a result. */
import type { IsoDate } from "@/features/athlete";
import { buildPlan, inputFingerprint, type Plan, type PlanInput } from "../engine";
import { evaluatePlan, type EvaluateInput, type EvaluateResult } from "./evaluate";
import { applyDiff } from "./merge";
import { applyStatuses } from "./status";
import type { AdaptRide, StoredSession } from "./types";

/** The plan's sessions as stored rows: ids from the date, no matches. */
export function storeSessions(plan: Plan): StoredSession[] {
  return plan.sessions.map((s) => ({
    ...s,
    id: `s-${s.date}`,
    activityId: null,
    matchSource: null,
    movedFrom: null,
  }));
}

let counter = 0;

/** A ride with sensible defaults. */
export function ride(
  date: IsoDate,
  movingMinutes: number,
  extra: Partial<AdaptRide> = {},
): AdaptRide {
  counter += 1;
  return { id: `r${counter}-${date}`, date, movingMinutes, avgPowerW: 150, ...extra };
}

/**
 * History of a plan up to (not including) `before`: a ride for every session, linked and done; `skip` dates
 * were not ridden (those sessions stay planned, so the next evaluation marks them missed).
 */
export function withHistory(
  stored: Stored,
  before: IsoDate,
  skip: readonly IsoDate[] = [],
): { stored: Stored; rides: AdaptRide[] } {
  const rides: AdaptRide[] = [];
  const sessions = stored.sessions.map((s): StoredSession => {
    if (s.date >= before || skip.includes(s.date) || s.kind === "event") return s;
    const r: AdaptRide = {
      id: `h-${s.date}`,
      date: s.date,
      movingMinutes: s.durationMin,
      avgPowerW: 180,
    };
    rides.push(r);
    return { ...s, status: "done", activityId: r.id, matchSource: "auto" };
  });
  return { stored: { ...stored, sessions }, rides };
}

/** State the data layer holds between evaluations. */
export type Stored = {
  sessions: StoredSession[];
  fingerprint: string | null;
  undone: string | null;
};

/** The state right after the plan was created from `input`. */
export function initialState(input: PlanInput): { plan: Plan; stored: Stored } {
  const plan = buildPlan(input);
  return {
    plan,
    stored: { sessions: storeSessions(plan), fingerprint: null, undone: null },
  };
}

/** Applies a result like the data layer would: statuses, the diff, the fingerprints. */
export function applyResult(stored: Stored, result: EvaluateResult): Stored {
  const sessions = applyDiff(applyStatuses(stored.sessions, result.statusUpdates), result.diff);
  return {
    sessions,
    fingerprint: result.outcome === "recalculated" ? result.fingerprint : stored.fingerprint,
    undone: result.undoneFingerprint,
  };
}

/** One evaluation of a stored state, and the state after applying it. */
export function evaluateOnce(
  plan: Plan,
  input: PlanInput,
  stored: Stored,
  rest: Pick<EvaluateInput, "rides" | "weightEntries" | "today"> & {
    previous?: EvaluateInput["plan"]["previous"];
  },
): { result: EvaluateResult; next: Stored } {
  const result = evaluatePlan({
    plan: { startDate: plan.startDate, ...(rest.previous ? { previous: rest.previous } : {}) },
    sessions: stored.sessions,
    rides: rest.rides,
    weightEntries: rest.weightEntries,
    profileInput: input,
    today: rest.today,
    lastFingerprint: stored.fingerprint,
    undoneFingerprint: stored.undone,
  });
  return { result, next: applyResult(stored, result) };
}

/** Engine fingerprint of an input (re-exported for tests). */
export { inputFingerprint };

/** A one-step session for matching tests: `percent` is the time-weighted target in percent of FTP. */
export function session(
  date: IsoDate,
  kind: StoredSession["kind"],
  minutes: number,
  extra: Partial<StoredSession> & { percent?: number } = {},
): StoredSession {
  const { percent = 65, ...rest } = extra;
  return {
    id: `x-${date}-${kind}`,
    date,
    week: 1,
    slot: kind === "long" ? "long" : "easy",
    kind,
    title: kind,
    durationMin: minutes,
    steps: [
      {
        kind: "easy",
        label: kind,
        durationSec: minutes * 60,
        durationMin: minutes,
        target: {
          percentFtp: percent,
          minPercent: percent,
          maxPercent: percent,
          watts: { target: null, min: null, max: null },
          powerZone: null,
          exact: false,
        },
        heartRate: null,
        powerLeads: false,
        cadence: null,
      },
    ],
    reason: "",
    indoor: false,
    status: "planned",
    load: 0,
    mainSet: null,
    ladderStep: null,
    strengthNote: null,
    activityId: null,
    matchSource: null,
    movedFrom: null,
    ...rest,
  };
}
