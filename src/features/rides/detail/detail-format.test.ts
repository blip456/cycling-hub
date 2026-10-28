import { describe, expect, it } from "vitest";
import type { Ride } from "../api";
import {
  detailDateLine,
  detailMetrics,
  formatWholeGrouped,
  stravaActivityUrl,
} from "./detail-format";

const ride: Ride = {
  id: "00000000-0000-0000-0000-0000000000r1",
  strava_id: 20584280211,
  name: "Sunday Long Ride",
  sport_type: "Ride",
  start_local: "2026-10-11T08:30:12",
  start_at: "2026-10-11T06:30:12Z",
  distance_m: 96000,
  moving_time_s: 11520,
  elevation_m: 1020.4,
  commute: false,
  trainer: false,
  average_watts: 214,
  max_watts: 690,
  average_heartrate: 141.3,
  max_heartrate: 178,
  average_cadence: 86.6,
  polyline: null,
};

describe("detailDateLine", () => {
  it("always shows the year, the wall-clock time and the tags", () => {
    expect(detailDateLine(ride)).toBe("Sun 11 Oct 2026 · 08:30 · Road");
    expect(detailDateLine({ ...ride, sport_type: "GravelRide", commute: true })).toBe(
      "Sun 11 Oct 2026 · 08:30 · Gravel · Commute",
    );
  });
});

describe("detailMetrics", () => {
  it("lists the fixed order first, then cadence and the maxima, in metric colours", () => {
    expect(detailMetrics(ride).map((m) => [m.label, m.value, m.unit, m.color])).toEqual([
      ["Moving time", "3:12", "h", "time"],
      ["Avg speed", "30.0", "km/h", "speed"],
      ["Avg power", "214", "W", "power"],
      ["Avg heart rate", "141", "bpm", "hr"],
      ["Elevation", "1,020", "m", "elev"],
      ["Avg cadence", "87", "rpm", null],
      ["Max power", "690", "W", "power"],
      ["Max heart rate", "178", "bpm", "hr"],
    ]);
  });

  it("shows — for values that are not in the export", () => {
    const bare = {
      ...ride,
      average_watts: null,
      max_watts: null,
      average_heartrate: null,
      max_heartrate: null,
      average_cadence: null,
      moving_time_s: 0,
    };
    const missing = detailMetrics(bare)
      .filter((m) => m.missing)
      .map((m) => m.label);
    expect(missing).toEqual([
      "Avg speed",
      "Avg power",
      "Avg heart rate",
      "Avg cadence",
      "Max power",
      "Max heart rate",
    ]);
    expect(detailMetrics(bare).find((m) => m.label === "Avg power")?.value).toBe("—");
  });
});

it("groups thousands", () => {
  expect(formatWholeGrouped(12345.6)).toBe("12,346");
  expect(formatWholeGrouped(null)).toBe("—");
});

it("links to the Strava activity", () => {
  expect(stravaActivityUrl(20584280211)).toBe("https://www.strava.com/activities/20584280211");
});
