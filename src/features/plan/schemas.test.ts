import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAINING_SETTINGS,
  levelAnswersFromStored,
  levelAnswersSchema,
  levelAnswersToStored,
  maxLongRideSchema,
  maxWeeklyHoursSchema,
  planProfileSchema,
  planSettingsOf,
  trainingPurposesSchema,
  trainingSettingsFromRow,
  weeklyHoursSchema,
  weeklyRateCapSchema,
  weightGoalSchema,
  zone2TargetSchema,
} from "./schemas";

const now = new Date("2026-10-29T12:00:00Z");
const profile = planProfileSchema(now);

describe("planProfileSchema", () => {
  it("accepts an empty plan profile", () => {
    expect(profile.parse({})).toEqual({
      ridingEnvironment: null,
      weeklyHours: null,
      trainingPurposes: [],
      levelAnswers: null,
      eventName: null,
      eventDate: null,
    });
  });

  it("accepts a full plan profile and trims the event name", () => {
    const result = profile.parse({
      ridingEnvironment: "both",
      weeklyHours: 6.5,
      trainingPurposes: ["endurance", "weight_loss"],
      levelAnswers: [1, 2, 0, 3, 1],
      eventName: "  Winter sportive ",
      eventDate: "2026-12-12",
    });
    expect(result.eventName).toBe("Winter sportive");
    expect(result.trainingPurposes).toEqual(["endurance", "weight_loss"]);
  });

  it("rejects an unknown riding environment", () => {
    expect(profile.safeParse({ ridingEnvironment: "trainer" }).success).toBe(false);
  });

  it("needs the event name and date together", () => {
    const noDate = profile.safeParse({ eventName: "Ride" });
    expect(noDate.success ? [] : noDate.error.issues.map((i) => i.path[0])).toEqual(["eventDate"]);
    const noName = profile.safeParse({ eventDate: "2026-12-12" });
    expect(noName.success ? [] : noName.error.issues.map((i) => i.path[0])).toEqual(["eventName"]);
    expect(profile.parse({ eventName: "   " }).eventName).toBeNull();
  });

  it("rejects an event date today, in the past or not a real date", () => {
    for (const eventDate of ["2026-10-29", "2026-10-01", "2026-02-30", "soon"])
      expect(profile.safeParse({ eventName: "Ride", eventDate }).success).toBe(false);
    expect(profile.safeParse({ eventName: "Ride", eventDate: "2026-10-30" }).success).toBe(true);
  });

  it("limits the event name to 60 characters", () => {
    expect(profile.safeParse({ eventName: "a".repeat(60), eventDate: "2026-12-12" }).success).toBe(
      true,
    );
    expect(profile.safeParse({ eventName: "a".repeat(61), eventDate: "2026-12-12" }).success).toBe(
      false,
    );
  });
});

describe("weeklyHoursSchema", () => {
  it("accepts 1 to 25 in half hours", () => {
    for (const hours of [1, 6.5, 25]) expect(weeklyHoursSchema.safeParse(hours).success).toBe(true);
  });
  it("rejects out of range, other fractions and text", () => {
    for (const hours of [0, 0.5, 25.5, 6.3, Number.NaN, "6"])
      expect(weeklyHoursSchema.safeParse(hours).success).toBe(false);
  });
});

describe("trainingPurposesSchema", () => {
  it("keeps the rank order and allows none, one or two", () => {
    expect(trainingPurposesSchema.parse([])).toEqual([]);
    expect(trainingPurposesSchema.parse(["speed", "endurance"])).toEqual(["speed", "endurance"]);
  });
  it("rejects three purposes, duplicates and unknown purposes", () => {
    expect(trainingPurposesSchema.safeParse(["speed", "endurance", "weight_loss"]).success).toBe(
      false,
    );
    expect(trainingPurposesSchema.safeParse(["speed", "speed"]).success).toBe(false);
    expect(trainingPurposesSchema.safeParse(["climbing"]).success).toBe(false);
  });
});

describe("levelAnswersSchema", () => {
  it("needs five answers from 0 to 3", () => {
    expect(levelAnswersSchema.safeParse([0, 1, 2, 3, 0]).success).toBe(true);
    expect(levelAnswersSchema.safeParse([0, 1, 2, 3]).success).toBe(false);
    expect(levelAnswersSchema.safeParse([0, 1, 2, 3, 4]).success).toBe(false);
    expect(levelAnswersSchema.safeParse([0, 1, 2, 3, 1.5]).success).toBe(false);
  });
});

