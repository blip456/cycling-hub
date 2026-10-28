import { describe, expect, it, vi } from "vitest";
import { fakeModel } from "../test/fixtures";
import {
  fingerprint,
  listPageUrl,
  localWallClock,
  mapListModel,
  readActivityList,
  utcStartDate,
  type ListPage,
} from "./strava-list";

describe("localWallClock", () => {
  it("turns the local Unix seconds into a wall-clock time without a zone (T11)", () => {
    expect(localWallClock(1792310680)).toBe("2026-10-18T08:04:40");
  });
});

describe("utcStartDate", () => {
  it.each([
    ["2026-10-18T06:04:40+0000", "2026-10-18T06:04:40Z"],
    ["2026-10-18T06:04:40Z", "2026-10-18T06:04:40Z"],
    ["2026-10-18T08:04:40+0200", "2026-10-18T06:04:40Z"],
    ["2026-10-18T08:04:40+02:00", "2026-10-18T06:04:40Z"],
    ["2026-10-18T06:04:40.123+0000", "2026-10-18T06:04:40Z"],
  ])("%s → %s", (input, expected) => {
    expect(utcStartDate(input)).toBe(expected);
  });

  it("returns null for text that is not a time", () => {
    expect(utcStartDate("Sun, 10/18/2026")).toBeNull();
  });
});

describe("mapListModel", () => {
  it("maps a list model to the export fields and leaves the rest out", () => {
    const model = {
      ...fakeModel({ id: 20000000001, distance: 114220, moving: 18367, elapsed: 18759 }),
      name: "Morning Ride",
      description: "Easy loop",
      elevation_gain_raw: 775,
    };
    expect(mapListModel(model)).toEqual({
      id: 20000000001,
      name: "Morning Ride",
      sportType: "Ride",
      startDateLocal: "2026-10-18T08:04:40",
      startDate: "2026-10-18T06:04:40Z",
      distance: 114220,
      movingTime: 18367,
      elapsedTime: 18759,
      elevation: 775,
      commute: false,
      trainer: false,
      private: false,
      hasLatlng: true,
      gearId: 1234,
      description: "Easy loop",
    });
  });

  it("keeps a missing bike as null and copes with missing numbers", () => {
    const model = {
      ...fakeModel({ id: 5 }),
      bike_id: null,
      distance_raw: null,
      elevation_gain_raw: undefined,
      description: null,
    };
    const activity = mapListModel(model);
    expect(activity?.gearId).toBeNull();
    expect(activity?.distance).toBe(0);
    expect(activity?.elevation).toBe(0);
    expect(activity).not.toHaveProperty("description");
  });

  it.each([
    ["no id", { id: undefined }],
    ["a zero id", { id: 0 }],
    ["no local start", { start_date_local_raw: null }],
    ["no UTC start", { start_time: "" }],
    ["no sport type", { sport_type: null }],
  ])("returns null with %s", (_, override) => {
    expect(mapListModel({ ...fakeModel({ id: 7 }), ...override })).toBeNull();
  });

  it("returns null for something that is not an object", () => {
    expect(mapListModel("ride")).toBeNull();
    expect(mapListModel(null)).toBeNull();
  });
});

describe("fingerprint", () => {
  const base = mapListModel(fakeModel({ id: 1 }));
  if (!base) throw new Error("fixture");

  it("is the same for the same list values", () => {
    expect(fingerprint({ ...base, name: "Renamed" })).toBe(fingerprint(base));
  });

  it.each([
    ["distance", { distance: 1001 }],
    ["moving time", { movingTime: 301 }],
    ["elapsed time", { elapsedTime: 321 }],
    ["sport type", { sportType: "GravelRide" }],
  ])("changes with the %s", (_, change) => {
    expect(fingerprint({ ...base, ...change })).not.toBe(fingerprint(base));
  });
});

describe("listPageUrl", () => {
  it("fills in the search session and the page", () => {
    const url = new URL(listPageUrl(3, "abc-123"));
    expect(url.origin + url.pathname).toBe("https://www.strava.com/athlete/training_activities");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("search_session_id")).toBe("abc-123");
    expect(url.searchParams.get("new_activity_only")).toBe("false");
    expect(url.searchParams.get("keywords")).toBe("");
  });
});

describe("readActivityList", () => {
  const page = (ids: number[], total: number | null): ListPage => ({
    models: ids.map((id) => fakeModel({ id })),
    total,
  });

  it("stops once it has `total` models", async () => {
    const pages = [page([1, 2], 5), page([3, 4], 5), page([5], 5), page([6], 5)];
    const fetchPage = vi.fn((n: number) => Promise.resolve(pages[n - 1] ?? page([], 5)));
    const progress: [number, number | null][] = [];
    const result = await readActivityList({
      fetchPage,
      onProgress: (read, total) => progress.push([read, total]),
    });
    expect(result.activities.map((a) => a.id)).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([
      [2, 5],
      [4, 5],
      [5, 5],
    ]);
  });

  it("stops at an empty page when the total is missing or too high", async () => {
    const pages = [page([1, 2], 10), page([3], 10), page([], 10)];
    const fetchPage = vi.fn((n: number) => Promise.resolve(pages[n - 1] ?? page([9], 10)));
    const result = await readActivityList({ fetchPage });
    expect(result.activities).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(3);

    const noTotal = [page([1], null), page([], null)];
    const fetchNoTotal = vi.fn((n: number) => Promise.resolve(noTotal[n - 1] ?? page([9], null)));
    const second = await readActivityList({
      fetchPage: fetchNoTotal,
    });
    expect(second.activities).toHaveLength(1);
    expect(fetchNoTotal).toHaveBeenCalledTimes(2);
  });

  it("counts unreadable models and drops duplicates", async () => {
    const pages: ListPage[] = [
      { models: [fakeModel({ id: 1 }), { id: "x" }], total: 3 },
      page([1], 3),
    ];
    const result = await readActivityList({
      fetchPage: (n) => Promise.resolve(pages[n - 1] ?? page([], 3)),
    });
    expect(result.activities).toHaveLength(1);
    expect(result.unreadable).toBe(1);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(() => {
      controller.abort();
      return Promise.resolve(page([1], 100));
    });
    await expect(readActivityList({ fetchPage, signal: controller.signal })).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
