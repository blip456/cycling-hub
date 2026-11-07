import { z } from "zod";
import { brusselsDate, isIsoDate, LIMITS as ATHLETE_LIMITS } from "@/features/athlete";

/**
 * Zod schemas for what the training plan adds to the profile (P60, P62, P65, P66) and for the weight goal
 * (P73). Limits follow docs/wireframes/V3/adapt.html (R1, R2) and docs/plan/engine-rules.md (sections 3
 * and 9); the database constraints use the same numbers. Like the athlete schemas, every profile field is
 * optional and nothing blocks the app: an empty value is stored as null. Output keys are camelCase; the
 * database columns are `riding_environment`, `weekly_hours`, `training_purposes`, `level_answers`,
 * `event_name` and `event_date`.
 */

export const PLAN_LIMITS = {
  /** Average hours per week, in half hours (R1). */
  weeklyHours: { min: 1, max: 25, step: 0.5 },
  eventNameMax: 60,
  /** Main and secondary purpose only (P75). */
  purposesMax: 2,
  /** Level questions L1 to L5, each answered 0 to 3 (engine-rules section 3). */
  levelQuestions: 5,
  levelAnswer: { min: 0, max: 3 },
  weight: ATHLETE_LIMITS.weight,
  /** Weekly weight loss cap in percent of the start weight: default 0.5, at most 0.75 (P73). */
  weeklyRateCap: { default: 0.5, max: 0.75 },
} as const;

export const RIDING_ENVIRONMENTS = ["indoor", "outdoor", "both"] as const;
export type RidingEnvironment = (typeof RIDING_ENVIRONMENTS)[number];

export const TRAINING_PURPOSES = ["muscle_building", "weight_loss", "endurance", "speed"] as const;
export type TrainingPurpose = (typeof TRAINING_PURPOSES)[number];

/** Where you ride: indoor, outdoor or both (P62). */
export const ridingEnvironmentSchema = z.enum(
  RIDING_ENVIRONMENTS,
  "Choose indoor, outdoor or both.",
);

/** Average hours per week: 1 to 25, in half hours (R1). */
export const weeklyHoursSchema = z
  .number("Enter the hours as a number.")
  .min(PLAN_LIMITS.weeklyHours.min, `Hours must be at least ${PLAN_LIMITS.weeklyHours.min}.`)
  .max(PLAN_LIMITS.weeklyHours.max, `Hours can be at most ${PLAN_LIMITS.weeklyHours.max}.`)
  .refine((hours) => Number.isInteger(hours * 2), "Use whole or half hours.");

/** Training purposes in rank order: the first is the main purpose, the second is optional (P75). No duplicates. */
export const trainingPurposesSchema = z
  .array(z.enum(TRAINING_PURPOSES, "Choose one of the four purposes."))
  .max(PLAN_LIMITS.purposesMax, `Choose at most ${PLAN_LIMITS.purposesMax} purposes.`)
  .refine((list) => new Set(list).size === list.length, "Each purpose can only be chosen once.");

/** The five level answers L1 to L5, each a whole number from 0 to 3, in question order. */
export const levelAnswersSchema = z
  .array(
    z
      .number("Answer every question.")
      .int("Answer every question.")
      .min(PLAN_LIMITS.levelAnswer.min, "Answer every question.")
      .max(PLAN_LIMITS.levelAnswer.max, "Answer every question."),
  )
  .length(PLAN_LIMITS.levelQuestions, "Answer all five questions.");

/** The stored shape of the level answers (profiles.level_answers) and the engine's input: named, in question order L1 to L5. */
export const LEVEL_ANSWER_KEYS = [
  "experience",
  "weeklyHours",
  "intervals",
  "longestRide",
  "hardSessions",
] as const;

export type StoredLevelAnswers = Record<(typeof LEVEL_ANSWER_KEYS)[number], 0 | 1 | 2 | 3>;

