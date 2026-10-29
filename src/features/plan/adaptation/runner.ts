/**
 * The re-evaluation runner (P59, P61): loads what the plan depends on, calls `evaluatePlan` and writes the
 * result. It knows nothing about React or Supabase: the API is passed in (`RunnerApi`), so the same code runs
 * against the database in the app and against a fake in the tests.
 *
 * Stability:
 * - One run at a time. A request while a run executes waits for it and runs once more afterwards (the inputs
 *   may have changed meanwhile); requests that pile up behind it share that one run.
 * - Nothing is written when the outcome is "unchanged" or "pinned" (apart from a status that changed).
 * - It never throws: a failure is returned as `{ status: "failed" }` and the caller retries later.
 *
 * Order of writes. There is no transaction, so the writes go in the order that survives a failure at any
 * point: the status and match updates, then the session changes of the diff, then the `plan_changes` record,
 * and the new fingerprint last. The fingerprint is what makes a state "done": while it is old, the next run
 * evaluates again from what was stored and finishes what is left (a statuses-only or half-applied diff gives
 * a smaller diff the second time; nothing is applied twice). An Undo goes pin first (`undone_fingerprint`),
 * then the inverse diff, then the fingerprint, then `undone_at`: a failure after the pin cannot flip the
 * plan back to the update, and a failure before it leaves the update in place with Undo still on offer.
 */
import { buildPlan, type Intake, type Plan } from "../engine";
import type { IsoDate } from "@/features/athlete";
import type {
  AdaptationUpdate,
  EvaluateOutcome,
  NoPowerWarning,
  PlanDiff,
  StatusUpdate,
  WeightState,
} from "../adapt";
import { evaluatePlan } from "../adapt";
import { phaseToDb } from "../data/mapping";
import type { StoredPhase } from "../data/types";
import type { ChangePayload, PlanChange } from "./changes";
import { buildEvaluateInput, type RunnerInputs } from "./inputs";

/** Columns of the plan row a run may change. */
export type PlanWrite = {
  fingerprint?: string;
  undoneFingerprint?: string | null;
  ftp?: number;
  intake?: Intake | null;
};

export type NewChange = { planId: string; reason: string; payload: ChangePayload };

export type RunnerApi = {
  /** Everything one evaluation reads; null when there is no active plan. */
  load: () => Promise<RunnerInputs | null>;
  writeStatuses: (updates: readonly StatusUpdate[]) => Promise<void>;
  /** Applies a diff to the sessions of a plan (rows keep their ids; deletes without id go by date). */
  writeDiff: (
    planId: string,
    diff: PlanDiff,
    phaseOfWeek: (week: number) => StoredPhase,
  ) => Promise<void>;
  insertChange: (change: NewChange) => Promise<string>;
  writePlan: (planId: string, write: PlanWrite) => Promise<void>;
  markUndone: (changeId: string, at: string) => Promise<void>;
};

/** What the screens show next to the plan: not stored, recomputed at every run. */
export type AdaptationView = {
  today: IsoDate;
  outcome: EvaluateOutcome;
  noPower: NoPowerWarning | null;
  weight: WeightState | null;
  inactivity: { days: number; message: string } | null;
  /** Rides that fit no session. */
  extraRides: number;
  /** Ride id to the session id it counts for, after matching. */
  matches: Record<string, string>;
};

export type RunResult =
  | { status: "no-plan" }
  | { status: "failed"; error: Error }
  | { status: "done"; outcome: EvaluateOutcome; view: AdaptationView; changeId: string | null };

export type UndoResult =
  { status: "done" } | { status: "stale" } | { status: "failed"; error: Error };

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown error");
}

/** The phase column of a week: from a session already in that week, else from the engine's calendar of the plan. */
function phaseLookup(inputs: RunnerInputs, skeleton: (() => Plan) | null) {
  return (week: number): StoredPhase => {
    const sibling = inputs.sessions.find((s) => s.week === week);
    if (sibling) return sibling.phase;
    return skeleton ? phaseToDb(skeleton().weeks[week - 1]) : "base";
  };
}

