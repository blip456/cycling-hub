/**
 * What the rides suggest for answers the PO would otherwise type (profile and plan intake). Pure. Every value
 * is a suggestion that fills an open question or sits next to a button: it is never saved on its own, and the
 * ride history never sets the level itself (rules section 3).
 */
import type { IsoDate } from "@/features/athlete";
import { mondayOnOrBefore, plusDays } from "./calendar";
import {
  countedWeeks,
  HISTORY_WEEKS,
  LEVEL_HOURS_WEEKS,
  recentWeeklyHours,
  suggestedHoursAnswer,
  weeklyHoursList,
  type HistoryRide,
} from "./history";
import { SETTING_LIMITS } from "./settings";
import type { HistoryStat } from "./types";

/** Same range as the hours the PO can ask for (`PLAN_LIMITS.weeklyHours`). */
const TARGET_HOURS = { min: 1, max: 25 } as const;

/** A ride with average power above this share of FTP counts as a hard ride (no streams: average power only). */
export const HARD_RIDE_SHARE_OF_FTP = 0.75;
/** Fewer rides with power than this in the last 3 months: too little to tell anything about hard riding. */
export const MIN_POWER_RIDES = 6;

export type NumberSuggestion = { value: number; note: string };
export type LevelSuggestion = { answer: 0 | 1 | 2 | 3; note: string };

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hoursText(hours: number): string {
  return String(Math.round(hours * 10) / 10);
}

/** Nearest-rank percentile of the values (0 to 1). */
function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1] ?? 0;
}

function trainingRides(rides: readonly HistoryRide[]): HistoryRide[] {
  return rides.filter((r) => r.commute !== true && r.movingMinutes > 0);
}

/** "Hours you want to train per week": the weekly hours of the last 24 weeks, in half hours. */
export function suggestTargetHours(
  rides: readonly HistoryRide[],
  today: IsoDate,
  stat: HistoryStat,
): NumberSuggestion | undefined {
  const hours = recentWeeklyHours(rides, today, stat);
  if (hours === undefined) return undefined;
  const value = clamp(roundTo(hours, 0.5), TARGET_HOURS.min, TARGET_HOURS.max);
  return {
    value,
    note: `about ${hoursText(hours)} h a week over the last ${String(HISTORY_WEEKS)} weeks`,
  };
}

/** "Most hours in a week": the busiest weeks of the last 24 (90th percentile), rounded up to half hours. */
export function suggestMaxWeeklyHours(
  rides: readonly HistoryRide[],
  today: IsoDate,
): NumberSuggestion | undefined {
  const list = weeklyHoursList(rides, today);
  if (!list) return undefined;
  const busy = percentile(list, 0.9);
  const { min, max } = SETTING_LIMITS.maxHoursPerWeek;
  return {
    value: clamp(Math.ceil(busy * 2) / 2, min, max),
    note: `your busiest weeks of the last ${String(HISTORY_WEEKS)} weeks hold about ${hoursText(busy)} h`,
  };
}

/** "Longest long ride": the longest ride of the last 24 weeks, in steps of 5 minutes. */
export function suggestMaxLongRide(
  rides: readonly HistoryRide[],
  today: IsoDate,
): NumberSuggestion | undefined {
  const thisMonday = mondayOnOrBefore(today);
  const first = plusDays(thisMonday, -7 * HISTORY_WEEKS);
  const last = plusDays(thisMonday, -1);
  const inWindow = trainingRides(rides).filter((r) => r.date >= first && r.date <= last);
  if (inWindow.length === 0) return undefined;
  const longest = Math.max(...inWindow.map((r) => r.movingMinutes));
  const { min, max } = SETTING_LIMITS.maxLongRideMin;
  return {
    value: clamp(Math.round(longest / 5) * 5, min, max),
    note: `your longest ride of the last ${String(HISTORY_WEEKS)} weeks took ${String(Math.round(longest))} minutes`,
  };
}

/** L1, years of riding: from the first ride on record. Only a lower bound, so no answer under one year. */
function experienceSuggestion(
  rides: readonly HistoryRide[],
  today: IsoDate,
): LevelSuggestion | undefined {
  const dates = trainingRides(rides).map((r) => r.date);
  if (dates.length === 0) return undefined;
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const years = (Date.parse(today) - Date.parse(first)) / (365.25 * 86_400_000);
  if (!(years >= 1)) return undefined;
  const answer = years > 5 ? 3 : years >= 3 ? 2 : 1;
  return {
    answer,
    note: `your first ride on record is ${String(Math.floor(years))} ${Math.floor(years) === 1 ? "year" : "years"} ago, earlier rides may be missing`,
  };
}

