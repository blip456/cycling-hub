/**
 * The plan intake as data (P69, P80, engine-rules section 3): the questions, the answers a draft holds, the
 * validation of each step and the engine input a draft turns into. Pure: no React, no Supabase.
 */
import { brusselsDate, isIsoDate, type IsoDate, type Weekday } from "@/features/athlete";
import { mondayOnOrAfter, type Intake, type Level, type PlanInput, type Purpose } from "../engine";
import {
  levelAnswersToStored,
  PLAN_LIMITS,
  weeklyHoursSchema,
  weightGoalSchema,
  type RidingEnvironment,
  type TrainingPurpose,
} from "../schemas";
import type { EventDuration } from "../engine";
import type { PlanProfile, WeightGoalRecord } from "./api";

// ---- the questions ------------------------------------------------------------------------------

export type PurposeOption = { value: Purpose; label: string; help: string };

/** The four purposes (P65) with one line of help each (T1.1). */
export const PURPOSE_OPTIONS: readonly PurposeOption[] = [
  { value: "endurance", label: "Endurance", help: "Ride longer and stay strong for hours" },
  { value: "speed", label: "Speed", help: "Short hard efforts, faster average" },
  {
    value: "muscle-building",
    label: "Muscle building",
    help: "Strength work on the bike, with notes for off the bike",
  },
  { value: "weight-loss", label: "Weight loss", help: "Lower weight at a safe weekly pace" },
];

export function purposeLabel(purpose: Purpose): string {
  return PURPOSE_OPTIONS.find((o) => o.value === purpose)?.label ?? purpose;
}

export type LevelQuestion = {
  question: string;
  answers: readonly [string, string, string, string];
};

/** The five level questions L1 to L5 (engine-rules section 3), answers scored 0 to 3 in order. */
export const LEVEL_QUESTIONS: readonly LevelQuestion[] = [
  {
    question: "How long have you been riding regularly?",
    answers: ["Under 1 year", "1 to 2 years", "3 to 5 years", "More than 5 years"],
  },
  {
    question: "How many hours a week did you ride in the last 3 months?",
    answers: ["Under 4 hours", "4 to 7 hours", "8 to 11 hours", "12 hours or more"],
  },
  {
    question: "How often do you train with intervals?",
    answers: ["Never", "Sometimes", "Most weeks", "Every week, by a plan"],
  },
  {
    question: "What is your longest ride in the last 3 months?",
    answers: ["Under 2 hours", "2 to 3.5 hours", "3.5 to 5 hours", "Over 5 hours"],
  },
  {
    question: "How many hard sessions a week can you handle comfortably?",
    answers: ["None", "One", "Two", "Three or more"],
  },
];

export const EVENT_DURATION_OPTIONS: readonly { value: EventDuration; label: string }[] = [
  { value: "under-3h", label: "Under 3 hours" },
  { value: "3-to-6h", label: "3 to 6 hours" },
  { value: "over-6h", label: "Over 6 hours" },
];

export const LEVEL_OPTIONS: readonly { value: Level; label: string }[] = [
  { value: "amateur", label: "Amateur" },
  { value: "committed", label: "Committed" },
  { value: "semi-pro", label: "Semi-pro" },
];

export function levelLabel(level: Level): string {
  return LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? level;
}

// ---- the draft -----------------------------------------------------------------------------------

export type IntakeStep = 1 | 2 | 3 | 4;
export const INTAKE_STEPS: readonly { step: IntakeStep; name: string }[] = [
  { step: 1, name: "Purposes" },
  { step: 2, name: "Level" },
  { step: 3, name: "Time and place" },
  { step: 4, name: "Start and event" },
];

/** What the PO has answered so far. Text fields stay text until they are validated. */
export type IntakeDraft = {
  /** Chosen purposes, most important first (at most two). */
  purposes: Purpose[];
  targetKg: string;
  targetDate: string;
  /** Answers L1 to L5; null while unanswered. */
  answers: (number | null)[];
  hours: string;
  /** Only asked when the profile has none. */
  environment: RidingEnvironment | null;
  startChoice: "next-monday" | "other";
  startDate: string;
  hasEvent: boolean;
  eventName: string;
  eventDate: string;
  eventDuration: EventDuration;
  /** Level picked on the summary instead of the calculated one. */
  levelOverride: Level | null;
};

export const EMPTY_DRAFT: IntakeDraft = {
  purposes: [],
  targetKg: "",
  targetDate: "",
  answers: [null, null, null, null, null],
  hours: "",
  environment: null,
  startChoice: "next-monday",
  startDate: "",
  hasEvent: false,
  eventName: "",
  eventDate: "",
  eventDuration: "3-to-6h",
  levelOverride: null,
};

const FROM_PROFILE: Record<TrainingPurpose, Purpose> = {
  endurance: "endurance",
  speed: "speed",
  muscle_building: "muscle-building",
  weight_loss: "weight-loss",
};

const TO_PROFILE: Record<Purpose, TrainingPurpose> = {
  endurance: "endurance",
  speed: "speed",
  "muscle-building": "muscle_building",
  "weight-loss": "weight_loss",
};