export type Runner = {
  /** Evaluates the plan now (or after the run in progress) and writes what changed. */
  run: (today: IsoDate) => Promise<RunResult>;
  /** Takes an update back. Only the latest update of the current plan can be undone. */
  undo: (change: PlanChange, now?: Date) => Promise<UndoResult>;
};

export function createRunner(api: RunnerApi): Runner {
  let tail: Promise<unknown> = Promise.resolve();
  let waiting: { today: IsoDate; promise: Promise<RunResult> } | null = null;

  /** Queues `task` behind everything before it; a failure of an earlier task does not stop it. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task, task);
    tail = next.catch(() => undefined);
    return next;
  }

  async function once(today: IsoDate): Promise<RunResult> {
    try {
      const inputs = await api.load();
      if (!inputs) return { status: "no-plan" };
      const evaluation = buildEvaluateInput(inputs, today);
      if (!evaluation) return { status: "no-plan" };
      const { input, profileInput } = evaluation;
      const result = evaluatePlan(input);
      const view: AdaptationView = {
        today,
        outcome: result.outcome,
        noPower: result.noPower,
        weight: result.weight,
        inactivity: result.inactivity,
        extraRides: result.extraRides.length,
        matches: Object.fromEntries(result.matches.map((m) => [m.rideId, m.sessionId])),
      };

      if (result.statusUpdates.length > 0) await api.writeStatuses(result.statusUpdates);
      if (result.outcome !== "recalculated") {
        return { status: "done", outcome: result.outcome, view, changeId: null };
      }

      const diff = result.diff;
      if (diff.insert.length + diff.update.length + diff.delete.length > 0) {
        let skeleton: Plan | null = null;
        await api.writeDiff(
          inputs.plan.id,
          diff,
          phaseLookup(inputs, () => (skeleton ??= buildPlan(profileInput))),
        );
      }

      let changeId: string | null = null;
      if (result.update) changeId = await insertChange(inputs, result.update, result);

      await api.writePlan(inputs.plan.id, {
        fingerprint: result.fingerprint,
        undoneFingerprint: result.undoneFingerprint,
        ftp: Math.round(profileInput.ftp ?? inputs.plan.ftp),
        intake: profileInput.intake,
      });
      return { status: "done", outcome: result.outcome, view, changeId };
    } catch (error) {
      return { status: "failed", error: asError(error) };
    }
  }

  async function insertChange(
    inputs: RunnerInputs,
    update: AdaptationUpdate,
    result: ReturnType<typeof evaluatePlan>,
  ): Promise<string> {
    return api.insertChange({
      planId: inputs.plan.id,
      reason: update.message,
      payload: {
        version: 1,
        message: update.message,
        reasons: update.reasons,
        changes: update.changes,
        fingerprint: result.fingerprint,
        undo: result.undo,
        before: { ftp: inputs.plan.ftp, intake: inputs.plan.intake },
      },
    });
  }

  return {
    run(today) {
      if (waiting) return waiting.promise;
      const slot: { today: IsoDate; promise: Promise<RunResult> } = {
        today,
        promise: enqueue(async () => {
          // From here on a new request starts the next run instead of joining this one.
          if (waiting === slot) waiting = null;
          return once(today);
        }),
      };
      waiting = slot;
      return slot.promise;
    },

    undo(change, now = new Date()) {
      return enqueue(async (): Promise<UndoResult> => {
        try {
          const inputs = await api.load();
          const undo = change.payload.undo;
          if (
            !inputs ||
            undo === null ||
            change.undoneAt !== null ||
            inputs.plan.id !== change.planId ||
            inputs.plan.fingerprint !== change.payload.fingerprint
          ) {
            return { status: "stale" };
          }
          const planId = inputs.plan.id;
          await api.writePlan(planId, { undoneFingerprint: undo.undoneFingerprint });
          await api.writeDiff(planId, undo.diff, phaseLookup(inputs, null));
          await api.writePlan(planId, {
            fingerprint: undo.restoreFingerprint ?? inputs.plan.fingerprint,
            ftp: change.payload.before.ftp,
            intake: change.payload.before.intake,
          });
          await api.markUndone(change.id, now.toISOString());
          return { status: "done" };
        } catch (error) {
          return { status: "failed", error: asError(error) };
        }
      });
    },
  };
}