/** Form answers in question order to the named object that is stored and given to the engine. */
export function levelAnswersToStored(answers: readonly number[]): StoredLevelAnswers | null {
  const parsed = levelAnswersSchema.safeParse(answers);
  if (!parsed.success) return null;
  const [experience, weeklyHours, intervals, longestRide, hardSessions] = parsed.data as [
    0 | 1 | 2 | 3,
    0 | 1 | 2 | 3,
    0 | 1 | 2 | 3,
    0 | 1 | 2 | 3,
    0 | 1 | 2 | 3,
  ];
  return { experience, weeklyHours, intervals, longestRide, hardSessions };
}

/** The stored object back to form answers in question order; null when it is missing or incomplete. */
export function levelAnswersFromStored(stored: unknown): number[] | null {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return null;
  const record = stored as Record<string, unknown>;
  const answers = LEVEL_ANSWER_KEYS.map((key) => record[key]);
  const parsed = levelAnswersSchema.safeParse(answers);
  return parsed.success ? parsed.data : null;
}

/** A Brussels calendar date strictly after `today`, as `YYYY-MM-DD`. */
function futureDate(now: Date, message: string) {
  const today = brusselsDate(now);
  return z
    .string()
    .refine(isIsoDate, "Enter a valid date.")
    .refine((date) => today === null || date > today, message);
}

/**
 * The plan fields of the profile. `eventName` (max 60 characters, trimmed) and `eventDate` (from tomorrow)
 * go together: both or neither (R1, P77). Pass `now` in tests; the date limit is read when the schema is
 * created, so create it per use.
 */
export function planProfileSchema(now: Date = new Date()) {
  return z
    .object({
      ridingEnvironment: ridingEnvironmentSchema.nullable().default(null),
      weeklyHours: weeklyHoursSchema.nullable().default(null),
      trainingPurposes: trainingPurposesSchema.default([]),
      levelAnswers: levelAnswersSchema.nullable().default(null),
      eventName: z
        .string()
        .trim()
        .max(
          PLAN_LIMITS.eventNameMax,
          `Name can be at most ${PLAN_LIMITS.eventNameMax} characters.`,
        )
        .transform((v) => (v === "" ? null : v))
        .nullable()
        .default(null),
      eventDate: futureDate(now, "The date is in the past. Pick a date from tomorrow.")
        .nullable()
        .default(null),
    })
    .superRefine((value, ctx) => {
      if (value.eventName !== null && value.eventDate === null)
        ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Add the event date." });
      if (value.eventDate !== null && value.eventName === null)
        ctx.addIssue({ code: "custom", path: ["eventName"], message: "Add the event name." });
    });
}

export type PlanProfileValues = z.output<ReturnType<typeof planProfileSchema>>;

/** Target weight in kg, 30 to 250 (same as a weight entry); decimals allowed. */
export const targetWeightSchema = z
  .number("Enter your target weight as a number.")
  .min(PLAN_LIMITS.weight.min, `Weight must be at least ${PLAN_LIMITS.weight.min} kg.`)
  .max(PLAN_LIMITS.weight.max, `Weight can be at most ${PLAN_LIMITS.weight.max} kg.`);

/**
 * The weight goal (R2a, P73): a target weight and a target date from tomorrow. Whether the date is too
 * soon for the weekly-rate cap depends on the current weight, so the engine checks that, not this schema.
 */
export function weightGoalSchema(now: Date = new Date()) {
  return z.object({
    targetKg: targetWeightSchema,
    targetDate: futureDate(now, "The date is in the past. Pick a date from tomorrow."),
  });
}

export type WeightGoalValues = z.output<ReturnType<typeof weightGoalSchema>>;

/** The weekly weight-loss cap setting in percent of body weight: above 0 and at most 0.75 (P73). */
export const weeklyRateCapSchema = z
  .number("Enter the cap as a number.")
  .gt(0, "The cap must be above 0 %.")
  .max(
    PLAN_LIMITS.weeklyRateCap.max,
    `The cap can be at most ${PLAN_LIMITS.weeklyRateCap.max} % a week.`,
  );