export function purposesFromProfile(list: readonly TrainingPurpose[]): Purpose[] {
  return list.map((p) => FROM_PROFILE[p]);
}

export function purposesToProfile(list: readonly Purpose[]): TrainingPurpose[] {
  return list.map((p) => TO_PROFILE[p]);
}

/** The answers the profile and the active weight goal already hold, so a detour or a refresh loses nothing. */
export function draftFromProfile(
  profile: PlanProfile,
  goal: WeightGoalRecord | null,
  today: IsoDate,
): IntakeDraft {
  const eventInFuture = profile.eventDate !== null && profile.eventDate > today;
  return {
    ...EMPTY_DRAFT,
    purposes: purposesFromProfile(profile.trainingPurposes),
    targetKg: goal ? String(goal.targetKg) : "",
    targetDate: goal && goal.targetDate > today ? goal.targetDate : "",
    answers: profile.levelAnswers ?? [null, null, null, null, null],
    hours: profile.weeklyHours === null ? "" : String(profile.weeklyHours),
    environment: profile.ridingEnvironment,
    hasEvent: eventInFuture,
    eventName: eventInFuture ? (profile.eventName ?? "") : "",
    eventDate: eventInFuture ? (profile.eventDate ?? "") : "",
  };
}

// ---- validation ----------------------------------------------------------------------------------

export type IntakeErrors = Partial<
  Record<
    | "purposes"
    | "targetKg"
    | "targetDate"
    | "answer0"
    | "answer1"
    | "answer2"
    | "answer3"
    | "answer4"
    | "hours"
    | "days"
    | "environment"
    | "startDate"
    | "eventName"
    | "eventDate",
    string
  >
>;

/** What validation needs besides the draft. */
export type IntakeContext = {
  today: IsoDate;
  /** 7-day average weight in kg; null without weigh-ins. */
  weightKg: number | null;
  /** Training days from the profile. */
  availableDays: readonly Weekday[];
  /** Environment of the profile; null when it is not set (the intake asks). */
  profileEnvironment: RidingEnvironment | null;
};

/** "78,4" or "78.4" to a number; empty gives NaN. */
export function parseNumber(text: string): number {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? Number.NaN : Number(clean);
}

/** The Monday the plan starts on for the draft's start choice (the engine rolls a date forward to a Monday). */
export function effectiveStart(draft: IntakeDraft, today: IsoDate): IsoDate {
  if (draft.startChoice === "other" && isIsoDate(draft.startDate))
    return mondayOnOrAfter(draft.startDate);
  return mondayOnOrAfter(today);
}

export function hasWeightLoss(purposes: readonly Purpose[]): boolean {
  return purposes.includes("weight-loss");
}

function stepOne(draft: IntakeDraft, ctx: IntakeContext): IntakeErrors {
  const errors: IntakeErrors = {};
  if (draft.purposes.length === 0) errors.purposes = "Choose at least one purpose.";
  if (hasWeightLoss(draft.purposes)) {
    const hasKg = draft.targetKg.trim() !== "";
    const hasDate = draft.targetDate.trim() !== "";
    if (hasKg || hasDate) {
      const parsed = weightGoalSchema(new Date(`${ctx.today}T12:00:00Z`)).safeParse({
        targetKg: parseNumber(draft.targetKg),
        targetDate: draft.targetDate,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] === "targetDate" ? "targetDate" : "targetKg";
          if (field === "targetDate" && !hasDate)
            errors.targetDate ??= "Add the target date, or clear the target weight.";
          else if (field === "targetKg" && !hasKg)
            errors.targetKg ??= "Add the target weight, or clear the target date.";
          else errors[field] ??= issue.message;
        }
      } else if (ctx.weightKg === null) {
        errors.targetKg = "Log your weight first, so the plan knows where you start.";
      } else if (parsed.data.targetKg >= ctx.weightKg) {
        errors.targetKg = `The target must be below your current weight (${ctx.weightKg.toFixed(1)} kg).`;
      }
    }
  }
  return errors;
}

function stepTwo(draft: IntakeDraft): IntakeErrors {
  const errors: IntakeErrors = {};
  draft.answers.forEach((answer, i) => {
    if (answer === null) errors[`answer${String(i)}` as "answer0"] = "Choose an answer.";
  });
  return errors;
}

function stepThree(draft: IntakeDraft, ctx: IntakeContext): IntakeErrors {
  const errors: IntakeErrors = {};
  const parsed = weeklyHoursSchema.safeParse(parseNumber(draft.hours));
  if (draft.hours.trim() === "") errors.hours = "Enter your hours per week.";
  else if (!parsed.success) errors.hours = parsed.error.issues[0]?.message ?? "Enter the hours.";
  if (ctx.availableDays.length < 2)
    errors.days = "A plan needs at least 2 training days. Add days in your profile.";
  if (ctx.profileEnvironment === null && draft.environment === null)
    errors.environment = "Choose indoor, outdoor or both.";
  return errors;
}

