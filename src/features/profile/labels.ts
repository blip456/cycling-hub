import type { Level } from "@/features/plan/engine";
import type { RidingEnvironment, TrainingPurpose } from "@/features/plan/schemas";

export const SAVE_FAILED = "Something went wrong. Try again.";

export const PURPOSE_LABEL: Record<TrainingPurpose, string> = {
  muscle_building: "Muscle building",
  weight_loss: "Weight loss",
  endurance: "Endurance",
  speed: "Speed",
};

export const ENVIRONMENT_LABEL: Record<RidingEnvironment, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  both: "Indoor and outdoor",
};

export const LEVEL_LABEL: Record<Level, string> = {
  amateur: "Amateur",
  committed: "Committed",
  "semi-pro": "Semi-pro",
};

/** The five level questions L1 to L5 and their answers 0 to 3 (docs/plan/engine-rules.md section 3). */
export const LEVEL_QUESTIONS: readonly { legend: string; answers: readonly string[] }[] = [
  {
    legend: "How long have you been riding regularly?",
    answers: ["Under 1 year", "1 to 2 years", "3 to 5 years", "More than 5 years"],
  },
  {
    legend: "How many hours a week did you ride in the last 3 months?",
    answers: ["Under 4", "4 to 7", "8 to 11", "12 or more"],
  },
  {
    legend: "How often do you train with intervals?",
    answers: ["Never", "Sometimes", "Most weeks", "Every week, by a plan"],
  },
  {
    legend: "What is your longest ride in the last 3 months?",
    answers: ["Under 2 h", "2 to 3.5 h", "3.5 to 5 h", "Over 5 h"],
  },
  {
    legend: "How many hard sessions a week can you handle comfortably?",
    answers: ["None", "One", "Two", "Three or more"],
  },
];
