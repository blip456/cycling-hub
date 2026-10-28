import { describe, expect, it } from "vitest";
import { addDays, addMonths, brusselsDate, diffDays, isIsoDate, weekdayIndex } from "./dates";

describe("isIsoDate", () => {
  it("accepts real dates and leap days", () => {
    expect(isIsoDate("2026-10-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("rejects impossible and malformed dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-10-28T10:00:00")).toBe(false);
    expect(isIsoDate("28-10-2026")).toBe(false);
    expect(isIsoDate(20261028)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("is exact across daylight saving changes", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
  it("returns null for invalid input", () => {
    expect(addDays("nope", 1)).toBeNull();
    expect(addDays("2026-10-28", 1.5)).toBeNull();
  });
});

describe("addMonths", () => {
  it("clamps to the end of a shorter month", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2028-03-31", -1)).toBe("2028-02-29");
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
  });
  it("crosses years both ways", () => {
    expect(addMonths("2026-01-15", -2)).toBe("2025-11-15");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("returns null for invalid input", () => {
    expect(addMonths("2026-02-30", 1)).toBeNull();
  });
});

describe("diffDays and weekdayIndex", () => {
  it("counts whole days over a daylight saving change", () => {
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffDays("2026-10-25", "2026-10-24")).toBe(-1);
    expect(diffDays("2026-10-25", "bad")).toBeNull();
  });
  it("numbers weekdays Monday 0 to Sunday 6", () => {
    expect(weekdayIndex("2026-10-26")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-28")).toBe(2); // Wednesday
    expect(weekdayIndex("2026-11-01")).toBe(6); // Sunday
    expect(weekdayIndex("bad")).toBeNull();
  });
});

describe("brusselsDate", () => {
  it("uses the Brussels calendar day, not the UTC day", () => {
    expect(brusselsDate(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
    expect(brusselsDate(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
    expect(brusselsDate(new Date("2026-01-01T00:30:00Z"))).toBe("2026-01-01");
  });
  it("handles the spring and autumn clock changes", () => {
    // 29 Mar 2026: CET to CEST at 01:00 UTC.
    expect(brusselsDate(new Date("2026-03-28T22:59:59Z"))).toBe("2026-03-28");
    expect(brusselsDate(new Date("2026-03-28T23:00:00Z"))).toBe("2026-03-29");
    expect(brusselsDate(new Date("2026-03-29T21:59:59Z"))).toBe("2026-03-29");
    expect(brusselsDate(new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30");
    // 25 Oct 2026: CEST to CET at 01:00 UTC, a 25 h day.
    expect(brusselsDate(new Date("2026-10-24T22:00:00Z"))).toBe("2026-10-25");
    expect(brusselsDate(new Date("2026-10-25T22:59:59Z"))).toBe("2026-10-25");
    expect(brusselsDate(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26");
  });
  it("knows leap days and rejects an invalid Date", () => {
    expect(brusselsDate(new Date("2028-02-29T12:00:00Z"))).toBe("2028-02-29");
    expect(brusselsDate(new Date("nope"))).toBeNull();
  });
});
