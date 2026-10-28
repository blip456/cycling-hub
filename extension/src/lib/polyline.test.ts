import { describe, expect, it } from "vitest";
import {
  encodePolyline,
  MAX_POLYLINE_POINTS,
  routePolyline,
  simplify,
  type LatLng,
} from "./polyline";

describe("encodePolyline", () => {
  it("encodes Google's reference vector", () => {
    expect(
      encodePolyline([
        [38.5, -120.2],
        [40.7, -120.95],
        [43.252, -126.453],
      ]),
    ).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("encodes nothing as an empty string", () => {
    expect(encodePolyline([])).toBe("");
  });
});

/** A wiggly synthetic track of n points. */
function track(n: number): LatLng[] {
  return Array.from({ length: n }, (_, i) => [51 + i * 0.0001, 4.8 + Math.sin(i / 7) * 0.002]);
}

describe("simplify", () => {
  it("keeps short tracks as they are", () => {
    const short = track(10);
    expect(simplify(short)).toEqual(short);
  });

  it.each([600, 5000, 30000])("brings %i points down to at most 500", (n) => {
    const points = track(n);
    const result = simplify(points);
    expect(result.length).toBeLessThanOrEqual(MAX_POLYLINE_POINTS);
    expect(result.length).toBeGreaterThan(2);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
  });

  it("drops points on a straight line", () => {
    const line: LatLng[] = [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
    ];
    expect(simplify(line, 2)).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it("keeps the farthest point first", () => {
    const corner: LatLng[] = [
      [0, 0],
      [0.1, 0.0001],
      [1, 0],
      [1, 1],
    ];
    expect(simplify(corner, 3)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });
});

describe("routePolyline", () => {
  it("is null without points", () => {
    expect(routePolyline([])).toBeNull();
  });
});
