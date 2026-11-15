/**
 * Training settings (rules section 3b): where inside Zone 2 the easy and long rides aim, and how far the
 * level limits for the long ride and the weekly hours reach. Pure. The Coggan bands never change; only the
 * target inside the band does (P40).
 */
import { BALANCE_CAP_FACTOR, LEVEL_SETTINGS, type LevelSettings } from "./constants";
import type { IntensityBalance, Level, Notice, PlanSettings } from "./types";

/** The Zone 2 band of the Coggan zones (56 to 75 % of FTP) and the default target inside it. */
export const ZONE2 = { min: 56, max: 75, default: 65 } as const;

/** Limits of the settings the PO can type. The level minimum always wins over a smaller maximum. */
export const SETTING_LIMITS = {
  /** Minutes, in steps of 5. */
  maxLongRideMin: { min: 90, max: 480, step: 5 },
  /** Hours, in half hours. */
  maxHoursPerWeek: { min: 3, max: 25, step: 0.5 },
} as const;

/** The Zone 2 target in percent of FTP: the setting kept inside the band, else the default. */
export function zone2Percent(settings?: PlanSettings): number {
  const value = settings?.zone2TargetPercent;
  if (value === undefined || !Number.isFinite(value)) return ZONE2.default;
  return Math.min(ZONE2.max, Math.max(ZONE2.min, Math.round(value)));
}

/** The intensity balance of the settings; base-focused when missing. */
export function intensityBalance(settings?: PlanSettings): IntensityBalance {
  const value = settings?.intensityBalance;
  return value === "balanced" || value === "high" ? value : "base";
}

function usable(value: number | undefined, min: number): value is number {
  return value !== undefined && Number.isFinite(value) && value >= min;
}

/** The settings as the engine uses them: unusable values drop out, the rest is rounded and bounded. */
export function normalizeSettings(settings?: PlanSettings): PlanSettings {
  const out: PlanSettings = {};
  const zone2 = zone2Percent(settings);
  if (zone2 !== ZONE2.default) out.zone2TargetPercent = zone2;
  const balance = intensityBalance(settings);
  if (balance !== "base") out.intensityBalance = balance;
  const long = settings?.maxLongRideMin;
  if (usable(long, 1)) {
    const { min, max } = SETTING_LIMITS.maxLongRideMin;
    out.maxLongRideMin = Math.min(max, Math.max(min, Math.round(long / 5) * 5));
  }
  const hours = settings?.maxHoursPerWeek;
  if (usable(hours, 1)) {
    const { min, max } = SETTING_LIMITS.maxHoursPerWeek;
    out.maxHoursPerWeek = Math.min(max, Math.max(min, Math.round(hours * 2) / 2));
  }
  return out;
}

/**
 * The limits of a level with the PO's settings laid over them: the long ride maximum and the hours maximum.
 * A maximum below the level minimum is lifted to the minimum, so a level always has a valid range.
 */
export function levelSettingsFor(level: Level, settings?: PlanSettings): LevelSettings {
  const base = LEVEL_SETTINGS[level];
  const own = normalizeSettings(settings);
  const factor = BALANCE_CAP_FACTOR[intensityBalance(settings)];
  return {
    ...base,
    qualityCap: base.qualityCap * factor,
    aboveThresholdCap: base.aboveThresholdCap * factor,
    long: [base.long[0], Math.max(base.long[0], own.maxLongRideMin ?? base.long[1])],
    hours: [base.hours[0], Math.max(base.hours[0], own.maxHoursPerWeek ?? base.hours[1])],
  };
}

function hoursText(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** A plain fact listing the settings that differ from the defaults; null when none does. */
export function settingsNotice(level: Level, settings?: PlanSettings): Notice | null {
  const own = normalizeSettings(settings);
  const base = LEVEL_SETTINGS[level];
  const parts: string[] = [];
  if (own.intensityBalance !== undefined) {
    parts.push(
      own.intensityBalance === "balanced"
        ? "the intensity is balanced (a VO2 session a week from Build and a sprint ride)"
        : "the intensity is high (VO2 from the start, two sprint rides a week)",
    );
  }
  if (own.zone2TargetPercent !== undefined) {
    parts.push(`easy and long rides aim at ${own.zone2TargetPercent} % of FTP`);
  }
  if (own.maxLongRideMin !== undefined && own.maxLongRideMin !== base.long[1]) {
    parts.push(`long rides go up to ${own.maxLongRideMin} minutes`);
  }
  if (own.maxHoursPerWeek !== undefined && own.maxHoursPerWeek !== base.hours[1]) {
    parts.push(`a week can hold up to ${hoursText(own.maxHoursPerWeek)} hours`);
  }
  if (parts.length === 0) return null;
  return {
    code: "settings-applied",
    message: `Your training settings apply: ${parts.join(", ")}.`,
  };
}
