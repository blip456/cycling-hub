/** The four example plans of docs/plan/example-plans.md as engine inputs (FTP 250 W, start Monday 2026-10-26). */
import type { PlanInput } from "./types";

export const EXAMPLE_TODAY = "2026-10-26";

const BASE = { ftp: 250, lthr: 165, today: EXAMPLE_TODAY } as const;

/** A. Amateur, 4 h a week, endurance. Tue, Wed, Sat, Sun. Outdoor. No event. */
export const EXAMPLE_A: PlanInput = {
  ...BASE,
  intake: {
    purposes: ["endurance"],
    levelAnswers: { experience: 1, weeklyHours: 1, intervals: 1, longestRide: 1, hardSessions: 0 },
    hoursPerWeek: 4,
    availableDays: ["tue", "wed", "sat", "sun"],
    environment: "outdoor",
  },
};

/** B. Committed, 8 h a week, speed, 100 km event on the Sunday of week 12. Wednesdays indoors. */
export const EXAMPLE_B: PlanInput = {
  ...BASE,
  intake: {
    purposes: ["speed"],
    levelAnswers: { experience: 2, weeklyHours: 2, intervals: 2, longestRide: 1, hardSessions: 1 },
    hoursPerWeek: 8,
    availableDays: ["tue", "wed", "fri", "sat", "sun"],
    environment: "both",
    event: { name: "100 km ride", date: "2027-01-17", duration: "3-to-6h" },
  },
};

/** C. Semi-pro, 13 h a week, endurance plus muscle building. Tue to Sun. Outdoor. */
export const EXAMPLE_C: PlanInput = {
  ...BASE,
  intake: {
    purposes: ["endurance", "muscle-building"],
    levelAnswers: { experience: 3, weeklyHours: 3, intervals: 2, longestRide: 2, hardSessions: 2 },
    hoursPerWeek: 13,
    availableDays: ["tue", "wed", "thu", "fri", "sat", "sun"],
    environment: "outdoor",
  },
};

/** D. Amateur, 5 h a week, weight loss 86 to 80 kg by the end of week 12. Tue, Wed, Sat, Sun. */
export const EXAMPLE_D: PlanInput = {
  ...BASE,
  intake: {
    purposes: ["weight-loss"],
    levelAnswers: { experience: 1, weeklyHours: 1, intervals: 1, longestRide: 1, hardSessions: 1 },
    hoursPerWeek: 5,
    availableDays: ["tue", "wed", "sat", "sun"],
    environment: "outdoor",
    weightKg: 86,
    weightGoal: { targetKg: 80, targetDate: "2027-01-17" },
  },
};
