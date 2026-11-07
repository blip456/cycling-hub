import { describe, expect, it } from "vitest";
import {
  entriesInRange,
  normalizeEntries,
  rangeStart,
  removeEntry,
  summarize,
  trend,
  trendForRange,
  upsertEntry,
  type WeightEntry,
} from "./weight";

const e = (date: string, kg: number): WeightEntry => ({ date, kg });

describe("normalizeEntries", () => {
  it("sorts oldest first and keeps the last duplicate of a date", () => {
    const result = normalizeEntries([
      e("2026-10-03", 80),
      e("2026-10-01", 81),
      e("2026-10-03", 79.5),
    ]);
    expect(result).toEqual([e("2026-10-01", 81), e("2026-10-03", 79.5)]);
  });
  it("drops invalid dates and weights, and does not change the input", () => {
    const input = [
      e("2026-02-30", 80),
      e("2026-10-01", NaN),
      e("2026-10-01", 0),
      e("2026-10-02", 80),
    ];
    const copy = [...input];
    expect(normalizeEntries(input)).toEqual([e("2026-10-02", 80)]);
    expect(input).toEqual(copy);
  });
  it("handles an empty list", () => {
    expect(normalizeEntries([])).toEqual([]);
  });
});

describe("upsertEntry and removeEntry", () => {
  it("adds a new date in order", () => {
    expect(upsertEntry([e("2026-10-01", 80), e("2026-10-03", 79)], e("2026-10-02", 79.5))).toEqual([
      e("2026-10-01", 80),
      e("2026-10-02", 79.5),
      e("2026-10-03", 79),
    ]);
  });
  it("replaces the entry of the same date, including its note", () => {
    const before = [{ date: "2026-10-01", kg: 80, note: "old" }];
    expect(upsertEntry(before, { date: "2026-10-01", kg: 79.2, note: null })).toEqual([
      { date: "2026-10-01", kg: 79.2, note: null },
    ]);
    expect(before[0]?.kg).toBe(80);
  });
  it("ignores an invalid entry", () => {
    expect(upsertEntry([e("2026-10-01", 80)], e("bad", 80))).toEqual([e("2026-10-01", 80)]);
  });
  it("removes a date and undo is an upsert of the removed entry", () => {
    const list = [e("2026-10-01", 80), e("2026-10-02", 79)];
    const removed = removeEntry(list, "2026-10-02");
    expect(removed).toEqual([e("2026-10-01", 80)]);
    expect(upsertEntry(removed, e("2026-10-02", 79))).toEqual(list);
  });
  it("leaves the list alone when the date has no entry", () => {
    expect(removeEntry([e("2026-10-01", 80)], "2026-10-05")).toEqual([e("2026-10-01", 80)]);
  });
});

describe("trend", () => {
  it("averages the 7 calendar days ending on each date", () => {
    const entries = [e("2026-10-01", 80), e("2026-10-02", 82), e("2026-10-04", 78)];
    const points = trend(entries);
    expect(points.map((p) => p.average)).toEqual([80, 81, 80]);
    expect(points.map((p) => p.kg)).toEqual([80, 82, 78]);
  });
  it("drops weigh-ins older than 6 days from the window", () => {
    const entries = [e("2026-10-01", 90), e("2026-10-07", 80), e("2026-10-08", 82)];
    const points = trend(entries);
    expect(points[1]?.average).toBe(85); // 1 Oct and 7 Oct are 6 days apart: both inside
    expect(points[2]?.average).toBe(81); // 1 Oct is 7 days before 8 Oct: out
  });
  it("copes with irregular dates and long gaps", () => {
    const points = trend([e("2026-01-01", 85), e("2026-06-01", 80)]);
    expect(points.map((p) => p.average)).toEqual([85, 80]);
  });
  it("counts duplicates of a date once", () => {
    const points = trend([e("2026-10-01", 80), e("2026-10-01", 82)]);
    expect(points).toEqual([{ date: "2026-10-01", kg: 82, average: 82 }]);
  });
  it("returns points only inside the bounds but averages over earlier entries", () => {
    const entries = [e("2026-09-30", 90), e("2026-10-02", 80)];
    const points = trend(entries, { from: "2026-10-01" });
    expect(points).toEqual([{ date: "2026-10-02", kg: 80, average: 85 }]);
    expect(trend(entries, { to: "2026-09-30" })).toHaveLength(1);
  });
  it("returns nothing for no entries", () => {
    expect(trend([])).toEqual([]);
  });
  it("works across the leap day and daylight saving changes", () => {
    const leap = trend([e("2028-02-28", 80), e("2028-02-29", 82), e("2028-03-01", 84)]);
    expect(leap.map((p) => p.average)).toEqual([80, 81, 82]);
    const dst = trend([e("2026-03-28", 80), e("2026-03-29", 82), e("2026-03-30", 84)]);
    expect(dst.map((p) => p.average)).toEqual([80, 81, 82]);
  });
});

