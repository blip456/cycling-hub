import { describe, expect, it } from "vitest";
import { HISTORY_WEEKS, recentWeeklyHours, type HistoryRide } from "./history";

/** Monday 2026-11-16: the complete weeks before it end on Sunday 2026-11-15. */
const TODAY = "2026-11-18";

/** One ride in the week that starts `weeksAgo` weeks before the running week's Monday, on its Wednesday. */
function weekRide(weeksAgo: number, hours: number, extra: Partial<HistoryRide> = {}): HistoryRide {
  const monday = new Date(Date.UTC(2026, 10, 16) - weeksAgo * 7 * 86_400_000);
  const wednesday = new Date(monday.getTime() + 2 * 86_400_000);
  return { date: wednesday.toISOString().slice(0, 10), movingMinutes: hours * 60, ...extra };
}

describe("weekly riding hours of the last 24 weeks (rules section 5)", () => {
  const rides = [weekRide(1, 6), weekRide(2, 4), weekRide(3, 8), weekRide(4, 2), weekRide(5, 20)];

  it("is the median or the average of the weeks, as asked", () => {
    expect(recentWeeklyHours(rides, TODAY, "median")).toBe(6);
    expect(recentWeeklyHours(rides, TODAY, "average")).toBe(8);
  });

  it("averages the two middle weeks for an even count", () => {
    expect(recentWeeklyHours(rides.slice(0, 4), TODAY, "median")).toBe(5);
  });

  it("leaves out the running week and weeks older than 24 weeks", () => {
    const extra = [{ date: "2026-11-17", movingMinutes: 600 }, weekRide(HISTORY_WEEKS + 1, 30)];
    expect(recentWeeklyHours([...rides, ...extra], TODAY, "median")).toBe(6);
    expect(recentWeeklyHours([weekRide(HISTORY_WEEKS, 5), weekRide(1, 7)], TODAY, "average")).toBe(
      (5 + 7 + 0 * (HISTORY_WEEKS - 2)) / HISTORY_WEEKS,
    );
  });

  it("counts empty weeks after the first ride, but not the weeks before it", () => {
    // Rides 5 and 1 weeks ago: weeks 5 to 1 are counted, the weeks 2 to 4 are empty (0 h).
    const sparse = [weekRide(5, 5), weekRide(1, 5)];
    expect(recentWeeklyHours(sparse, TODAY, "median")).toBe(0);
    expect(recentWeeklyHours(sparse, TODAY, "average")).toBe(2);
  });

  it("adds the rides of one week together and ignores commutes and empty rides", () => {
    const week = [
      weekRide(1, 3),
      weekRide(1, 3, { date: "2026-11-14" }),
      weekRide(1, 5, { commute: true }),
      weekRide(1, 0),
      weekRide(2, 6),
    ];
    expect(recentWeeklyHours(week, TODAY, "median")).toBe(6);
  });

  it("is undefined with fewer than 2 weeks with rides", () => {
    expect(recentWeeklyHours([], TODAY, "median")).toBeUndefined();
    expect(recentWeeklyHours([weekRide(1, 6)], TODAY, "median")).toBeUndefined();
    expect(
      recentWeeklyHours([weekRide(1, 6), weekRide(1, 2, { commute: true })], TODAY, "average"),
    ).toBeUndefined();
  });

  it("gives the same answer for any day of the running week", () => {
    const days = ["2026-11-16", "2026-11-18", "2026-11-22"] as const;
    const values = days.map((day) => recentWeeklyHours(rides, day, "median"));
    expect(new Set(values).size).toBe(1);
  });
});
