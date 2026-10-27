import { describe, expect, it } from "vitest";
import type { Ride } from "./api";
import {
  averageSpeedKmh,
  formatDistanceKm,
  formatDuration,
  formatRideDate,
  formatSpeed,
  formatWhole,
  groupRides,
  rideTags,
  totals,
} from "./format";

function ride(overrides: Partial<Ride>): Ride {
  return {
    id: "1",
    strava_id: 1,
    name: "Morning Ride",
    sport_type: "Ride",
    start_local: "2026-10-12T08:14:00",
    start_at: "2026-10-12T06:14:00Z",
    distance_m: 111_100,
    moving_time_s: 3 * 3600 + 58 * 60,
    elevation_m: 1018,
    commute: false,
    trainer: false,
    average_watts: null,
    max_watts: null,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    polyline: null,
    ...overrides,
  };
}

describe("formatting", () => {
  it("formats dates in wall-clock time, with the year only when it is not this year", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(formatRideDate("2026-10-11T08:14:00", now)).toBe("Sun 11 Oct · 08:14");
    expect(formatRideDate("2019-07-10T18:05:00", now)).toBe("Wed 10 Jul 2019 · 18:05");
  });

  it("formats distance, duration, speed and missing values", () => {
    expect(formatDistanceKm(111_100)).toBe("111.1");
    expect(formatDuration(3 * 3600 + 58 * 60 + 20)).toBe("3:58");
    expect(formatDuration(59 * 60 + 40)).toBe("1:00");
    expect(formatSpeed(averageSpeedKmh(ride({ distance_m: 28_000, moving_time_s: 3600 })))).toBe(
      "28.0",
    );
    expect(formatSpeed(averageSpeedKmh(ride({ moving_time_s: 0 })))).toBe("—");
    expect(formatWhole(null)).toBe("—");
    expect(formatWhole(197.6)).toBe("198");
  });

  it("tags the sport, commutes and indoor rides", () => {
    expect(rideTags(ride({}))).toEqual(["Road"]);
    expect(rideTags(ride({ sport_type: "MountainBikeRide", commute: true }))).toEqual([
      "MTB",
      "Commute",
    ]);
    expect(rideTags(ride({ trainer: true }))).toEqual(["Road", "Indoor"]);
    expect(rideTags(ride({ sport_type: "VirtualRide", trainer: true }))).toEqual(["Virtual"]);
  });
});

describe("grouping", () => {
  const rides = [
    ride({ id: "a", start_local: "2026-10-11T08:14:00", distance_m: 100_000 }), // Sun, week 41
    ride({ id: "b", start_local: "2026-10-05T17:00:00", distance_m: 20_000 }), // Mon, week 41
    ride({ id: "c", start_local: "2026-10-04T09:00:00", distance_m: 50_000 }), // Sun, week 40
    ride({ id: "d", start_local: "2026-09-30T09:00:00", distance_m: 30_000 }), // Wed, week 40
  ];

  it("groups by ISO week with Monday–Sunday labels and totals, keeping the order", () => {
    const groups = groupRides(rides, "week");
    expect(groups.map((g) => g.key)).toEqual(["2026-W41", "2026-W40"]);
    expect(groups[0]?.label).toBe("Week 41 · 5–11 Oct");
    // Week across two months shows both; ICU writes September as "Sep" or "Sept".
    expect(groups[1]?.label).toMatch(/^Week 40 · 28 Sept?–4 Oct$/);
    expect(groups[0]?.rides.map((r) => r.id)).toEqual(["a", "b"]);
    expect(groups[0]?.totals.distanceM).toBe(120_000);
    expect(groups[1]?.totals.rides).toBe(2);
  });

  it("groups by calendar month", () => {
    const groups = groupRides(rides, "month");
    expect(groups.map((g) => [g.key, g.label, g.rides.length])).toEqual([
      ["2026-10", "October 2026", 3],
      ["2026-09", "September 2026", 1],
    ]);
  });

  it("handles ISO weeks across the year boundary", () => {
    const [group] = groupRides([ride({ start_local: "2027-01-01T10:00:00" })], "week");
    expect(group?.key).toBe("2026-W53");
  });

  it("sums totals", () => {
    expect(totals(rides)).toEqual({
      rides: 4,
      distanceM: 200_000,
      movingTimeS: 4 * (3 * 3600 + 58 * 60),
      elevationM: 4 * 1018,
    });
  });
});
