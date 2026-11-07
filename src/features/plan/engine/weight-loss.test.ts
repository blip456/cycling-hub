import { describe, expect, it } from "vitest";
import { weightPlan, weightRateCap } from "./weight-loss";

const base = { startDate: "2026-10-26", weeks: 12 } as const;

describe("weight loss target (section 9)", () => {
  it("caps the weekly rate at 0.5 % of the start weight, at most 0.75 %", () => {
    expect(weightRateCap(86)).toBeCloseTo(0.43);
    expect(weightRateCap(86, 0.75)).toBeCloseTo(0.645);
    expect(weightRateCap(86, 2)).toBeCloseTo(0.645);
    expect(weightRateCap(100, 0.1)).toBeCloseTo(0.1);
  });

  it("uses the cap and shows the earliest date when the target date needs more", () => {
    const { plan, warnings } = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 80, targetDate: "2027-01-17" },
    });
    expect(warnings).toEqual([]);
    expect(plan).toMatchObject({
      capKgPerWeek: 0.43,
      neededKgPerWeek: 0.5,
      plannedKgPerWeek: 0.43,
      capped: true,
      earliestWeek: 14,
      earliestDate: "2027-01-31",
    });
    expect(plan?.message).toBe(
      "At a safe rate of 0.43 kg a week, 80 kg is reachable around week 14 (2027-01-31), not by 2027-01-17.",
    );
  });

  it("draws the planned line start minus rate times weeks, never below the target", () => {
    const { plan } = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 80, targetDate: "2027-01-17" },
    });
    expect(plan?.line).toHaveLength(12);
    expect(plan?.line[0]).toEqual({ week: 1, date: "2026-11-01", kg: 85.6 });
    expect(plan?.line.map((p) => p.kg).filter((_, i) => [3, 7, 11].includes(i))).toEqual([
      84.3, 82.6, 80.8,
    ]);
    const quick = weightPlan({
      ...base,
      weeks: 20,
      startKg: 86,
      goal: { targetKg: 84, targetDate: "2026-12-20" },
    });
    expect(quick.plan?.line.at(-1)?.kg).toBe(84);
  });

  it("uses the needed rate when it is within the cap", () => {
    const { plan } = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 82, targetDate: "2027-01-17" },
    });
    expect(plan?.capped).toBe(false);
    expect(plan?.plannedKgPerWeek).toBe(0.33);
    expect(plan?.message).toContain("within the cap");
  });

  it("raises the cap when the setting allows more", () => {
    const { plan } = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 80, targetDate: "2027-01-17" },
      capPercent: 0.75,
    });
    expect(plan?.plannedKgPerWeek).toBe(0.5);
    expect(plan?.capped).toBe(false);
  });

  it("asks for another target when it is not below the current weight", () => {
    for (const targetKg of [86, 90]) {
      const result = weightPlan({
        ...base,
        startKg: 86,
        goal: { targetKg, targetDate: "2027-01-17" },
      });
      expect(result.plan).toBeNull();
      expect(result.warnings.map((w) => w.code)).toEqual(["weight-target-not-below"]);
    }
  });

  it("draws no line when the target date is not after the start", () => {
    const result = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 80, targetDate: "2026-10-20" },
    });
    expect(result.plan).toBeNull();
    expect(result.warnings.map((w) => w.code)).toEqual(["weight-date-passed"]);
  });

  it("gives no calorie, food or medical advice in its messages", () => {
    const { plan } = weightPlan({
      ...base,
      startKg: 86,
      goal: { targetKg: 80, targetDate: "2027-01-17" },
    });
    expect(plan?.message).not.toMatch(/calor|food|eat|diet|health|doctor/i);
  });
});