/** L4, longest ride of the last 3 months. */
function longestRideSuggestion(
  rides: readonly HistoryRide[],
  today: IsoDate,
): LevelSuggestion | undefined {
  const thisMonday = mondayOnOrBefore(today);
  const first = plusDays(thisMonday, -7 * LEVEL_HOURS_WEEKS);
  const last = plusDays(thisMonday, -1);
  const inWindow = trainingRides(rides).filter((r) => r.date >= first && r.date <= last);
  if (inWindow.length === 0) return undefined;
  const hours = Math.max(...inWindow.map((r) => r.movingMinutes)) / 60;
  const answer = hours > 5 ? 3 : hours >= 3.5 ? 2 : hours >= 2 ? 1 : 0;
  return { answer, note: `your longest ride of the last 3 months took ${hoursText(hours)} h` };
}

/** Hard rides per counted week of the last 3 months; undefined without enough rides with power. */
function hardRidesPerWeek(
  rides: readonly HistoryRide[],
  today: IsoDate,
  ftp: number,
): number[] | undefined {
  const counted = countedWeeks(rides, today, LEVEL_HOURS_WEEKS);
  if (!counted) return undefined;
  const power = trainingRides(rides).filter(
    (r) =>
      r.avgPowerW != null && r.avgPowerW > 0 && counted.minutesByWeek.has(mondayOnOrBefore(r.date)),
  );
  if (power.length < MIN_POWER_RIDES) return undefined;
  const hard = new Map<IsoDate, number>();
  for (const ride of power) {
    if ((ride.avgPowerW ?? 0) < HARD_RIDE_SHARE_OF_FTP * ftp) continue;
    const week = mondayOnOrBefore(ride.date);
    hard.set(week, (hard.get(week) ?? 0) + 1);
  }
  return counted.mondays.map((week) => hard.get(week) ?? 0);
}

const HARD_NOTE = `average power above ${String(Math.round(HARD_RIDE_SHARE_OF_FTP * 100))} % of your FTP`;

/** L3, how often you train with intervals: the share of weeks with at least one hard ride. */
function intervalsSuggestion(perWeek: readonly number[] | undefined): LevelSuggestion | undefined {
  if (!perWeek || perWeek.length === 0) return undefined;
  const withHard = perWeek.filter((n) => n > 0).length;
  const share = withHard / perWeek.length;
  const answer = share >= 0.85 ? 3 : share >= 0.5 ? 2 : share >= 0.1 ? 1 : 0;
  return {
    answer,
    note: `${String(withHard)} of your last ${String(perWeek.length)} weeks had a ride with ${HARD_NOTE}`,
  };
}

/** L5, hard sessions a week: what your hardest weeks held (90th percentile of the weeks). */
function hardSessionsSuggestion(
  perWeek: readonly number[] | undefined,
): LevelSuggestion | undefined {
  if (!perWeek || perWeek.length === 0) return undefined;
  const busy = percentile(perWeek, 0.9);
  const answer = busy >= 3 ? 3 : busy >= 2 ? 2 : busy >= 1 ? 1 : 0;
  return {
    answer,
    note: `your hardest weeks of the last 3 months held ${String(busy)} ${busy === 1 ? "ride" : "rides"} with ${HARD_NOTE}`,
  };
}

/**
 * The suggested answers of the five level questions L1 to L5, from the rides. An entry is undefined when the
 * rides say too little for that question (L3 and L5 also need an FTP and rides with average power).
 */
export function levelSuggestions(
  rides: readonly HistoryRide[],
  today: IsoDate,
  stat: HistoryStat,
  ftp: number | null,
): readonly (LevelSuggestion | undefined)[] {
  const hours = suggestedHoursAnswer(rides, today, stat);
  const perWeek = ftp !== null && ftp > 0 ? hardRidesPerWeek(rides, today, ftp) : undefined;
  return [
    experienceSuggestion(rides, today),
    hours
      ? {
          answer: hours.answer,
          note: `about ${hoursText(hours.hours)} h a week over the last 3 months`,
        }
      : undefined,
    intervalsSuggestion(perWeek),
    longestRideSuggestion(rides, today),
    hardSessionsSuggestion(perWeek),
  ];
}

/** The sentence under a field or question: what the rides show, and whether the answer was filled in from it. */
export function suggestionText(note: string, filled: boolean): string {
  return filled
    ? `Filled in from your rides: ${note}. Change it if that is not right.`
    : `From your rides: ${note}.`;
}
