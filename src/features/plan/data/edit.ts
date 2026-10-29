/**
 * Editing a plan as data (P81): what saving the intake again writes, and what it changes in plain words.
 * Pure: no React, no Supabase. The page builds the draft with `draftFromIntake`, validates it with the same
 * rules as the intake (with `fixedStart` set) and asks `editSave` what to write.
 */
import type { IsoDate } from "@/features/athlete";
import { scoreLevel, type Intake, type PlanInput } from "../engine";
import type { PlanProfile, PlanProfilePatch, WeightGoalRecord } from "./api";
import {
  engineInput,
  goalOf,
  hasWeightLoss,
  levelLabel,
  profilePatchFor,
  purposeLabel,
  type EngineContext,
  type IntakeDraft,
} from "./intake";
import { formatLongDate } from "./model";

/** A weight goal to write: an object sets it, null cancels the active one, undefined leaves the goals alone. */
export type GoalWrite =
  { targetKg: number; targetDate: IsoDate; startKg: number } | null | undefined;

export type EditSave = {
  /** The engine input the edit is evaluated with (the plan's start date, the answers, the baseline). */
  input: PlanInput;
  /** What goes to the profile (the same fields the intake saves). */
  profilePatch: PlanProfilePatch;
  goal: GoalWrite;
  /** What puts the profile and the goal back, for Undo. */
  restore: { profilePatch: PlanProfilePatch; goal: GoalWrite };
};

/** The answers as they are now: the stored intake with the profile and the active goal laid over it. */
export type EditCurrent = { intake: Intake; profile: PlanProfile; goal: WeightGoalRecord | null };

function sameGoal(
  a: { targetKg: number; targetDate: IsoDate } | null,
  b: { targetKg: number; targetDate: IsoDate } | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.targetKg === b.targetKg && a.targetDate === b.targetDate;
}

/**
 * What saving a complete, valid draft writes; null when the draft is not complete. The start weight of the
 * plan stays as it was unless the weight target changes (a new target starts from today's weight).
 */
export function editSave(
  draft: IntakeDraft,
  ctx: EngineContext,
  current: EditCurrent,
): EditSave | null {
  const built = engineInput(draft, ctx);
  if (!built) return null;
  const goal = hasWeightLoss(draft.purposes) ? goalOf(draft) : null;
  const active = current.goal
    ? { targetKg: current.goal.targetKg, targetDate: current.goal.targetDate }
    : null;
  const goalChanged = hasWeightLoss(draft.purposes) && !sameGoal(goal, active);

  // The intake: the start weight is kept while the target stays.
  const { weightKg: _weight, ...rest } = built.intake;
  const keepKg =
    hasWeightLoss(draft.purposes) && !goalChanged ? current.intake.weightKg : built.intake.weightKg;
  const input: PlanInput = {
    ...built,
    intake: { ...rest, ...(keepKg !== undefined ? { weightKg: keepKg } : {}) },
  };

  const profilePatch: PlanProfilePatch = {
    ...profilePatchFor(1, draft, ctx),
    ...profilePatchFor(2, draft, ctx),
    ...profilePatchFor(3, draft, ctx),
    ...profilePatchFor(4, draft, ctx),
  };
  const { profile } = current;
  const old: PlanProfilePatch = {
    trainingPurposes: profile.trainingPurposes,
    levelAnswers: profile.levelAnswers,
    weeklyHours: profile.weeklyHours,
    eventName: profile.eventName,
    eventDate: profile.eventDate,
    ...(profilePatch.ridingEnvironment !== undefined
      ? { ridingEnvironment: profile.ridingEnvironment }
      : {}),
  };

  let write: GoalWrite;
  if (!goalChanged) write = undefined;
  else if (goal !== null && ctx.weightKg !== null) write = { ...goal, startKg: ctx.weightKg };
  else write = active === null ? undefined : null;

  const back: GoalWrite =
    write === undefined
      ? undefined
      : current.goal
        ? {
            targetKg: current.goal.targetKg,
            targetDate: current.goal.targetDate,
            startKg: current.goal.startKg,
          }
        : null;
  return { input, profilePatch, goal: write, restore: { profilePatch: old, goal: back } };
}