describe("rangeStart", () => {
  it("is the last 7 days for a week", () => {
    expect(rangeStart("week", "2026-10-28")).toBe("2026-10-22");
  });
  it("starts the day after the same date one, three and twelve months back", () => {
    expect(rangeStart("month", "2026-10-28")).toBe("2026-09-29");
    expect(rangeStart("3months", "2026-10-28")).toBe("2026-07-29");
    expect(rangeStart("year", "2026-10-28")).toBe("2025-10-29");
  });
  it("clamps at the end of short months and on the leap day", () => {
    expect(rangeStart("month", "2026-03-31")).toBe("2026-03-01");
    expect(rangeStart("month", "2028-03-31")).toBe("2028-03-01");
    expect(rangeStart("year", "2028-02-29")).toBe("2027-03-01");
    expect(rangeStart("week", "2028-03-03")).toBe("2028-02-26");
  });
  it("crosses the year boundary", () => {
    expect(rangeStart("week", "2027-01-03")).toBe("2026-12-28");
    expect(rangeStart("3months", "2027-01-15")).toBe("2026-10-16");
  });
  it("covers the clock change days", () => {
    expect(rangeStart("week", "2026-03-29")).toBe("2026-03-23");
    expect(rangeStart("week", "2026-10-25")).toBe("2026-10-19");
  });
  it("returns null for an invalid today", () => {
    expect(rangeStart("week", "x")).toBeNull();
    expect(rangeStart("year", "2026-02-31")).toBeNull();
  });
});

describe("entriesInRange and trendForRange", () => {
  const entries = [
    e("2026-10-20", 81),
    e("2026-10-22", 80),
    e("2026-10-28", 79),
    e("2026-10-30", 70),
  ];
  it("includes both ends and leaves out future dates", () => {
    expect(entriesInRange(entries, "week", "2026-10-28")).toEqual([
      e("2026-10-22", 80),
      e("2026-10-28", 79),
    ]);
  });
  it("returns an empty list for an invalid today", () => {
    expect(entriesInRange(entries, "week", "bad")).toEqual([]);
    expect(trendForRange(entries, "week", "bad")).toEqual([]);
  });
  it("gives trend points for the range", () => {
    const points = trendForRange(entries, "week", "2026-10-28");
    expect(points.map((p) => p.date)).toEqual(["2026-10-22", "2026-10-28"]);
    expect(points[0]?.average).toBe(80.5); // 20 Oct is inside the 7 days before 22 Oct
  });
});

describe("summarize", () => {
  const entries = [
    e("2026-09-01", 83),
    e("2026-10-22", 80.4),
    e("2026-10-25", 79.9),
    e("2026-10-28", 79.3),
  ];
  it("gives latest, change, count, min and max", () => {
    expect(summarize(entries, "week", "2026-10-28")).toEqual({
      latest: e("2026-10-28", 79.3),
      count: 3,
      change: -1.1,
      min: 79.3,
      max: 80.4,
    });
  });
  it("uses the wider range when asked", () => {
    expect(summarize(entries, "year", "2026-10-28").change).toBe(-3.7);
  });
  it("has no change with one entry in range, but still a latest", () => {
    const result = summarize(entries, "week", "2026-10-23");
    expect(result.count).toBe(1);
    expect(result.change).toBeNull();
    expect(result.latest).toEqual(e("2026-10-22", 80.4));
  });
  it("keeps the latest outside the range", () => {
    const result = summarize([e("2026-01-05", 85)], "week", "2026-10-28");
    expect(result).toEqual({
      latest: e("2026-01-05", 85),
      count: 0,
      change: null,
      min: null,
      max: null,
    });
  });
  it("handles no entries", () => {
    expect(summarize([], "month", "2026-10-28")).toEqual({
      latest: null,
      count: 0,
      change: null,
      min: null,
      max: null,
    });
  });
  it("ignores entries dated after today", () => {
    expect(summarize([e("2026-10-29", 70)], "week", "2026-10-28").latest).toBeNull();
  });
});
