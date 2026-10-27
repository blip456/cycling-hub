import { describe, expect, it } from "vitest";
import { groupRides, totals } from "../format";
import { makeRide } from "./fixtures";
import { DEFAULT_STATE } from "./list-state";
import {
  earlierYears,
  filterRides,
  formatThousands,
  formatTotalsLine,
  groupTitle,
  matchesType,
  periodRange,
  sortRides,
  todayInBrussels,
} from "./sort-filter";

const TODAY = "2026-10-27";

const rides = [
  makeRide({
    id: "a",
    name: "Sunday Long Ride",
    start_local: "2026-10-11T08:30:00",
    distance_m: 96_000,
    moving_time_s: 11_520,
    elevation_m: 1020,
    average_watts: 214,
  }),
  makeRide({
    id: "b",
    name: "Evening Ride",
    start_local: "2026-10-08T17:48:00",
    distance_m: 18_600,
    moving_time_s: 2400,
    elevation_m: 84,
    commute: true,
  }),
  makeRide({
    id: "c",
    name: "Côte de Trieu",
    start_local: "2026-07-07T12:05:00",
    distance_m: 73_400,
    moving_time_s: 8520,
    elevation_m: 640,
    average_watts: 228,
    sport_type: "GravelRide",
  }),
  makeRide({
    id: "d",
    name: "Morning MTB",
    start_local: "2025-10-06T07:10:00",
    distance_m: 22_000,
    moving_time_s: 3900,
    elevation_m: 410,
    sport_type: "MountainBikeRide",
  }),
  makeRide({
    id: "e",
    name: "Indoor intervals",
    start_local: "2024-09-29T19:30:00",
    distance_m: 41_400,
    moving_time_s: 5040,
    elevation_m: 0,
    trainer: true,
    average_watts: 241,
  }),
  makeRide({
    id: "f",
    name: "Zwift",
    start_local: "2024-01-03T19:30:00",
    distance_m: 30_000,
    moving_time_s: 3600,
    elevation_m: 200,
    sport_type: "VirtualRide",
  }),
  makeRide({
    id: "g",
    name: "E-bike errand",
    start_local: "2026-10-26T10:00:00",
    distance_m: 10_000,
    moving_time_s: 1800,
    elevation_m: 20,
    sport_type: "EBikeRide",
  }),
];
const ids = (list: readonly { id: string }[]) => list.map((r) => r.id).join("");