// ---- plain words ---------------------------------------------------------------------------------

const DAY_NAMES: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const ENVIRONMENT_TEXT = { indoor: "indoor", outdoor: "outdoor", both: "both indoor and outdoor" };

function purposesText(intake: Intake): string {
  return intake.purposes.length === 0
    ? "none"
    : intake.purposes.map((p, i) => `${String(i + 1)} ${purposeLabel(p)}`).join(", ");
}

function daysText(intake: Intake): string {
  return ALL_DAYS.filter((d) => intake.availableDays.includes(d))
    .map((d) => DAY_NAMES[d] ?? d)
    .join(", ");
}

function goalText(intake: Intake): string {
  const goal = intake.weightGoal;
  return goal ? `${goal.targetKg.toFixed(1)} kg by ${formatLongDate(goal.targetDate)}` : "none";
}

function eventText(intake: Intake): string {
  const event = intake.event;
  return event ? `${event.name}, ${formatLongDate(event.date)}` : "none";
}

const DURATION_TEXT = {
  "under-3h": "under 3 hours",
  "3-to-6h": "3 to 6 hours",
  "over-6h": "over 6 hours",
};

/**
 * The answers that differ between two intakes, one plain sentence each, in the order of the questions.
 * Empty when nothing differs.
 */
export function describeEdit(before: Intake, after: Intake): string[] {
  const lines: string[] = [];
  const same = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

  if (!same(before.purposes.slice(0, 2), after.purposes.slice(0, 2)))
    lines.push(`Purposes change from ${purposesText(before)} to ${purposesText(after)}.`);
  if (!same(before.weightGoal ?? null, after.weightGoal ?? null)) {
    if (!before.weightGoal) lines.push(`A weight target is added: ${goalText(after)}.`);
    else if (!after.weightGoal) lines.push("The weight target is removed.");
    else lines.push(`The weight target changes from ${goalText(before)} to ${goalText(after)}.`);
  }
  const levelBefore = scoreLevel(
    before.levelAnswers,
    before.hoursPerWeek,
    before.levelOverride,
  ).level;
  const levelAfter = scoreLevel(after.levelAnswers, after.hoursPerWeek, after.levelOverride).level;
  if (levelBefore !== levelAfter)
    lines.push(`Level changes from ${levelLabel(levelBefore)} to ${levelLabel(levelAfter)}.`);
  else if (!same(before.levelAnswers, after.levelAnswers))
    lines.push("Your level answers change. The level stays the same.");
  if (before.hoursPerWeek !== after.hoursPerWeek)
    lines.push(
      `Hours per week change from ${String(before.hoursPerWeek)} to ${String(after.hoursPerWeek)}.`,
    );
  if (daysText(before) !== daysText(after))
    lines.push(`Training days change from ${daysText(before)} to ${daysText(after)}.`);
  if (before.environment !== after.environment)
    lines.push(
      `Indoor or outdoor changes from ${ENVIRONMENT_TEXT[before.environment]} to ${ENVIRONMENT_TEXT[after.environment]}.`,
    );
  if (!before.event && after.event) lines.push(`An event is added: ${eventText(after)}.`);
  else if (before.event && !after.event) lines.push(`The event is removed: ${eventText(before)}.`);
  else if (before.event && after.event) {
    if (before.event.date !== after.event.date || before.event.name !== after.event.name)
      lines.push(`The event changes from ${eventText(before)} to ${eventText(after)}.`);
    if ((before.event.duration ?? "3-to-6h") !== (after.event.duration ?? "3-to-6h"))
      lines.push(
        `The expected event duration changes to ${DURATION_TEXT[after.event.duration ?? "3-to-6h"]}.`,
      );
  }
  if (before.levelOverride !== after.levelOverride && levelBefore === levelAfter)
    lines.push(
      after.levelOverride
        ? `You choose the level yourself: ${levelLabel(after.levelOverride)}.`
        : "The level is calculated from your answers again.",
    );
  return lines;
}
