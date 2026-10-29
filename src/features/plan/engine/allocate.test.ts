import { describe, expect, it } from "vitest";
import { allocateMinutes, assignDays, dayIndices } from "./allocate";

const MON = 0;
const TUE = 1;
const WED = 2;
const THU = 3;
const FRI = 4;
const SAT = 5;
const SUN = 6;

function days(
  input: Partial<Parameters<typeof assignDays>[0]> & { days: number[]; rides: number },
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const a of assignDays({
    hasLong: true,
    hasQ1: true,
    hasQ2: false,
    longIsHard: false,
    ...input,
  })) {
    (out[a.slot] ??= []).push(a.day);
  }
  return out;
}

describe("assignDays (section 6)", () => {
  it("puts the long ride on Sunday and Q1 on Wednesday", () => {
    expect(days({ days: [TUE, WED, SAT, SUN], rides: 3 })).toEqual({
      q1: [WED],
      easy: [SAT],
      long: [SUN],
    });
  });

  it("puts Q2 two days from Q1 and the long ride (Friday)", () => {
    expect(days({ days: [TUE, WED, FRI, SAT, SUN], rides: 5, hasQ2: true })).toEqual({
      easy: [TUE, SAT],
      q1: [WED],
      q2: [FRI],
      long: [SUN],
    });
  });

  it("uses Saturday, then the last available day, for the long ride", () => {
    expect(days({ days: [WED, SAT], rides: 2 }).long).toEqual([SAT]);
    expect(days({ days: [TUE, THU], rides: 2 }).long).toEqual([THU]);
  });

  it("takes the available day nearest to Wednesday for Q1, a tie goes to the earlier day", () => {
    expect(days({ days: [TUE, THU, SUN], rides: 3 }).q1).toEqual([TUE]);
    expect(days({ days: [MON, FRI, SUN], rides: 3 }).q1).toEqual([MON]);
  });

  it("keeps Q1 and Q2 a day away from a hard long ride", () => {
    const result = days({ days: [FRI, SAT], rides: 2, longIsHard: true });
    expect(result.long).toEqual([SAT]);
    expect(result.q1).toBeUndefined();
  });

  it("makes Q2 an easy ride when no day is far enough", () => {
    const result = days({ days: [THU, FRI, SAT, SUN], rides: 4, hasQ2: true });
    expect(result.q2).toBeUndefined();
    expect(result.long).toEqual([SUN]);
    expect(result.q1).toEqual([THU]);
    expect(result.easy).toEqual([FRI, SAT]);
  });

  it("places easy rides farthest from the other rides, a tie to the later day", () => {
    expect(days({ days: [MON, TUE, WED, THU, FRI, SAT, SUN], rides: 4 })).toEqual({
      easy: [MON, FRI],
      q1: [WED],
      long: [SUN],
    });
  });

  it("drops easy rides, then Q2, then Q1 when there are fewer rides than slots", () => {
    expect(days({ days: [TUE, WED, FRI, SAT, SUN], rides: 3, hasQ2: true })).toEqual({
      q1: [WED],
      q2: [FRI],
      long: [SUN],
    });
    expect(days({ days: [TUE, WED, FRI, SAT, SUN], rides: 2, hasQ2: true })).toEqual({
      q1: [WED],
      long: [SUN],
    });
    expect(days({ days: [TUE, WED, FRI, SAT, SUN], rides: 1, hasQ2: true })).toEqual({
      long: [SUN],
    });
  });

  it("never gives more rides than days, and sorts the result by day", () => {
    const result = assignDays({
      days: [WED, SUN],
      rides: 5,
      hasLong: true,
      hasQ1: true,
      hasQ2: true,
      longIsHard: false,
    });
    expect(result.map((a) => a.day)).toEqual([WED, SUN]);
  });

  it("maps weekdays to indices", () => {
    expect(dayIndices(["sun", "mon", "mon", "wed"])).toEqual([0, 2, 6]);
  });
});

describe("allocateMinutes (section 6)", () => {
  const item = (weight: number, min: number, max: number) => ({ weight, min, max });

  it("shares by weight, rounds down to 5 and hands out blocks by the largest remainder", () => {
    // Doc plan B week 1: 360 minutes for long, Q1, Q2 and two easy rides.
    const result = allocateMinutes(
      [
        item(1, 45, 120),
        item(1.5, 60, 120),
        item(1.3, 60, 120),
        item(1, 45, 120),
        item(2.8, 120, 270),
      ].sort(() => 0),
      360,
    );
    expect(result.reduce((a, b) => a + b, 0)).toBe(360);
    expect(result.every((m) => m % 5 === 0)).toBe(true);
  });

  it("reproduces the doc's week 1 of plan B", () => {
    // Order by day: easy Tue, Q1 Wed, Q2 Fri, easy Sat, long Sun.
    const result = allocateMinutes(
      [
        item(1, 45, 120),
        item(1.5, 60, 120),
        item(1.3, 60, 120),
        item(1, 45, 120),
        item(2.8, 120, 270),
      ],
      360,
    );
    expect(result).toEqual([50, 70, 60, 45, 135]);
  });

  it("clamps to the minimum and shares the rest among the others", () => {
    expect(
      allocateMinutes([item(2.2, 90, 180), item(1.5, 45, 90), item(1.2, 30, 90)], 180),
    ).toEqual([90, 50, 40]);
  });

  it("clamps to the maximum and lets a minimum-clamped item grow again", () => {
    expect(
      allocateMinutes(
        [
          item(1, 30, 60),
          item(1.5, 90, 105),
          item(1, 30, 60),
          item(1, 30, 60),
          item(1, 30, 60),
          item(2.8, 45, 140),
        ],
        475,
      ),
    ).toEqual([60, 95, 60, 60, 60, 140]);
  });

  it("does not refill a ceiling when every item is at its maximum", () => {
    const result = allocateMinutes([item(1, 30, 60), item(1, 30, 60)], 300);
    expect(result).toEqual([60, 60]);
  });

  it("never exceeds the total when the minimums fit", () => {
    for (let total = 135; total <= 600; total += 5) {
      const result = allocateMinutes(
        [item(2.8, 60, 300), item(1.5, 45, 100), item(1, 30, 90)],
        total,
      );
      expect(result.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(total);
    }
  });
});
