import { describe, expect, it } from "vitest";
import { fakeGpx, fakeModel, jsonResponse, textResponse } from "../test/fixtures";
import { memoryCache } from "./cache";
import { exportFileName, runExport, type Progress } from "./exporter";
import type { Fetch } from "./strava-client";

interface FakeStrava {
  fetch: Fetch;
  calls: string[];
  gpxCalls: () => number[];
}

/** A fake strava.com: list pages of 2 and a GPX per activity (`gpx` decides the answer). */
function fakeStrava(
  models: Record<string, unknown>[],
  gpx: (id: number) => Response = () =>
    textResponse(
      fakeGpx([
        { t: 0, lat: 51, lon: 4, power: 100, hr: 120 },
        { t: 1, lat: 51.001, lon: 4.001, power: 200, hr: 130 },
      ]),
    ),
): FakeStrava {
  const calls: string[] = [];
  const fetch: Fetch = (input) => {
    calls.push(input);
    const url = new URL(input);
    const gpxMatch = /^\/activities\/(\d+)\/export_gpx$/.exec(url.pathname);
    if (gpxMatch) return Promise.resolve(gpx(Number(gpxMatch[1])));
    const page = Number(url.searchParams.get("page"));
    const slice = models.slice((page - 1) * 2, page * 2);
    return Promise.resolve(jsonResponse({ models: slice, page, perPage: 2, total: models.length }));
  };
  const gpxCalls = () =>
    calls
      .map((c) => /activities\/(\d+)\/export_gpx/.exec(c)?.[1])
      .filter((id): id is string => id !== undefined)
      .map(Number);
  return { fetch, calls, gpxCalls };
}

/** A clock that only moves when we sleep, so pacing is visible and the tests are instant. */
function fakeClock() {
  let time = Date.parse("2026-10-28T10:00:00Z");
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number) => {
      sleeps.push(ms);
      time += ms;
      return Promise.resolve();
    },
    sleeps,
  };
}

const MODELS = [
  fakeModel({ id: 11, local: "2026-10-01T09:00:00" }),
  fakeModel({ id: 12, local: "2026-10-03T09:00:00", sportType: "AlpineSki" }),
  fakeModel({ id: 13, local: "2026-10-05T09:00:00", sportType: "GravelRide" }),
  fakeModel({ id: 14, local: "2026-10-04T09:00:00", sportType: "VirtualRide", trainer: true }),
  fakeModel({ id: 15, local: "2026-10-02T09:00:00", sportType: "Workout" }),
];

describe("runExport", () => {
  it("exports every activity newest first, with GPX details for rides only", async () => {
    const strava = fakeStrava(MODELS, (id) =>
      id === 14
        ? textResponse(fakeGpx([]))
        : textResponse(
            fakeGpx([
              { t: 0, lat: 51, lon: 4, power: 100 },
              { t: 1, lat: 51.001, lon: 4.001, power: 200 },
            ]),
          ),
    );
    const clock = fakeClock();
    const progress: Progress[] = [];
    const { file, summary } = await runExport({
      version: "0.1.0",
      cache: memoryCache(),
      fetch: strava.fetch,
      sleep: clock.sleep,
      now: clock.now,
      searchSessionId: "test-session",
      onProgress: (p) => progress.push(p),
    });

    expect(file.version).toBe(2);
    expect(file.source).toBe("cycling-hub-extension 0.1.0");
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(file.activities.map((a) => [a.id, a.details])).toEqual([
      [13, "gpx"],
      [14, "no_gpx"],
      [12, "skipped"],
      [15, "skipped"],
      [11, "gpx"],
    ]);
    const gravel = file.activities[0];
    expect(gravel?.averageWatts).toBe(200);
    expect(gravel?.polyline).toEqual(expect.any(String));
    expect(gravel?.streams?.time).toEqual([0, 1]);
    expect(gravel).not.toHaveProperty("static_map");

    expect(strava.gpxCalls().sort()).toEqual([11, 13, 14]);
    expect(summary).toMatchObject({
      activities: 5,
      rides: 3,
      ridesWithGpx: 2,
      ridesWithoutGpx: 1,
      failed: 0,
      downloaded: 3,
      fromCache: 0,
    });

    // 3 list pages ≥ 1 s apart, 3 GPX downloads ≥ 2 s apart.
    expect(clock.sleeps).toEqual([1000, 1000, 2000, 2000]);
    expect(progress[0]).toEqual({ phase: "list", read: 2, total: 5 });
    expect(progress.at(-1)).toEqual({ phase: "details", done: 3, total: 3, secondsLeft: 0 });
  });

  it("only downloads new, changed and earlier failed rides the second time", async () => {
    const cache = memoryCache();
    let failNext = true;
    const first = fakeStrava(MODELS, (id) => {
      if (id === 11 && failNext) return textResponse("", { status: 500 });
      return textResponse(fakeGpx([{ t: 0, lat: 51, lon: 4 }]));
    });
    const clock = fakeClock();
    const options = { version: "0.1.0", cache, sleep: clock.sleep, now: clock.now };
    const one = await runExport({ ...options, fetch: first.fetch });
    expect(one.summary.failed).toBe(1);
    expect(one.file.activities.find((a) => a.id === 11)).toMatchObject({
      details: "failed",
      polyline: null,
      streams: null,
    });

    failNext = false;
    const changed = MODELS.map((m) => (m.id === 13 ? { ...m, distance_raw: 2000 } : m));
    const added = [
      ...changed,
      fakeModel({ id: 16, local: "2026-10-06T09:00:00", sportType: "Ride" }),
    ];
    const second = fakeStrava(added);
    const two = await runExport({ ...options, fetch: second.fetch });
    expect(second.gpxCalls().sort()).toEqual([11, 13, 16]);
    expect(two.summary).toMatchObject({ downloaded: 3, fromCache: 1, failed: 0, ridesWithGpx: 4 });

    const third = fakeStrava(added);
    await runExport({ ...options, fetch: third.fetch });
    expect(third.gpxCalls()).toEqual([]);
  });

  it("marks the rest as failed after Strava keeps answering 429", async () => {
    const strava = fakeStrava(MODELS, () => textResponse("", { status: 429 }));
    const clock = fakeClock();
    const { summary, file } = await runExport({
      version: "0.1.0",
      cache: memoryCache(),
      fetch: strava.fetch,
      sleep: clock.sleep,
      now: clock.now,
    });
    expect(summary.rateLimited).toBe(true);
    expect(summary.failed).toBe(3);
    expect(strava.gpxCalls()).toHaveLength(2); // one download, retried once, then no more
    expect(file.activities.filter((a) => a.details === "failed")).toHaveLength(3);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    const strava = fakeStrava(MODELS, () => {
      controller.abort(new Error("Stopped"));
      return textResponse(fakeGpx([{ t: 0, lat: 1, lon: 1 }]));
    });
    const clock = fakeClock();
    await expect(
      runExport({
        version: "0.1.0",
        cache: memoryCache(),
        fetch: strava.fetch,
        sleep: clock.sleep,
        now: clock.now,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Stopped");
    expect(strava.gpxCalls()).toHaveLength(1);
  });
});

describe("exportFileName", () => {
  it("uses the local date", () => {
    expect(exportFileName(new Date(2026, 9, 28, 23, 30))).toBe(
      "cycling-hub-export-2026-10-28.json",
    );
  });
});
