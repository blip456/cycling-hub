import { describe, expect, it } from "vitest";
import { baselineSchema, ftpSchema, lthrSchema, maxHrSchema, profileSchema } from "./profile";

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
  it("limits the name to 60 characters and the goal to 500", () => {
    expect(schema.safeParse({ displayName: "a".repeat(60) }).success).toBe(true);
    expect(schema.safeParse({ displayName: "a".repeat(61) }).success).toBe(false);
    expect(schema.safeParse({ goal: "g".repeat(500) }).success).toBe(true);
    expect(schema.safeParse({ goal: "g".repeat(501) }).success).toBe(false);
  });
  it("counts the limit after trimming", () => {
    expect(schema.safeParse({ displayName: ` ${"a".repeat(60)} ` }).success).toBe(true);
  });
  it("accepts birth years from 1900 to the current year", () => {
    expect(schema.safeParse({ birthYear: 1900 }).success).toBe(true);
    expect(schema.safeParse({ birthYear: 2026 }).success).toBe(true);
    expect(schema.safeParse({ birthYear: 1899 }).success).toBe(false);
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
    const result = schema.safeParse({ displayName: "a".repeat(61), birthYear: 1800 });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Name can be at most 60 characters.");
    expect(messages).toContain("Enter a year from 1900.");
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
    expect(baselineSchema.parse({})).toEqual({ ftp: null, maxHr: null, lthr: null });
    expect(baselineSchema.parse({ ftp: 250 })).toEqual({ ftp: 250, maxHr: null, lthr: null });
  });
  it("accepts a full baseline", () => {
    expect(baselineSchema.parse({ ftp: 250, maxHr: 190, lthr: 170 })).toEqual({
      ftp: 250,
      maxHr: 190,
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
