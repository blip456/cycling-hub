/** Seeded random intakes for the property tests (the same seed always gives the same input). */
import { addDays, WEEKDAYS, type Weekday } from "@/features/athlete";
import {
  ENVIRONMENTS,
  EVENT_DURATIONS,
  PURPOSES,
  type Intake,
  type LevelScore,
  type PlanInput,
} from "./types";

/** mulberry32: a small seeded generator. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GENERATED_TODAY = "2026-11-04"; // a Wednesday

export function generateInput(seed: number): PlanInput {
  const rnd = generator(seed);
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[int(0, list.length - 1)] as T;
  const score = (): LevelScore => int(0, 3) as LevelScore;

  const dayCount = int(2, 7);
  const days: Weekday[] = [...WEEKDAYS].sort(() => rnd() - 0.5).slice(0, dayCount);
  const purposeCount = int(0, 4);
  const purposes = [...PURPOSES].sort(() => rnd() - 0.5).slice(0, purposeCount);
  const intake: Intake = {
    purposes,
    levelAnswers: {
      experience: score(),
      weeklyHours: score(),
      intervals: score(),
      longestRide: score(),
      hardSessions: score(),
    },
    hoursPerWeek: int(4, 36) / 2,
    availableDays: days,
    environment: pick(ENVIRONMENTS),
    ...(rnd() < 0.3 ? { recoveryEvery: 3 as const } : {}),
    ...(rnd() < 0.2 ? { ftpTest: "ramp" as const } : {}),
    ...(rnd() < 0.5
      ? {
          event: {
            name: "Event",
            date: addDays(GENERATED_TODAY, int(5, 140)) ?? GENERATED_TODAY,
            duration: pick(EVENT_DURATIONS),
          },
        }
      : {}),
    ...(rnd() < 0.5
      ? {
          weightKg: int(600, 1100) / 10,
          weightGoal: {
            targetKg: int(500, 1000) / 10,
            targetDate: addDays(GENERATED_TODAY, int(30, 200)) ?? GENERATED_TODAY,
          },
        }
      : {}),
  };
  return {
    intake,
    today: GENERATED_TODAY,
    ftp: int(120, 420),
    ...(rnd() < 0.7 ? { lthr: int(140, 185) } : rnd() < 0.5 ? { maxHr: int(170, 205) } : {}),
  };
}
