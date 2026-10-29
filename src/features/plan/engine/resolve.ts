/** Resolves an input to the values the plan is built from (shared by `buildPlan` and the fingerprint). */
import { isIsoDate, powerZones, type IsoDate } from "@/features/athlete";
import { dayIndices } from "./allocate";
import { planStructure, type PlanStructure } from "./calendar";
import { MIN_AVAILABLE_DAYS } from "./constants";
import { clampHours, scoreLevel } from "./level";
import { purposePair, type PurposePair } from "./mix";
import type { LevelResult, Notice, PlanInput, Warning } from "./types";

export type ResolvedInput = {
  levelResult: LevelResult;
  /** H after clamping to the level range. */
  hoursPerWeek: number;
  purposes: PurposePair;
  structure: PlanStructure;
  /** Available day indices (0 = Monday), ascending. */
  days: number[];
  /** Why no plan can be built, or null. */
  blocked: Warning[];
  notices: Notice[];
};

/** True for a finite FTP of at least 1 W that gives zones. */
export function hasUsableFtp(ftp: number | null | undefined): ftp is number {
  return powerZones(ftp) !== null;
}

export function resolveInput(input: PlanInput): ResolvedInput {
  const { intake } = input;
  const levelResult = scoreLevel(intake.levelAnswers, intake.hoursPerWeek, intake.levelOverride);
  const hoursPerWeek = clampHours(levelResult.level, intake.hoursPerWeek);
  const today: IsoDate = isIsoDate(input.today) ? input.today : "1970-01-05";
  const structure = planStructure({
    today,
    startDate: intake.startDate,
    event: intake.event,
    recoveryEvery: intake.recoveryEvery,
  });
  const days = dayIndices(intake.availableDays);

  const blocked: Warning[] = [];
  if (!isIsoDate(input.today)) {
    blocked.push({ code: "invalid-input", message: "Today's date is not a valid date." });
  }
  if (days.length < MIN_AVAILABLE_DAYS) {
    blocked.push({
      code: "too-few-days",
      message: "A plan needs at least 2 days a week to ride. Add days in your profile.",
    });
  }
  if (!hasUsableFtp(input.ftp)) {
    blocked.push({
      code: "no-ftp",
      message: "The plan needs a baseline: set your FTP first.",
    });
  }

  const notices: Notice[] = [];
  if (levelResult.gated !== levelResult.band) {
    notices.push({
      code: "level-gated",
      message: `Your answers score as ${levelResult.band}, but ${intake.hoursPerWeek} hours a week fits ${levelResult.gated}.`,
    });
  }
  if (intake.levelOverride !== undefined && intake.levelOverride !== levelResult.gated) {
    notices.push({
      code: "level-overridden",
      message: `You chose the ${intake.levelOverride} level instead of ${levelResult.gated}.`,
    });
  }
  if (hoursPerWeek !== intake.hoursPerWeek) {
    notices.push({
      code: "hours-clamped",
      message: `${intake.hoursPerWeek} hours a week is outside the range for the ${levelResult.level} level, so the plan uses ${hoursPerWeek} hours.`,
    });
  }

  return {
    levelResult,
    hoursPerWeek,
    purposes: purposePair(intake.purposes),
    structure,
    days,
    blocked,
    notices,
  };
}