function stepFour(draft: IntakeDraft, ctx: IntakeContext): IntakeErrors {
  const errors: IntakeErrors = {};
  if (draft.startChoice === "other") {
    if (!isIsoDate(draft.startDate)) errors.startDate = "Enter a valid start date.";
    else if (draft.startDate < ctx.today)
      errors.startDate = "The start date is in the past. Pick today or a later date.";
  }
  if (draft.hasEvent) {
    if (draft.eventName.trim().length > PLAN_LIMITS.eventNameMax)
      errors.eventName = `Name can be at most ${String(PLAN_LIMITS.eventNameMax)} characters.`;
    if (!isIsoDate(draft.eventDate)) errors.eventDate = "Enter the event date.";
    else if (draft.eventDate <= ctx.today)
      errors.eventDate = "The date is in the past. Pick a date from tomorrow.";
    else if (errors.startDate === undefined && draft.eventDate < effectiveStart(draft, ctx.today))
      errors.eventDate =
        "The event is before the plan starts. Move the start date or choose a later event date.";
  }
  return errors;
}

/** Errors of one step; an empty object means the step is complete. */
export function validateStep(
  step: IntakeStep,
  draft: IntakeDraft,
  ctx: IntakeContext,
): IntakeErrors {
  switch (step) {
    case 1:
      return stepOne(draft, ctx);
    case 2:
      return stepTwo(draft);
    case 3:
      return stepThree(draft, ctx);
    case 4:
      return stepFour(draft, ctx);
  }
}

/** The first step with an error, or null when every step is complete. */
export function firstInvalidStep(draft: IntakeDraft, ctx: IntakeContext): IntakeStep | null {
  for (const { step } of INTAKE_STEPS) {
    if (Object.keys(validateStep(step, draft, ctx)).length > 0) return step;
  }
  return null;
}

// ---- the engine input ----------------------------------------------------------------------------

export type EngineContext = IntakeContext & {
  ftp: number | null;
  lthr: number | null;
  maxHr: number | null;
};

/** The weight goal of a draft when both fields are filled and valid; null otherwise. */
export function goalOf(draft: IntakeDraft): { targetKg: number; targetDate: IsoDate } | null {
  if (!hasWeightLoss(draft.purposes)) return null;
  const targetKg = parseNumber(draft.targetKg);
  if (Number.isNaN(targetKg) || !isIsoDate(draft.targetDate)) return null;
  return { targetKg, targetDate: draft.targetDate };
}

/** The input of `buildPlan` for a complete draft; null when the draft is not complete. */
export function engineInput(
  draft: IntakeDraft,
  ctx: EngineContext,
  override: Level | null = draft.levelOverride,
): PlanInput | null {
  const levelAnswers = levelAnswersToStored(draft.answers.map((a) => a ?? -1));
  const hours = parseNumber(draft.hours);
  const environment = ctx.profileEnvironment ?? draft.environment;
  if (levelAnswers === null || Number.isNaN(hours) || environment === null) return null;
  const goal = goalOf(draft);
  const intake: Intake = {
    purposes: draft.purposes,
    levelAnswers,
    ...(override ? { levelOverride: override } : {}),
    hoursPerWeek: hours,
    availableDays: ctx.availableDays,
    environment,
    ...(draft.hasEvent && isIsoDate(draft.eventDate)
      ? {
          event: {
            name: draft.eventName.trim() || "Event",
            date: draft.eventDate,
            duration: draft.eventDuration,
          },
        }
      : {}),
    ...(draft.startChoice === "other" && isIsoDate(draft.startDate)
      ? { startDate: draft.startDate }
      : {}),
    ...(hasWeightLoss(draft.purposes) && ctx.weightKg !== null ? { weightKg: ctx.weightKg } : {}),
    ...(goal ? { weightGoal: { targetKg: goal.targetKg, targetDate: goal.targetDate } } : {}),
  };
  return { intake, today: ctx.today, ftp: ctx.ftp, lthr: ctx.lthr, maxHr: ctx.maxHr };
}

/** The profile fields a step saves when the PO moves on (so a refresh or a detour keeps the answers). */
export function profilePatchFor(
  step: IntakeStep,
  draft: IntakeDraft,
  ctx: IntakeContext,
): Partial<Omit<PlanProfile, "availableDays">> {
  switch (step) {
    case 1:
      return { trainingPurposes: purposesToProfile(draft.purposes) };
    case 2:
      return {
        levelAnswers: draft.answers.every((a) => a !== null) ? draft.answers.map(Number) : null,
      };
    case 3: {
      const hours = parseNumber(draft.hours);
      return {
        weeklyHours: Number.isNaN(hours) ? null : hours,
        ...(ctx.profileEnvironment === null && draft.environment !== null
          ? { ridingEnvironment: draft.environment }
          : {}),
      };
    }
    case 4:
      return draft.hasEvent && isIsoDate(draft.eventDate)
        ? { eventName: draft.eventName.trim() || null, eventDate: draft.eventDate }
        : { eventName: null, eventDate: null };
  }
}

/** Today in Brussels for the intake. */
export function intakeToday(): IsoDate {
  return brusselsDate() ?? "";
}
