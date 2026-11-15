import { describe, expect, it } from "vitest";
import { buildPlan } from "./build";
import { LEVEL_SETTINGS } from "./constants";
import { inputFingerprint } from "./fingerprint";
import { EXAMPLE_A, EXAMPLE_B } from "./fixtures";
import { clampHours } from "./level";
import { checkPlan } from "./plan-checks";
import {
  levelSettingsFor,
  normalizeSettings,
  settingsNotice,
  SETTING_LIMITS,
  ZONE2,
  zone2Percent,
} from "./settings";
import type { PlanInput } from "./types";

/** The amateur example asked to ride 8 h: the level range (3 to 6 h) clamps it to 6 h without settings. */
const EIGHT_HOURS: PlanInput = {
  ...EXAMPLE_A,
  intake: { ...EXAMPLE_A.intake, hoursPerWeek: 8 },
};

describe("Zone 2 target (rules section 3b)", () => {
  it("defaults to 65 % and stays inside the 56 to 75 % band", () => {
    expect(zone2Percent()).toBe(ZONE2.default);
    expect(zone2Percent({})).toBe(65);
    expect(zone2Percent({ zone2TargetPercent: 70.4 })).toBe(70);
    expect(zone2Percent({ zone2TargetPercent: 90 })).toBe(75);
    expect(zone2Percent({ zone2TargetPercent: 40 })).toBe(56);
    expect(zone2Percent({ zone2TargetPercent: Number.NaN })).toBe(65);
  });

  it("moves the easy, long and fill steps, and nothing else", () => {
    const plan = buildPlan({ ...EXAMPLE_B, settings: { zone2TargetPercent: 72 } });
    const steps = plan.sessions.flatMap((s) => s.steps.map((step) => ({ kind: s.kind, step })));
    const longRide = steps.find((s) => s.kind === "long");
    expect(longRide?.step.target).toMatchObject({
      percentFtp: 72,
      minPercent: 56,
      maxPercent: 75,
      powerZone: 2,
    });
    expect(longRide?.step.target.watts.target).toBe(180);
    // The band in watts stays the zone: 56 to 75 % of 250 W.
    expect(longRide?.step.target.watts).toMatchObject({ min: 140, max: 188 });
    expect(
      steps
        .filter((s) => s.step.label === "Easy endurance")
        .every((s) => s.step.target.percentFtp === 72),
    ).toBe(true);
    // Other zones keep their own targets.
    expect(
      steps
        .filter((s) => s.step.label.startsWith("VO2 max"))
        .every((s) => s.step.target.percentFtp === 112),
    ).toBe(true);
    expect(
      steps.filter((s) => s.kind === "recovery").every((s) => s.step.target.percentFtp === 50),
    ).toBe(true);
  });

  it("raises the planned load of Zone 2 time, and changes no minutes", () => {
    const plain = buildPlan(EXAMPLE_B);
    const higher = buildPlan({ ...EXAMPLE_B, settings: { zone2TargetPercent: 72 } });
    expect(higher.weeks.map((w) => w.plannedMinutes)).toEqual(
      plain.weeks.map((w) => w.plannedMinutes),
    );
    expect(higher.weeks[0]?.load).toBeGreaterThan(plain.weeks[0]?.load ?? 0);
  });

  it("gives the same plan when the setting is the default", () => {
    const plain = buildPlan(EXAMPLE_B);
    const same = buildPlan({ ...EXAMPLE_B, settings: { zone2TargetPercent: 65 } });
    expect(same.fingerprint).toBe(plain.fingerprint);
    expect(same.sessions).toEqual(plain.sessions);
    expect(same.notices.map((n) => n.code)).not.toContain("settings-applied");
  });
});

