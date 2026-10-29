/**
 * What the re-evaluation reads, as the data layer holds it, and the `EvaluateInput` built from it. Pure.
 *
 * The plan is evaluated against the inputs as they are now: the profile (days, hours, purposes, level,
 * event, environment), the active weight goal and the baseline. The stored plan only keeps what it was
 * built from (`training_plans.intake` and `ftp_w`), which is what a change is compared with to name its
 * reason ("new FTP", "days changed").
 */
import type { IsoDate, WeightEntry } from "@/features/athlete";
import type { Ride } from "@/features/rides/api";
import type { EvaluateInput } from "../adapt";
import type { Intake, PlanInput } from "../engine";
import { purposesFromProfile } from "../data/intake";
import type { PlanProfile, WeightGoalRecord } from "../data/api";
import type { PlanSession, StoredPlan } from "../data/types";
import { levelAnswersToStored } from "../schemas";
import { toAdaptRide, toStoredSessions } from "./stored";

/** The baseline values the plan uses. */
export type BaselineValues = { ftp: number | null; lthr: number | null; maxHr: number | null };

/** Everything one evaluation reads. */
export type RunnerInputs = {
  plan: StoredPlan;
  sessions: PlanSession[];
  rides: Ride[];
  weights: WeightEntry[];
  baseline: BaselineValues;
  profile: PlanProfile;
  goal: WeightGoalRecord | null;
};

/** True when the profile holds the plan fields; an empty profile leaves the plan's own intake as it is. */
function profileHasPlanFields(profile: PlanProfile): boolean {
  return profile.trainingPurposes.length > 0 && profile.weeklyHours !== null;
}

/**
 * The intake as it is now: the stored intake with the profile's answers laid over it. The start date, the
 * level override, the recovery rhythm and the FTP test choice stay as the plan was built with.
 */
export function currentIntake(
  stored: Intake,
  profile: PlanProfile,
  goal: WeightGoalRecord | null,
): Intake {
  if (!profileHasPlanFields(profile)) return stored;
  const levelAnswers =
    profile.levelAnswers === null ? null : levelAnswersToStored(profile.levelAnswers);
  const purposes = purposesFromProfile(profile.trainingPurposes);
  const { weightGoal: _goal, weightKg: _kg, event: _event, ...rest } = stored;
  const weightLoss = purposes.slice(0, 2).includes("weight-loss");
  const startKg = stored.weightKg ?? goal?.startKg;
  return {
    ...rest,
    purposes,
    levelAnswers: levelAnswers ?? stored.levelAnswers,
    hoursPerWeek: profile.weeklyHours ?? stored.hoursPerWeek,
    availableDays: profile.availableDays.length >= 2 ? profile.availableDays : stored.availableDays,
    environment: profile.ridingEnvironment ?? stored.environment,
    ...(profile.eventDate !== null
      ? {
          event: {
            name: profile.eventName ?? stored.event?.name ?? "Event",
            date: profile.eventDate,
            ...(stored.event?.duration ? { duration: stored.event.duration } : {}),
          },
        }
      : {}),
    ...(weightLoss && startKg !== undefined ? { weightKg: startKg } : {}),
    ...(weightLoss && goal
      ? { weightGoal: { targetKg: goal.targetKg, targetDate: goal.targetDate } }
      : {}),
  };
}

export type Evaluation = {
  input: EvaluateInput;
  /** The engine input the evaluation builds from (for the phases of new weeks). */
  profileInput: PlanInput;
};

/** The input of `evaluatePlan`; null when the stored plan has no readable intake. */
export function buildEvaluateInput(inputs: RunnerInputs, today: IsoDate): Evaluation | null {
  const { plan, profile, goal, baseline } = inputs;
  if (!plan.intake) return null;
  const intake = currentIntake(plan.intake, profile, goal);
  const profileInput: PlanInput = {
    intake: { ...intake, startDate: plan.startDate },
    today,
    ftp: baseline.ftp ?? plan.ftp,
    lthr: baseline.lthr,
    maxHr: baseline.maxHr,
  };
  return {
    profileInput,
    input: {
      plan: { startDate: plan.startDate, previous: { ftp: plan.ftp, intake: plan.intake } },
      sessions: toStoredSessions(inputs.sessions, plan.intake),
      rides: inputs.rides.map(toAdaptRide),
      weightEntries: inputs.weights,
      profileInput,
      today,
      lastFingerprint: plan.fingerprint,
      undoneFingerprint: plan.undoneFingerprint,
    },
  };
}
