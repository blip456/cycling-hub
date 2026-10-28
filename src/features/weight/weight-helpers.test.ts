import { describe, expect, it } from "vitest";
import { niceTicks } from "./chart-scale";
import { formatChange, formatDay, formatKg, formatShortDay, parseKg } from "./format";
import { averageChange } from "./trend";

describe("format", () => {
  it("writes dates as in the wireframes", () => {
    expect(formatDay("2026-10-28")).toBe("Wed 28 Oct");
    expect(formatDay("2026-10-25")).toBe("Sun 25 Oct");
    expect(formatShortDay("2026-09-29")).toBe("29 Sep");
    expect(formatDay("nonsense")).toBe("nonsense");
  });
  it("writes one decimal and a real minus sign", () => {
    expect(formatKg(75)).toBe("75.0");
    expect(formatChange(-0.6)).toBe("−0.6");
    expect(formatChange(0.4)).toBe("+0.4");
    expect(formatChange(0)).toBe("0.0");
  });
  it("parses a weight with a comma or a dot", () => {
    expect(parseKg("74,6")).toBe(74.6);
    expect(parseKg(" 74.6 ")).toBe(74.6);
    expect(parseKg("")).toBeNaN();
    expect(parseKg("abc")).toBeNaN();
  });
});

describe("niceTicks", () => {
  it("covers the data with round values", () => {
    const ticks = niceTicks(74.3, 76.1);
    expect(ticks[0]).toBeLessThanOrEqual(74.3);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(76.1);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });
  it("gives a range for a flat line", () => {
    const ticks = niceTicks(75, 75);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBeLessThan(75);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(75);
  });
});

describe("averageChange", () => {
  it("is the last average minus the first, to 0.1", () => {
    expect(
      averageChange([
        { date: "2026-10-01", kg: 76, average: 76 },
        { date: "2026-10-28", kg: 75, average: 75.4 },
      ]),
    ).toBe(-0.6);
  });
  it("is null with fewer than two points", () => {
    expect(averageChange([])).toBeNull();
    expect(averageChange([{ date: "2026-10-01", kg: 76, average: 76 }])).toBeNull();
  });
});
