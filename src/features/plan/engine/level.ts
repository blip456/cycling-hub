import { LEVEL_SETTINGS } from "./constants";
import { levelSettingsFor } from "./settings";
import type { Level, LevelAnswers, LevelResult, PlanSettings } from "./types";

/** Sum of the five answers, 0 to 15 (section 3). */
export function levelScore(answers: LevelAnswers): number {
  return (
    answers.experience +
    answers.weeklyHours +
    answers.intervals +
    answers.longestRide +
    answers.hardSessions
  );
}

/** Score bands: 0 to 5 amateur, 6 to 10 committed, 11 to 15 semi-pro. */
export function levelBand(score: number): Level {
  if (score >= 11) return "semi-pro";
  if (score >= 6) return "committed";
  return "amateur";
}

/**
 * The hours gate: semi-pro needs H of 10 or more, committed needs 6 or more, otherwise the level drops
 * one step at a time (an amateur riding 4 hours cannot be semi-pro).
 */
export function gateLevel(level: Level, hoursPerWeek: number): Level {
  if (level === "semi-pro" && hoursPerWeek < LEVEL_SETTINGS["semi-pro"].minHoursForLevel) {
    return gateLevel("committed", hoursPerWeek);
  }
  if (level === "committed" && hoursPerWeek < LEVEL_SETTINGS.committed.minHoursForLevel) {
    return "amateur";
  }
  return level;
}

/**
 * Level from the five answers and the hours per week: score, band, hours gate, then the PO's override.
 * The ride history never changes the level.
 */
export function scoreLevel(
  answers: LevelAnswers,
  hoursPerWeek: number,
  override?: Level,
): LevelResult {
  const score = levelScore(answers);
  const band = levelBand(score);
  const gated = gateLevel(band, hoursPerWeek);
  return { score, band, gated, level: override ?? gated };
}

/** H clamped to the hours range of the level (the PO's hours maximum replaces the level maximum). */
export function clampHours(level: Level, hoursPerWeek: number, settings?: PlanSettings): number {
  const [min, max] = levelSettingsFor(level, settings).hours;
  const value = Number.isFinite(hoursPerWeek) ? hoursPerWeek : min;
  return Math.min(max, Math.max(min, value));
}
