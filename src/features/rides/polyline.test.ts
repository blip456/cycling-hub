import { describe, expect, it } from "vitest";
import { decodePolyline, routePath } from "./polyline";

describe("decodePolyline", () => {
  it("decodes the reference example from the polyline format", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns no points for empty or broken input", () => {
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline("_p~iF~ps|U_")).toEqual([]);
  });
});

describe("routePath", () => {
  it("fits the route inside the box with padding", () => {
    const path = routePath(
      [
        [51.0, 4.9],
        [51.1, 5.0],
        [51.05, 5.1],
      ],
      40,
      40,
      4,
    );
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(path.startsWith("M")).toBe(true);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(4 - 0.05);
      expect(n).toBeLessThanOrEqual(36 + 0.05);
    }
  });

  it("is empty with fewer than two points", () => {
    expect(routePath([[51, 4]], 40, 40)).toBe("");
  });
});