describe("level limits (rules section 3b)", () => {
  it("replaces the long ride and hours maximum of the level, never below its minimum", () => {
    const base = LEVEL_SETTINGS.amateur;
    expect(levelSettingsFor("amateur").long).toEqual(base.long);
    expect(levelSettingsFor("amateur", { maxLongRideMin: 240 }).long).toEqual([90, 240]);
    expect(levelSettingsFor("amateur", { maxHoursPerWeek: 9 }).hours).toEqual([3, 9]);
    expect(levelSettingsFor("committed", { maxHoursPerWeek: 4 }).hours).toEqual([6, 6]);
    expect(levelSettingsFor("semi-pro", { maxLongRideMin: 100 }).long).toEqual([150, 150]);
  });

  it("keeps settings inside their limits and drops values that cannot be used", () => {
    expect(normalizeSettings({ maxLongRideMin: 1000, maxHoursPerWeek: 99 })).toEqual({
      maxLongRideMin: SETTING_LIMITS.maxLongRideMin.max,
      maxHoursPerWeek: SETTING_LIMITS.maxHoursPerWeek.max,
    });
    expect(normalizeSettings({ maxLongRideMin: 243, maxHoursPerWeek: 8.7 })).toEqual({
      maxLongRideMin: 245,
      maxHoursPerWeek: 8.5,
    });
    expect(normalizeSettings({ maxLongRideMin: Number.NaN, maxHoursPerWeek: -1 })).toEqual({});
    expect(normalizeSettings({ zone2TargetPercent: 65 })).toEqual({});
  });

  it("clamps H to the raised hours maximum", () => {
    expect(clampHours("amateur", 8)).toBe(6);
    expect(clampHours("amateur", 8, { maxHoursPerWeek: 9 })).toBe(8);
    expect(clampHours("amateur", 12, { maxHoursPerWeek: 9 })).toBe(9);
  });

  it("plans the raised hours, with no clamp notice, and still passes the plan checks", () => {
    const plain = buildPlan(EIGHT_HOURS);
    expect(plain.hoursPerWeek).toBe(6);
    expect(plain.notices.map((n) => n.code)).toContain("hours-clamped");

    const input: PlanInput = {
      ...EIGHT_HOURS,
      settings: { maxHoursPerWeek: 9, maxLongRideMin: 300 },
    };
    const raised = buildPlan(input);
    expect(raised.hoursPerWeek).toBe(8);
    expect(raised.notices.map((n) => n.code)).not.toContain("hours-clamped");
    expect(raised.notices.map((n) => n.code)).toContain("settings-applied");
    const peak = Math.max(...raised.weeks.map((w) => w.plannedMinutes));
    expect(peak).toBeGreaterThan(Math.max(...plain.weeks.map((w) => w.plannedMinutes)));
    expect(peak).toBeLessThanOrEqual(8 * 60);
    expect(checkPlan(raised, input)).toEqual([]);
  });

  it("lets the long ride grow past the level maximum when the setting allows it", () => {
    const longest = (settings?: PlanInput["settings"]) =>
      Math.max(
        ...buildPlan({
          ...EIGHT_HOURS,
          intake: { ...EIGHT_HOURS.intake, availableDays: ["wed", "sat", "sun"] },
          settings: { maxHoursPerWeek: 12, ...settings },
        })
          .sessions.filter((s) => s.kind === "long")
          .map((s) => s.durationMin),
      );
    expect(longest({ maxLongRideMin: 120 })).toBeLessThanOrEqual(120);
    expect(longest({ maxLongRideMin: 400 })).toBeGreaterThan(180);
  });
});

describe("fingerprint and notice", () => {
  it("is the same without settings, with an empty object and with the defaults", () => {
    const plain = inputFingerprint(EXAMPLE_B);
    expect(inputFingerprint({ ...EXAMPLE_B, settings: {} })).toBe(plain);
    expect(inputFingerprint({ ...EXAMPLE_B, settings: { zone2TargetPercent: 65 } })).toBe(plain);
  });

  it("changes with each setting", () => {
    const plain = inputFingerprint(EXAMPLE_B);
    const prints = [
      { zone2TargetPercent: 70 },
      { maxLongRideMin: 300 },
      { maxHoursPerWeek: 12 },
    ].map((settings) => inputFingerprint({ ...EXAMPLE_B, settings }));
    expect(new Set([plain, ...prints]).size).toBe(4);
  });

  it("names only the settings that differ from the level", () => {
    expect(settingsNotice("committed", { zone2TargetPercent: 70 })?.message).toBe(
      "Your training settings apply: easy and long rides aim at 70 % of FTP.",
    );
    expect(settingsNotice("committed", { maxLongRideMin: 270, maxHoursPerWeek: 10 })).toBeNull();
    expect(
      settingsNotice("committed", { maxLongRideMin: 300, maxHoursPerWeek: 11.5 })?.message,
    ).toBe(
      "Your training settings apply: long rides go up to 300 minutes, a week can hold up to 11.5 hours.",
    );
  });
});
