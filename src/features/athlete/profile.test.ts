import { describe, expect, it } from "vitest";
import {
  baselineSchema,
  ftpSchema,
  lthrSchema,
  maxHrSchema,
  profileSchema,
  restingHrSchema,
  weekdayFromDb,
  weekdaysFromDb,
  weekdaysToDb,
  weekdayToDb,
  weightEntrySchema,
} from "./profile";
import { WEEKDAYS } from "./dates";

const now = new Date("2026-10-28T12:00:00Z");
const schema = profileSchema(now);

describe("profileSchema", () => {
  it("accepts an empty profile: every field is optional", () => {
    expect(schema.parse({})).toEqual({
      displayName: null,
      birthYear: null,
      availableDays: [],
      goal: null,
    });
  });
  it("trims text and turns empty text into null", () => {
    const result = schema.parse({ displayName: "  Sam  ", goal: "   " });
    expect(result.displayName).toBe("Sam");
    expect(result.goal).toBeNull();
  });
  it("limits the name to 40 characters and the goal to 200", () => {
    expect(schema.safeParse({ displayName: "a".repeat(40) }).success).toBe(true);
    expect(schema.safeParse({ displayName: "a".repeat(41) }).success).toBe(false);
    expect(schema.safeParse({ goal: "g".repeat(200) }).success).toBe(true);
    expect(schema.safeParse({ goal: "g".repeat(201) }).success).toBe(false);
  });
  it("counts the limit after trimming", () => {
    expect(schema.safeParse({ displayName: ` ${"a".repeat(40)} ` }).success).toBe(true);
  });
  it("accepts birth years from 1920 to the current year", () => {
    expect(schema.safeParse({ birthYear: 1920 }).success).toBe(true);
    expect(schema.safeParse({ birthYear: 2026 }).success).toBe(true);
    expect(schema.safeParse({ birthYear: 1919 }).success).toBe(false);
    expect(schema.safeParse({ birthYear: 2027 }).success).toBe(false);
  });
  it("reads the current year in Brussels", () => {
    const newYearsEve = profileSchema(new Date("2026-12-31T23:30:00Z")); // Already 2027 in Brussels.
    expect(newYearsEve.safeParse({ birthYear: 2027 }).success).toBe(true);
    expect(schema.safeParse({ birthYear: 2027 }).success).toBe(false);
  });
  it("rejects non-integers and non-numbers for birth year", () => {
    expect(schema.safeParse({ birthYear: 1985.5 }).success).toBe(false);
    expect(schema.safeParse({ birthYear: "1985" }).success).toBe(false);
    expect(schema.safeParse({ birthYear: NaN }).success).toBe(false);
    expect(schema.parse({ birthYear: null }).birthYear).toBeNull();
  });
  it("keeps available days unique and in week order", () => {
    expect(schema.parse({ availableDays: ["sun", "wed", "mon", "wed"] }).availableDays).toEqual([
      "mon",
      "wed",
      "sun",
    ]);
    expect(schema.parse({ availableDays: [] }).availableDays).toEqual([]);
    expect(schema.safeParse({ availableDays: ["funday"] }).success).toBe(false);
  });
  it("gives plain-English messages", () => {
    const result = schema.safeParse({ displayName: "a".repeat(41), birthYear: 1800 });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Name can be at most 40 characters.");
    expect(messages).toContain("Enter a year from 1920.");
  });
});

describe("baseline limits", () => {
  it("accepts FTP from 50 to 600 W", () => {
    expect(ftpSchema.safeParse(50).success).toBe(true);
    expect(ftpSchema.safeParse(600).success).toBe(true);
    expect(ftpSchema.safeParse(49).success).toBe(false);
    expect(ftpSchema.safeParse(601).success).toBe(false);
    expect(ftpSchema.safeParse(250.5).success).toBe(false);
  });
  it("accepts max HR from 100 to 230 bpm", () => {
    expect(maxHrSchema.safeParse(100).success).toBe(true);
    expect(maxHrSchema.safeParse(230).success).toBe(true);
    expect(maxHrSchema.safeParse(99).success).toBe(false);
    expect(maxHrSchema.safeParse(231).success).toBe(false);
  });
  it("accepts LTHR from 90 to 220 bpm", () => {
    expect(lthrSchema.safeParse(90).success).toBe(true);
    expect(lthrSchema.safeParse(220).success).toBe(true);
    expect(lthrSchema.safeParse(89).success).toBe(false);
    expect(lthrSchema.safeParse(221).success).toBe(false);
  });
  it("says what is wrong in plain English", () => {
    expect(ftpSchema.safeParse(700).error?.issues[0]?.message).toBe("FTP can be at most 600 W.");
    expect(maxHrSchema.safeParse(50).error?.issues[0]?.message).toBe(
      "Max heart rate must be at least 100 bpm.",
    );
    expect(ftpSchema.safeParse("250").error?.issues[0]?.message).toBe("Enter FTP as a number.");
  });
});

