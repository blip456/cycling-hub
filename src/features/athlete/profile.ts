import { z } from "zod";
import { brusselsDate, WEEKDAYS, type Weekday } from "./dates";

/**
 * Zod schemas for the athlete profile (P44) and the baseline values (FTP, max HR, LTHR). The limits are
 * the same as the database constraints. Every profile field is optional (nothing blocks the app): an
 * empty text or an unset number is stored as null. Error messages are plain English for the form.
 */

/** Limits shared with the database. */
export const LIMITS = {
  displayNameMax: 40,
  goalMax: 200,
  birthYearMin: 1920,
  weight: { min: 30, max: 250 },
  weightNoteMax: 100,
  testNotesMax: 1000,
  ftp: { min: 50, max: 600 },
  maxHr: { min: 100, max: 230 },
  restingHr: { min: 25, max: 120 },
  lthr: { min: 90, max: 220 },
} as const;

/** Trimmed text; empty becomes null. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullable();
}

/** The current year in Brussels. */
function currentYear(now: Date): number {
  const date = brusselsDate(now);
  return date === null ? now.getUTCFullYear() : Number(date.slice(0, 4));
}

/**
 * Schema for the profile form values. Output: `displayName` (max 40 characters) and `goal` (max 200) as
 * trimmed text or null, `birthYear` (whole year from 1920 to the current year) or null, and
 * `availableDays` as unique weekdays in week order (Monday to Sunday, may be empty). Pass `now` in tests;
 * the year limit is read when the schema is created, so create it per use rather than once at load.
 */
export function profileSchema(now: Date = new Date()) {
  const maxYear = currentYear(now);
  return z.object({
    displayName: optionalText(LIMITS.displayNameMax, "Name").default(null),
    birthYear: z
      .number("Enter a year as a number.")
      .int("Enter a whole year.")
      .min(LIMITS.birthYearMin, `Enter a year from ${LIMITS.birthYearMin}.`)
      .max(maxYear, `Enter a year up to ${maxYear}.`)
      .nullable()
      .default(null),
    availableDays: z
      .array(z.enum(WEEKDAYS))
      .max(WEEKDAYS.length)
      .transform((days) => WEEKDAYS.filter((d) => days.includes(d)))
      .default([]),
    goal: optionalText(LIMITS.goalMax, "Goal").default(null),
  });
}

export type ProfileValues = z.output<ReturnType<typeof profileSchema>>;

function whole(label: string, unit: string, min: number, max: number) {
  return z
    .number(`Enter ${label} as a number.`)
    .int(`Enter ${label} as a whole number.`)
    .min(min, `${label[0]?.toUpperCase()}${label.slice(1)} must be at least ${min} ${unit}.`)
    .max(max, `${label[0]?.toUpperCase()}${label.slice(1)} can be at most ${max} ${unit}.`);
}

/** FTP in whole watts, 50 to 600. */
export const ftpSchema = whole("FTP", "W", LIMITS.ftp.min, LIMITS.ftp.max);
/** Max heart rate in whole bpm, 100 to 230. */
export const maxHrSchema = whole("max heart rate", "bpm", LIMITS.maxHr.min, LIMITS.maxHr.max);
/** Resting heart rate in whole bpm, 25 to 120. */
export const restingHrSchema = whole(
  "resting heart rate",
  "bpm",
  LIMITS.restingHr.min,
  LIMITS.restingHr.max,
);
/** Lactate threshold heart rate in whole bpm, 90 to 220. */
export const lthrSchema = whole("LTHR", "bpm", LIMITS.lthr.min, LIMITS.lthr.max);

/**
 * A baseline entry: any of FTP, max HR, resting HR and LTHR, each a whole number in range or null/absent. When both
 * heart rates are given, LTHR cannot be above max HR (error on `lthr`).
 */
export const baselineSchema = z
  .object({
    ftp: ftpSchema.nullable().default(null),
    maxHr: maxHrSchema.nullable().default(null),
    restingHr: restingHrSchema.nullable().default(null),
    lthr: lthrSchema.nullable().default(null),
  })
  .refine((v) => v.lthr === null || v.maxHr === null || v.lthr <= v.maxHr, {
    path: ["lthr"],
    message: "LTHR cannot be higher than max heart rate.",
  });

export type BaselineValues = z.output<typeof baselineSchema>;

/**
 * A weight entry: `kg` from 30 to 250 (decimals allowed, rounded to 2 places like the database column) and
 * an optional `note` of at most 100 characters (trimmed, empty becomes null). The date is validated by the
 * caller with `isIsoDate` and `weightEntryRules` (one entry per day).
 */
export const weightEntrySchema = z.object({
  kg: z
    .number("Enter your weight as a number.")
    .min(LIMITS.weight.min, `Weight must be at least ${LIMITS.weight.min} kg.`)
    .max(LIMITS.weight.max, `Weight can be at most ${LIMITS.weight.max} kg.`)
    .transform((v) => Math.round(v * 100) / 100),
  note: optionalText(LIMITS.weightNoteMax, "Note").default(null),
});

export type WeightEntryValues = z.output<typeof weightEntrySchema>;

// Weekday mapping. The domain logic uses 'mon'..'sun' (week starts Monday). The database stores weekday
// numbers 0..6 with 0 = Sunday (JavaScript Date.getDay()): `profiles.available_days` (smallint[]) and
// `profiles.weight_reminder_day` (smallint). This is the only place that converts; the UI never does.
const DB_DAY: Record<Weekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
};

/** One weekday as the database number (mon 1 ... sat 6, sun 0). */
export function weekdayToDb(day: Weekday): number {
  return DB_DAY[day];
}

/** One database weekday number (0 = Sunday ... 6 = Saturday) as a weekday, or null when out of range. */
export function weekdayFromDb(value: number | null | undefined): Weekday | null {
  return WEEKDAYS.find((d) => DB_DAY[d] === value) ?? null;
}

/** Weekdays as database numbers: unique, ascending (0 = Sunday first). */
export function weekdaysToDb(days: readonly Weekday[]): number[] {
  return [...new Set(days.map(weekdayToDb))].sort((a, b) => a - b);
}

/** Database weekday numbers as unique weekdays in week order (Monday to Sunday); null and bad values are dropped. */
export function weekdaysFromDb(values: readonly number[] | null | undefined): Weekday[] {
  const set = new Set(values ?? []);
  return WEEKDAYS.filter((d) => set.has(DB_DAY[d]));
}
