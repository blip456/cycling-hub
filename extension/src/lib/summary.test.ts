import { describe, expect, it } from "vitest";
import { fakeGpx, type FakePoint } from "../test/fixtures";
import { parseGpx, type TrackPoint } from "./gpx";
import { summarize, timeWeightedAverage } from "./summary";

function parsed(fake: FakePoint[]): TrackPoint[] {
  const result = parseGpx(fakeGpx(fake));
  if (result.kind !== "gpx") throw new Error("expected a GPX");
  return result.points;
}

describe("averages", () => {
  it("weights by the time between points", () => {
    // 100 W for 1 s, then 400 W for 3 s → (100 + 1200) / 4 = 325.
    const points = parsed([
      { t: 0, power: 999 },
      { t: 1, power: 100 },
      { t: 4, power: 400 },
    ]);
    expect(timeWeightedAverage(points, (p) => p.power)).toBe(325);
  });

  it("leaves out gaps longer than 30 s (pauses)", () => {
    const points = parsed([
      { t: 0, power: 200 },
      { t: 10, power: 200 },
      { t: 600, power: 1000 }, // after a 590 s pause: does not count
      { t: 610, power: 200 },
    ]);
    expect(timeWeightedAverage(points, (p) => p.power)).toBe(200);
  });

  it("counts a gap of exactly 30 s", () => {
    const points = parsed([
      { t: 0, power: 0 },
      { t: 30, power: 300 },
      { t: 60, power: 100 },
    ]);
    expect(timeWeightedAverage(points, (p) => p.power)).toBe(200);
  });

  it("includes zero watts but leaves out zero cadence", () => {
    const points = parsed([
      { t: 0, power: 0, cad: 0 },
      { t: 1, power: 200, cad: 90 },
      { t: 2, power: 0, cad: 0 },
      { t: 3, power: 0, cad: 0 },
      { t: 4, power: 200, cad: 90 },
    ]);
    const summary = summarize(points);
    expect(summary.averageWatts).toBe(100);
    expect(summary.maxWatts).toBe(200);
    expect(summary.averageCadence).toBe(90);
  });

  it("counts only points with a value and rounds", () => {
    const points = parsed([{ t: 0, hr: 100 }, { t: 1, hr: 101 }, { t: 2 }, { t: 3, hr: 102 }]);
    const summary = summarize(points);
    expect(summary.averageHeartrate).toBe(102); // (101·1 + 102·1) / 2 = 101.5 → 102
    expect(summary.maxHeartrate).toBe(102);
    expect(summary.averageWatts).toBeNull();
    expect(summary.maxWatts).toBeNull();
    expect(summary.averageCadence).toBeNull();
  });

  it("leaves heart rate zeros (sensor dropouts) out of the average", () => {
    const points = parsed([
      { t: 0, hr: 100 },
      { t: 1, hr: 0 },
      { t: 2, hr: 0 },
      { t: 3, hr: 100 },
    ]);
    expect(summarize(points).averageHeartrate).toBe(100);
  });

  it("falls back to the plain mean for a single point", () => {
    expect(timeWeightedAverage(parsed([{ t: 0, hr: 120 }]), (p) => p.hr)).toBe(120);
  });
});

describe("summarize", () => {
  it("is no_gpx without track points", () => {
    expect(summarize([])).toEqual({
      details: "no_gpx",
      polyline: null,
      averageWatts: null,
      maxWatts: null,
      averageHeartrate: null,
      maxHeartrate: null,
      averageCadence: null,
      streams: null,
    });
  });

  it("builds the route and columnar streams, rounded, without empty keys", () => {
    const summary = summarize(
      parsed([
        { t: 0, lat: 38.5, lon: -120.2, ele: 12.44, hr: 98, power: 0 },
        { t: 1, lat: 40.7, lon: -120.95, ele: 12.56, power: 180.4 },
        { t: 5, lat: 43.252, lon: -126.453, hr: 103, power: 210 },
      ]),
    );
    expect(summary.details).toBe("gpx");
    expect(summary.polyline).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(summary.streams).toEqual({
      time: [0, 1, 5],
      latlng: [
        [38.5, -120.2],
        [40.7, -120.95],
        [43.252, -126.453],
      ],
      altitude: [12.4, 12.6, null],
      heartrate: [98, null, 103],
      watts: [0, 180, 210],
    });
  });

  it("rounds positions to 5 decimals", () => {
    const summary = summarize(parsed([{ t: 0, lat: 51.0445123, lon: 4.8906789 }]));
    expect(summary.streams?.latlng).toEqual([[51.04451, 4.89068]]);
  });

  it("keeps power and heart rate of an indoor GPX without positions", () => {
    const summary = summarize(
      parsed([
        { t: 0, power: 150, hr: 120 },
        { t: 1, power: 250, hr: 130 },
      ]),
    );
    expect(summary.details).toBe("gpx");
    expect(summary.polyline).toBeNull();
    expect(summary.averageWatts).toBe(250);
    expect(summary.streams).toEqual({ time: [0, 1], heartrate: [120, 130], watts: [150, 250] });
  });
});
