import { scoreLevel, type Level, type LevelAnswers } from "@/features/plan/engine";
import { levelAnswersToStored, PLAN_LIMITS } from "@/features/plan/schemas";

/** Level answers in question order to the engine's named answers; null until all five are answered. */
export function toEngineAnswers(answers: readonly (number | null)[]): LevelAnswers | null {
  if (answers.some((a) => a === null)) return null;
  return levelAnswersToStored(answers.map((a) => a ?? 0));
}

/** The scored level for the answers and the hours per week; with no hours given the hours gate does not apply. */
export function scoredLevel(
  answers: readonly (number | null)[],
  hours: number | null,
): { score: number; band: Level; level: Level } | null {
  const engineAnswers = toEngineAnswers(answers);
  if (!engineAnswers) return null;
  const result = scoreLevel(engineAnswers, hours ?? PLAN_LIMITS.weeklyHours.max);
  return { score: result.score, band: result.band, level: result.gated };
}
