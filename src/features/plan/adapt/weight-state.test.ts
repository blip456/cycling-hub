import { describe, expect, it } from "vitest";
import { addDays, type IsoDate, type WeightEntry } from "@/features/athlete";
import type { WeekType } from "../engine";
import { weightState, type WeightStateGoal } from "./weight-state";

const START = "2026-10-26"; // Monday of week 1
const LOADING: WeekType[] = [
  "loading",
  "loading",
  "loading",
  "recovery",
  "loading",
  "loading",
  "loading",
  "recovery",
  "loading",
  "loading",
  "loading",
  "recovery",
];
const GOAL: WeightStateGoal = { startKg: 86, planStart: START, weekTypes: LOADING };

function monday(week: number): IsoDate {
  return addDays(START, 7 * (week - 1)) as IsoDate;
}

/** A weigh-in every day from `from` to `to`, falling `kgPerWeek` a week from `startKg`. */
function daily(from: IsoDate, to: IsoDate, kgPerWeek: number, startKg = 90): WeightEntry[] {
  const out: WeightEntry[] = [];
  let index = 0;
  for (let d = from; d <= to; d = addDays(d, 1) as IsoDate) {
    out.push({ date: d, kg: startKg - (kgPerWeek / 7) * index });
    index += 1;
  }
  return out;
}

const FROM = addDays(START, -28) as IsoDate;

describe("weightState: the cap and the checks", () => {
  it("uses 0.5 % of the start weight a week, at most 0.75 %", () => {
    const entries = daily(FROM, monday(1), 0.4);
    expect(weightState(entries, GOAL, monday(1)).capKgPerWeek).toBeCloseTo(0.43, 2);
    expect(weightState(entries, { ...GOAL, capPercent: 2 }, monday(1)).capKgPerWeek).toBeCloseTo(
      0.645,
      3,
    );
  });

  it("checks every Monday up to today, from the plan start", () => {
    const state = weightState(daily(FROM, monday(4), 0.4), GOAL, "2026-11-18");
    expect(state.checks.map((c) => c.week)).toEqual([1, 2, 3, 4]);
    expect(state.checks.every((c) => c.rateKgPerWeek !== null)).toBe(true);
    expect(state.checks[0]?.rateKgPerWeek).toBeCloseTo(0.4, 5);
  });

  it("on track: a rate between 0 and the cap changes nothing", () => {
    const state = weightState(daily(FROM, monday(6), 0.4), GOAL, monday(6));
    expect(state.state).toBe("on-track");
    expect(state.holdWeeks).toEqual([]);
    expect(state.extraEasyRideWeeks).toEqual([]);
    expect(state.notice).toBeNull();
  });

  it("not enough data: fewer than 3 weigh-ins in a window gives no state and no change", () => {
    const entries = [
      { date: "2026-10-27", kg: 86 },
      { date: "2026-10-28", kg: 85.9 },
    ];
    const state = weightState(entries, GOAL, monday(3));
    expect(state.state).toBe("not-enough-data");
    expect(state.checks.every((c) => c.rateKgPerWeek === null)).toBe(true);
    expect(state.holdWeeks).toEqual([]);
    expect(state.extraEasyRideWeeks).toEqual([]);
    expect(weightState([], GOAL, monday(3)).state).toBe("not-enough-data");
  });

  it("a check only reads weigh-ins up to its own Monday", () => {
    const early = daily(FROM, monday(2), 0.4);
    const later = [...early, ...daily(addDays(monday(2), 1) as IsoDate, monday(6), 1.5, 80)];
    expect(weightState(later, GOAL, monday(6)).checks.slice(0, 2)).toEqual(
      weightState(early, GOAL, monday(6)).checks.slice(0, 2),
    );
  });
});

describe("weightState: faster than the cap", () => {
  const fast = daily(FROM, monday(8), 0.8);

  it("one fast check is not enough", () => {
    const state = weightState(fast, GOAL, monday(1));
    expect(state.checks).toHaveLength(1);
    expect(state.holdWeeks).toEqual([]);
    expect(state.state).toBe("on-track");
  });

  it("two checks in a row hold the week of the second check and the next", () => {
    const state = weightState(fast, GOAL, monday(2));
    expect(state.state).toBe("faster-than-cap");
    expect(state.holdWeeks).toEqual([2, 3]);
    expect(state.notice).toBe(
      "Your weight trend fell 0.8 kg a week in the last 2 weeks. The plan holds your training hours this week.",
    );
  });

  it("keeps holding while the trend stays fast, and never past the last week", () => {
    expect(weightState(fast, GOAL, monday(3)).holdWeeks).toEqual([2, 3, 4]);
    const all = weightState(daily(FROM, monday(12), 0.8), GOAL, monday(12));
    expect(all.holdWeeks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("a rate exactly at the cap is on track", () => {
    expect(weightState(daily(FROM, monday(6), 0.4299), GOAL, monday(6)).holdWeeks).toEqual([]);
  });
});

describe("weightState: stalled", () => {
  const flat = daily(FROM, monday(12), 0);

  it("two flat checks do nothing, the third adds one easy ride that week", () => {
    expect(weightState(flat, GOAL, monday(2)).extraEasyRideWeeks).toEqual([]);
    const third = weightState(flat, GOAL, monday(3));
    expect(third.state).toBe("stalled");
    expect(third.extraEasyRideWeeks).toEqual([3]);
    expect(third.notice).toContain("flat for 3 weeks");
  });

  it("is at most 0.05 kg a week", () => {
    expect(weightState(daily(FROM, monday(3), 0.049), GOAL, monday(3)).extraEasyRideWeeks).toEqual([
      3,
    ]);
    expect(weightState(daily(FROM, monday(3), 0.06), GOAL, monday(3)).extraEasyRideWeeks).toEqual(
      [],
    );
  });

  it("at most once every 3 weeks, and never in a recovery or taper week", () => {
    const state = weightState(flat, GOAL, monday(12));
    // Weeks 4, 8 and 12 are recovery weeks; 3, 6 and 9 are the loading weeks three apart.
    expect(state.extraEasyRideWeeks).toEqual([3, 6, 9]);
    const recoveryThird = weightState(
      flat,
      { ...GOAL, weekTypes: ["loading", "loading", "recovery", "loading", ...LOADING.slice(4)] },
      monday(12),
    );
    expect(recoveryThird.extraEasyRideWeeks[0]).toBe(4);
  });

  it("gaining weight counts as stalled", () => {
    expect(weightState(daily(FROM, monday(3), -0.3), GOAL, monday(3)).state).toBe("stalled");
  });

  it("a hold week never also gets an extra ride", () => {
    const state = weightState(daily(FROM, monday(6), 0.8), GOAL, monday(6));
    expect(state.extraEasyRideWeeks.filter((w) => state.holdWeeks.includes(w))).toEqual([]);
  });
});
