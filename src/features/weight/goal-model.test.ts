import { describe, expect, it } from "vitest";
import type { WeightEntry } from "@/features/athlete";
import {
  capKgPerWeek,
  checkGoal,
  currentAverage,
  goalStanding,
  weeklyTrendLoss,
} from "./goal-model";

/** One weigh-in every 3 days from 29 Sep, falling 0.14 kg a week, to 75.1 kg on 28 Oct. */
function steadyLoss(): WeightEntry[] {
  const entries: WeightEntry[] = [];
  const start = Date.UTC(2026, 8, 29);
  for (let day = 0; day <= 29; day += 1) {
    const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
    entries.push({ date, kg: Math.round((75.7 - (0.14 / 7) * day) * 100) / 100 });
  }
  return entries;
}

describe("weight goal model", () => {
  it("takes the cap as 0.5 % of the body weight", () => {
    expect(capKgPerWeek(75.1)).toBeCloseTo(0.3755, 4);
  });

  it("has no current average without weigh-ins", () => {
    expect(currentAverage([], "2026-10-28")).toBeNull();
  });

  it("measures the loss per week over the last 4 weeks", () => {
    expect(weeklyTrendLoss(steadyLoss(), "2026-10-28")).toBeCloseTo(0.14, 1);
  });

  it("has no pace with less than two weeks of data", () => {
    const few = steadyLoss().filter((e) => e.date >= "2026-10-20");
    expect(weeklyTrendLoss(few, "2026-10-28")).toBeNull();
    expect(weeklyTrendLoss([], "2026-10-28")).toBeNull();
  });

  it("reports a gain as a negative loss", () => {
    const gaining = steadyLoss().map((e, i) => ({ ...e, kg: 75 + i * 0.05 }));
    expect(weeklyTrendLoss(gaining, "2026-10-28") ?? 0).toBeLessThan(0);
  });

  describe("standing against the goal", () => {
    const goal = { targetKg: 73, targetDate: "2026-12-13" };

    it("is behind when the trend is slower than the pace needed", () => {
      const standing = goalStanding(goal, steadyLoss(), "2026-10-28");
      expect(standing?.state).toBe("behind");
      expect(standing && "neededKgPerWeek" in standing ? standing.neededKgPerWeek : 0).toBeCloseTo(
        0.31,
        1,
      );
    });

    it("is on pace when the trend matches the pace needed", () => {
      const standing = goalStanding(
        { targetKg: 74.5, targetDate: "2026-12-13" },
        steadyLoss(),
        "2026-10-28",
      );
      expect(standing?.state).toBe("on-pace");
    });

    it("is ahead of the cap when the trend is faster than the cap", () => {
      const fast = steadyLoss().map((e, i) => ({ ...e, kg: 80 - i * 0.2 }));
      expect(goalStanding(goal, fast, "2026-10-28")?.state).toBe("ahead-of-cap");
    });

    it("says reached at or below the target", () => {
      expect(
        goalStanding({ targetKg: 76, targetDate: "2026-12-13" }, steadyLoss(), "2026-10-28"),
      ).toEqual({
        state: "reached",
      });
    });

    it("has no standing without weigh-ins, and no pace with few", () => {
      expect(goalStanding(goal, [], "2026-10-28")).toBeNull();
      const standing = goalStanding(goal, [{ date: "2026-10-28", kg: 75 }], "2026-10-28");
      expect(standing?.state).toBe("unknown");
    });
  });

  describe("checking a goal against the cap", () => {
    const base = { startKg: 75.1, today: "2026-10-28" };

    it("accepts a date that needs no more than the cap", () => {
      expect(checkGoal({ ...base, targetKg: 74, targetDate: "2026-12-13" })).toEqual({ ok: true });
    });

    it("rejects a date that is too soon and offers the earliest date", () => {
      const check = checkGoal({ ...base, targetKg: 72, targetDate: "2026-12-13" });
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.field).toBe("date");
      expect(check.message).toMatch(/needs 0\.46 kg a week\. The cap is 0\.38 kg\./);
      expect(check.message).toContain("The earliest date for 72.0 kg is");
      expect(check.earliestDate && check.earliestDate > "2026-12-13").toBe(true);
      // The earliest date itself is accepted.
      expect(checkGoal({ ...base, targetKg: 72, targetDate: check.earliestDate ?? "" })).toEqual({
        ok: true,
      });
    });

    it("rejects a target that is not below the current weight", () => {
      const check = checkGoal({ ...base, targetKg: 76, targetDate: "2027-03-01" });
      expect(check).toMatchObject({ ok: false, field: "target" });
    });

    it("rejects a date that is not after today", () => {
      expect(checkGoal({ ...base, targetKg: 74, targetDate: "2026-10-28" })).toMatchObject({
        ok: false,
        field: "date",
      });
    });
  });
});
