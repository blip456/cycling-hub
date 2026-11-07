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
import type { Warning } from "../engine";
import type { ChangePayload, PlanChange } from "./changes";
import { buildEvaluateInput, type RunnerInputs } from "./inputs";

/** Columns of the plan row a run may change. */
export type PlanWrite = {
  fingerprint?: string;
  undoneFingerprint?: string | null;
  ftp?: number;
  intake?: Intake | null;
  /** The plan length (4 to 12): an edited event can make the plan shorter or longer. */
  weeks?: number;
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
  | {
      status: "done";
      outcome: EvaluateOutcome;
      view: AdaptationView;
      changeId: string | null;
      /** The stored update of this run (what the "Plan updated" card and its Undo need); null without one. */
      change: PlanChange | null;
    };

/** What an edit would do, without writing anything. */
export type PreviewResult =
  | { status: "no-plan" }
  | { status: "failed"; error: Error }
  | {
      status: "done";
      outcome: EvaluateOutcome;
      /** Sessions that would change (added, removed, moved or recalculated). */
      changed: number;
      /** The engine's warnings for the edited answers. */
      warnings: Warning[];
    };

/** What a run may be told besides the date. */
export type RunOptions = {
  /**
   * The intake the PO just confirmed on the edit page. It is evaluated instead of the stored intake with the
   * profile laid over it; the result is marked as an edit and the intake is stored even when no session changes.
   */
  edit?: Intake;
};

export type UndoResult =
  { status: "done" } | { status: "stale" } | { status: "failed"; error: Error };

/** The plan lengths the database accepts (training_plans.weeks). */
const MIN_WEEKS = 4;
const MAX_WEEKS = 12;

/** Whether two intakes are the same answers; key order does not matter. */
function sameJson(a: Intake | null, b: Intake): boolean {
  const canon = (value: unknown): string =>
    JSON.stringify(value, (_key, v: unknown) =>
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
        : v,
    );
  return a !== null && canon(a) === canon(b);
}

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
  /**
   * Evaluates the plan now (or after the run in progress) and writes what changed. A run with `edit` is never
   * merged with another request: it is queued by itself.
   */
  run: (today: IsoDate, options?: RunOptions) => Promise<RunResult>;
  /** Evaluates an edit like `run` would and returns what it would change, writing nothing. */
  preview: (today: IsoDate, edit: Intake) => Promise<PreviewResult>;
  /** Resolves when everything queued so far has finished (before a plan is deleted). */
  whenIdle: () => Promise<void>;
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

  async function once(today: IsoDate, edit?: Intake): Promise<RunResult> {
    try {
      const inputs = await api.load();
      if (!inputs) return { status: "no-plan" };
      const evaluation = buildEvaluateInput(inputs, today, edit);
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
        // An edit that changes no session still stores the answers it was made with.
        if (
          edit &&
          result.outcome !== "blocked" &&
          !sameJson(inputs.plan.intake, profileInput.intake)
        ) {
          await api.writePlan(inputs.plan.id, { intake: profileInput.intake });
        }
        return { status: "done", outcome: result.outcome, view, changeId: null, change: null };
      }

      const diff = result.diff;
      let skeleton: Plan | null = null;
      const skeletonOf = () => (skeleton ??= buildPlan(profileInput));
      if (diff.insert.length + diff.update.length + diff.delete.length > 0) {
        await api.writeDiff(inputs.plan.id, diff, phaseLookup(inputs, skeletonOf));
      }

      let change: PlanChange | null = null;
      if (result.update) change = await insertChange(inputs, result.update, result);

      const weeks = skeletonOf().weeks.length;
      await api.writePlan(inputs.plan.id, {
        fingerprint: result.fingerprint,
        undoneFingerprint: result.undoneFingerprint,
        ftp: Math.round(profileInput.ftp ?? inputs.plan.ftp),
        intake: profileInput.intake,
        ...(weeks !== inputs.plan.weeks && weeks >= MIN_WEEKS && weeks <= MAX_WEEKS
          ? { weeks }
          : {}),
      });
      return {
        status: "done",
        outcome: result.outcome,
        view,
        changeId: change?.id ?? null,
        change,
      };
    } catch (error) {
      return { status: "failed", error: asError(error) };
    }
  }

  async function insertChange(
    inputs: RunnerInputs,
    update: AdaptationUpdate,
    result: ReturnType<typeof evaluatePlan>,
  ): Promise<PlanChange> {
    const payload: ChangePayload = {
      version: 1,
      message: update.message,
      reasons: update.reasons,
      changes: update.changes,
      fingerprint: result.fingerprint,
      undo: result.undo,
      before: { ftp: inputs.plan.ftp, intake: inputs.plan.intake, weeks: inputs.plan.weeks },
    };
    const id = await api.insertChange({
      planId: inputs.plan.id,
      reason: update.message,
      payload,
    });
    return {
      id,
      planId: inputs.plan.id,
      createdAt: new Date().toISOString(),
      undoneAt: null,
      message: update.message,
      payload,
    };
  }

  async function previewOnce(today: IsoDate, edit: Intake): Promise<PreviewResult> {
    try {
      const inputs = await api.load();
      if (!inputs) return { status: "no-plan" };
      const evaluation = buildEvaluateInput(inputs, today, edit);
      if (!evaluation) return { status: "no-plan" };
      const result = evaluatePlan(evaluation.input);
      return {
        status: "done",
        outcome: result.outcome,
        changed: result.outcome === "recalculated" ? (result.update?.changes.length ?? 0) : 0,
        warnings: result.warnings,
      };
    } catch (error) {
      return { status: "failed", error: asError(error) };
    }
  }

  return {
    run(today, options) {
      const edit = options?.edit;
      if (edit) return enqueue(() => once(today, edit));
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

    whenIdle() {
      return tail.then(() => undefined);
    },

    preview(today, edit) {
      return enqueue(() => previewOnce(today, edit));
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
          // The weeks an edit removed come back with their phase, from the plan as it was built before.
          const before = change.payload.before.intake;
          const skeleton = before
            ? () =>
                buildPlan({
                  intake: { ...before, startDate: inputs.plan.startDate },
                  today: inputs.plan.startDate,
                  ftp: change.payload.before.ftp,
                  lthr: inputs.baseline.lthr,
                  maxHr: inputs.baseline.maxHr,
                })
            : null;
          await api.writeDiff(planId, undo.diff, phaseLookup(inputs, skeleton));
          await api.writePlan(planId, {
            fingerprint: undo.restoreFingerprint ?? inputs.plan.fingerprint,
            ftp: change.payload.before.ftp,
            intake: change.payload.before.intake,
            ...(change.payload.before.weeks !== undefined
              ? { weeks: change.payload.before.weeks }
              : {}),
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