describe("baselineSchema", () => {
  it("accepts any subset and fills the rest with null", () => {
    expect(baselineSchema.parse({})).toEqual({
      ftp: null,
      maxHr: null,
      restingHr: null,
      lthr: null,
    });
    expect(baselineSchema.parse({ ftp: 250 })).toEqual({
      ftp: 250,
      maxHr: null,
      restingHr: null,
      lthr: null,
    });
  });
  it("accepts a full baseline", () => {
    expect(baselineSchema.parse({ ftp: 250, maxHr: 190, restingHr: 48, lthr: 170 })).toEqual({
      ftp: 250,
      maxHr: 190,
      restingHr: 48,
      lthr: 170,
    });
  });
  it("rejects an LTHR above max HR on the lthr field", () => {
    const result = baselineSchema.safeParse({ maxHr: 150, lthr: 160 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["lthr"]);
  });
  it("accepts LTHR equal to max HR", () => {
    expect(baselineSchema.safeParse({ maxHr: 170, lthr: 170 }).success).toBe(true);
  });
  it("rejects out-of-range values", () => {
    expect(baselineSchema.safeParse({ ftp: 20 }).success).toBe(false);
  });
});

describe("restingHrSchema", () => {
  it("accepts 25 to 120 bpm", () => {
    expect(restingHrSchema.safeParse(25).success).toBe(true);
    expect(restingHrSchema.safeParse(120).success).toBe(true);
    expect(restingHrSchema.safeParse(24).success).toBe(false);
    expect(restingHrSchema.safeParse(121).success).toBe(false);
  });
});

describe("weightEntrySchema", () => {
  it("accepts 30 to 250 kg with one decimal", () => {
    expect(weightEntrySchema.parse({ kg: 30 }).kg).toBe(30);
    expect(weightEntrySchema.parse({ kg: 250 }).kg).toBe(250);
    expect(weightEntrySchema.parse({ kg: 72.5 }).kg).toBe(72.5);
    expect(weightEntrySchema.safeParse({ kg: 72.45 }).error?.issues[0]?.message).toBe(
      "Use at most one decimal.",
    );
    expect(weightEntrySchema.safeParse({ kg: 29.9 }).success).toBe(false);
    expect(weightEntrySchema.safeParse({ kg: 250.1 }).success).toBe(false);
    expect(weightEntrySchema.safeParse({ kg: NaN }).success).toBe(false);
    expect(weightEntrySchema.safeParse({ kg: "72" }).success).toBe(false);
  });
  it("limits the note to 100 characters, trimmed, empty is null", () => {
    expect(weightEntrySchema.parse({ kg: 70 }).note).toBeNull();
    expect(weightEntrySchema.parse({ kg: 70, note: "  " }).note).toBeNull();
    expect(weightEntrySchema.parse({ kg: 70, note: " ok " }).note).toBe("ok");
    expect(weightEntrySchema.safeParse({ kg: 70, note: "n".repeat(100) }).success).toBe(true);
    expect(weightEntrySchema.safeParse({ kg: 70, note: "n".repeat(101) }).success).toBe(false);
  });
  it("gives plain-English messages", () => {
    expect(weightEntrySchema.safeParse({ kg: 20 }).error?.issues[0]?.message).toBe(
      "Weight must be at least 30 kg.",
    );
  });
});

describe("weekday mapping", () => {
  it("maps Monday to Sunday onto 1 to 6 and 0", () => {
    expect(WEEKDAYS.map(weekdayToDb)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
  it("round-trips every weekday", () => {
    for (const day of WEEKDAYS) expect(weekdayFromDb(weekdayToDb(day))).toBe(day);
  });
  it("rejects numbers outside 0 to 6", () => {
    expect(weekdayFromDb(7)).toBeNull();
    expect(weekdayFromDb(-1)).toBeNull();
    expect(weekdayFromDb(null)).toBeNull();
  });
  it("converts lists: unique, database order up, week order down", () => {
    expect(weekdaysToDb(["sun", "wed", "mon", "wed"])).toEqual([0, 1, 3]);
    expect(weekdaysFromDb([0, 3, 1, 3])).toEqual(["mon", "wed", "sun"]);
    expect(weekdaysFromDb(null)).toEqual([]);
    expect(weekdaysFromDb([9, 2])).toEqual(["tue"]);
    expect(weekdaysToDb([])).toEqual([]);
  });
});