describe("todayInBrussels", () => {
  it("uses the Brussels date, not UTC", () => {
    expect(todayInBrussels(new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-27");
    expect(todayInBrussels(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
  });
});

describe("periodRange", () => {
  const range = (period: string, from = "", to = "") => periodRange({ period, from, to }, TODAY);
  it("covers the last 4 weeks including today, 3 months, this year, a year and a custom range", () => {
    expect(range("all")).toEqual({ from: "", to: "" });
    expect(range("4w")).toEqual({ from: "2026-09-30", to: "" });
    expect(range("3m")).toEqual({ from: "2026-07-27", to: "" });
    expect(range("year")).toEqual({ from: "2026-01-01", to: "" });
    expect(range("2024")).toEqual({ from: "2024-01-01", to: "2024-12-31" });
    expect(range("custom", "2026-07-01", "")).toEqual({ from: "2026-07-01", to: "" });
  });
});

describe("filterRides", () => {
  const filter = (patch: Partial<typeof DEFAULT_STATE>) =>
    ids(filterRides(rides, { ...DEFAULT_STATE, ...patch }, TODAY));

  it("keeps everything and the order without filters", () => {
    expect(filter({})).toBe("abcdefg");
  });

  it("searches names without case or accents", () => {
    expect(filter({ q: "ride" })).toBe("ab");
    expect(filter({ q: " cote " })).toBe("c");
  });

  it("filters by type", () => {
    expect(filter({ type: "road" })).toBe("ab");
    expect(filter({ type: "gravel" })).toBe("c");
    expect(filter({ type: "mtb" })).toBe("d");
    expect(filter({ type: "ebike" })).toBe("g");
    expect(filter({ type: "indoor" })).toBe("ef");
    expect(filter({ type: "commute" })).toBe("b");
    expect(matchesType(rides[0]!, "all")).toBe(true);
  });

  it("filters by period, inclusive at both ends", () => {
    expect(filter({ period: "4w" })).toBe("abg");
    expect(filter({ period: "3m" })).toBe("abg");
    expect(filter({ period: "year" })).toBe("abcg");
    expect(filter({ period: "2024" })).toBe("ef");
    expect(filter({ period: "custom", from: "2026-07-07", to: "2026-10-08" })).toBe("bc");
    expect(filter({ period: "custom", to: "2024-12-31" })).toBe("ef");
  });

  it("hides commutes and combines filters", () => {
    expect(filter({ hideCommutes: true })).toBe("acdefg");
    expect(filter({ hideCommutes: true, type: "road" })).toBe("a");
    expect(filter({ q: "zzz" })).toBe("");
  });
});

describe("sortRides", () => {
  it("sorts by date both ways", () => {
    expect(ids(sortRides(rides, "date", "desc"))).toBe("gabcdef");
    expect(ids(sortRides(rides, "date", "asc"))).toBe("fedcbag");
  });

  it("sorts names A to Z, ignoring case and accents", () => {
    expect(ids(sortRides(rides, "name", "asc"))).toBe("cgbedaf");
    expect(ids(sortRides(rides, "name", "desc"))).toBe("fadebgc");
  });

  it("sorts numbers both ways", () => {
    expect(ids(sortRides(rides, "distance", "desc"))).toBe("acefdbg");
    expect(ids(sortRides(rides, "distance", "asc"))).toBe("gbdfeca");
    expect(ids(sortRides(rides, "time", "desc"))).toBe("acedfbg");
    expect(ids(sortRides(rides, "elevation", "asc"))).toBe("egbfdca");
  });

  it("sorts by the derived average speed", () => {
    // km/h: a 30.0, b 27.9, c 31.0, d 20.3, e 29.6, f 30.0, g 20.0
    expect(ids(sortRides(rides, "speed", "desc"))).toBe("cafebdg");
  });

  it("keeps rides without a value last in both directions, newest first among them", () => {
    expect(ids(sortRides(rides, "power", "desc"))).toBe("ecagbdf");
    expect(ids(sortRides(rides, "power", "asc"))).toBe("acegbdf");
    expect(ids(sortRides(rides, "hr", "asc"))).toBe("gabcdef");
  });

  it("does not change the input", () => {
    const copy = [...rides];
    sortRides(rides, "name", "asc");
    expect(rides).toEqual(copy);
  });
});

describe("list formatting", () => {
  it("formats totals with a thousands comma", () => {
    expect(formatTotalsLine(totals(rides.slice(0, 3)))).toBe("3 rides · 188.0 km · 6:14 h");
    expect(formatTotalsLine(totals(rides.slice(0, 1)))).toBe("1 ride · 96.0 km · 3:12 h");
    expect(
      formatTotalsLine({
        rides: 1208,
        distanceM: 12_345_678,
        movingTimeS: 500 * 3600,
        elevationM: 0,
      }),
    ).toBe("1,208 rides · 12,345.7 km · 500:00 h");
    expect(formatThousands(1020)).toBe("1,020");
    expect(formatThousands(null)).toBe("—");
  });

  it("adds the year to weeks of other years", () => {
    const [current, older] = groupRides([rides[0]!, rides[3]!], "week");
    expect(groupTitle(current!, "week", "2026")).toEqual({ title: "Week 41", detail: "5–11 Oct" });
    expect(groupTitle(older!, "week", "2026")).toEqual({
      title: "Week 41",
      detail: "6–12 Oct 2025",
    });
    const [month] = groupRides([rides[0]!], "month");
    expect(groupTitle(month!, "month", "2026")).toEqual({ title: "October 2026", detail: "" });
  });

  it("lists the earlier years with rides, newest first", () => {
    expect(earlierYears(rides, TODAY)).toEqual(["2025", "2024"]);
  });
});
