import { describe, expect, it } from "vitest";
import { floor5, startMinutes, weeklyBudget } from "./budget";
import { planStructure } from "./calendar";

const hours = (minutes: readonly number[]): number[] =>
  minutes.map((m) => Math.round((m / 60) * 100) / 100);

describe("weekly hours (section 5)", () => {
  it("rounds down to 5 minutes", () => {
    expect(floor5(194.4)).toBe(190);
    expect(floor5(195)).toBe(195);
    expect(floor5(4.9)).toBe(0);
  });

  it("starts at 75 % of H, or from the recent average within 60 to 90 % of H", () => {
    expect(startMinutes(4)).toBe(180);
    expect(startMinutes(8, 2)).toBeCloseTo(288); // 1.1 x 2 h = 132 min, lifted to 60 % of 480
    expect(startMinutes(8, 7.5)).toBeCloseTo(432); // 90 % of 480
    expect(startMinutes(8, 6)).toBeCloseTo(396); // 1.1 x 360
    expect(startMinutes(8, 0)).toBe(360);
  });

  it("follows the doc for the 4 h plan: +8 % a week, recovery 70 %, at H from week 6", () => {
    const { weeks, taperWeeks } = planStructure({ today: "2026-10-26" });
    const budget = weeklyBudget({ weeks, taperWeeks, hoursPerWeek: 4 });
    expect(hours(budget)).toEqual([3, 3.17, 3.42, 2.33, 3.75, 4, 4, 2.75, 4, 4, 4, 2.75]);
  });

  it("holds the hours of the previous loading week in a held week", () => {
    const { weeks, taperWeeks } = planStructure({ today: "2026-10-26" });
    const held = weeklyBudget({ weeks, taperWeeks, hoursPerWeek: 5, holdWeeks: [6] });
    const normal = weeklyBudget({ weeks, taperWeeks, hoursPerWeek: 5 });
    expect(held[5]).toBe(normal[4]);
    expect(normal[5]).toBeGreaterThan(normal[4] ?? 0);
  });

  it("uses the taper fractions of H with an event", () => {
    const { weeks, taperWeeks } = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-17", duration: "3-to-6h" },
    });
    const budget = weeklyBudget({ weeks, taperWeeks, hoursPerWeek: 8 });
    expect(budget.slice(10)).toEqual([360, 215]);
    const oneWeek = planStructure({
      today: "2026-10-26",
      event: { name: "A", date: "2027-01-17", duration: "under-3h" },
    });
    expect(
      weeklyBudget({ weeks: oneWeek.weeks, taperWeeks: oneWeek.taperWeeks, hoursPerWeek: 8 }).at(
        -1,
      ),
    ).toBe(240);
  });

  it("never goes above H and never grows more than 10 % over the previous loading week", () => {
    const { weeks, taperWeeks } = planStructure({ today: "2026-10-26" });
    for (const h of [3, 4.5, 6, 8, 10, 13, 16]) {
      const budget = weeklyBudget({ weeks, taperWeeks, hoursPerWeek: h });
      let previous: number | null = null;
      weeks.forEach((w, i) => {
        const minutes = budget[i] ?? 0;
        expect(minutes).toBeLessThanOrEqual(h * 60);
        if (w.type === "loading") {
          if (previous !== null) expect(minutes).toBeLessThanOrEqual(previous * 1.1);
          previous = minutes;
        }
      });
    }
  });
});