describe("weightGoalSchema", () => {
  const schema = weightGoalSchema(now);
  it("accepts a target from 30 to 250 kg with a future date", () => {
    expect(schema.parse({ targetKg: 72.5, targetDate: "2026-12-13" })).toEqual({
      targetKg: 72.5,
      targetDate: "2026-12-13",
    });
    expect(schema.safeParse({ targetKg: 30, targetDate: "2027-01-01" }).success).toBe(true);
    expect(schema.safeParse({ targetKg: 250, targetDate: "2027-01-01" }).success).toBe(true);
  });
  it("rejects weights out of range", () => {
    for (const targetKg of [29.9, 250.1, 0, Number.NaN])
      expect(schema.safeParse({ targetKg, targetDate: "2027-01-01" }).success).toBe(false);
  });
  it("rejects a date that is today, in the past or invalid", () => {
    for (const targetDate of ["2026-10-29", "2026-01-01", "2026-13-01"])
      expect(schema.safeParse({ targetKg: 72, targetDate }).success).toBe(false);
  });
  it("needs both fields", () => {
    expect(schema.safeParse({ targetKg: 72 }).success).toBe(false);
    expect(schema.safeParse({ targetDate: "2027-01-01" }).success).toBe(false);
  });
});

describe("weeklyRateCapSchema", () => {
  it("allows up to 0.75 % a week", () => {
    expect(weeklyRateCapSchema.safeParse(0.5).success).toBe(true);
    expect(weeklyRateCapSchema.safeParse(0.75).success).toBe(true);
    expect(weeklyRateCapSchema.safeParse(0.8).success).toBe(false);
    expect(weeklyRateCapSchema.safeParse(0).success).toBe(false);
  });
});

describe("level answers storage", () => {
  it("maps form answers to the stored object and back", () => {
    const stored = levelAnswersToStored([1, 2, 0, 3, 1]);
    expect(stored).toEqual({
      experience: 1,
      weeklyHours: 2,
      intervals: 0,
      longestRide: 3,
      hardSessions: 1,
    });
    expect(levelAnswersFromStored(stored)).toEqual([1, 2, 0, 3, 1]);
  });
  it("returns null for incomplete or invalid input", () => {
    expect(levelAnswersToStored([1, 2])).toBeNull();
    expect(levelAnswersFromStored(null)).toBeNull();
    expect(levelAnswersFromStored([1, 2, 0, 3, 1])).toBeNull();
    expect(levelAnswersFromStored({ experience: 1 })).toBeNull();
  });
});

describe("training settings (P96 to P98)", () => {
  it("keeps the Zone 2 target inside the Coggan band, in whole percents", () => {
    expect(zone2TargetSchema.safeParse(56).success).toBe(true);
    expect(zone2TargetSchema.safeParse(70).success).toBe(true);
    expect(zone2TargetSchema.safeParse(75).success).toBe(true);
    expect(zone2TargetSchema.safeParse(55).success).toBe(false);
    expect(zone2TargetSchema.safeParse(76).success).toBe(false);
    expect(zone2TargetSchema.safeParse(70.5).success).toBe(false);
    expect(zone2TargetSchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("limits the long ride to 90 to 480 minutes in steps of 5 and the week to 3 to 25 half hours", () => {
    expect(maxLongRideSchema.safeParse(240).success).toBe(true);
    expect(maxLongRideSchema.safeParse(85).success).toBe(false);
    expect(maxLongRideSchema.safeParse(485).success).toBe(false);
    expect(maxLongRideSchema.safeParse(243).success).toBe(false);
    expect(maxWeeklyHoursSchema.safeParse(8.5).success).toBe(true);
    expect(maxWeeklyHoursSchema.safeParse(2.5).success).toBe(false);
    expect(maxWeeklyHoursSchema.safeParse(26).success).toBe(false);
    expect(maxWeeklyHoursSchema.safeParse(8.2).success).toBe(false);
  });

  it("reads a row: nothing set is the default, a value outside its limits is not set", () => {
    const empty = {
      zone2_target_percent: null,
      max_long_ride_min: null,
      max_weekly_hours: null,
      ride_history_stat: null,
      intensity_balance: null,
    };
    expect(trainingSettingsFromRow(empty)).toEqual(DEFAULT_TRAINING_SETTINGS);
    expect(DEFAULT_TRAINING_SETTINGS.historyStat).toBe("median");
    expect(
      trainingSettingsFromRow({
        zone2_target_percent: 70,
        max_long_ride_min: 240,
        max_weekly_hours: 9.5,
        ride_history_stat: "average",
        intensity_balance: "balanced",
      }),
    ).toEqual({
      zone2TargetPercent: 70,
      maxLongRideMin: 240,
      maxWeeklyHours: 9.5,
      historyStat: "average",
      intensityBalance: "balanced",
    });
    expect(
      trainingSettingsFromRow({
        zone2_target_percent: 99,
        max_long_ride_min: 5,
        max_weekly_hours: 40,
        ride_history_stat: "mode",
        intensity_balance: "extreme",
      }),
    ).toEqual(DEFAULT_TRAINING_SETTINGS);
  });

  it("gives the engine only the values that are set", () => {
    expect(planSettingsOf(DEFAULT_TRAINING_SETTINGS)).toEqual({});
    expect(
      planSettingsOf({
        zone2TargetPercent: 70,
        maxLongRideMin: null,
        maxWeeklyHours: 9,
        historyStat: "average",
        intensityBalance: "high",
      }),
    ).toEqual({ zone2TargetPercent: 70, maxHoursPerWeek: 9, intensityBalance: "high" });
  });
});
