import { describe, expect, it } from "vitest";
import {
  parseExport,
  readStoredSkipped,
  rejectTooLarge,
  toBrusselsWallClock,
  toLocalDateTime,
} from "./parse";
import { isRideSportType } from "./sport-types";
import broken from "./fixtures/export-v1-broken.json";
import valid from "./fixtures/export-v1.json";
import v2 from "./fixtures/export-v2.json";
import notAnExport from "./fixtures/not-an-export.json";

const text = (value: unknown) => JSON.stringify(value);

function parseOk(input: string) {
  const result = parseExport(input);
  if (!result.ok) throw new Error(`expected a valid export, got: ${result.message}`);
  return result;
}

describe("parseExport, level 1: the file", () => {
  it.each([
    ["an empty file", "  ", "This is not a Cycling Hub export: the file is empty."],
    [
      "text that is not JSON",
      "date,distance\n",
      "This is not a Cycling Hub export: the file is not valid JSON.",
    ],
    ["a JSON array", "[]", "This is not a Cycling Hub export: the file has no activities list."],
    [
      "a JSON string",
      '"hello"',
      "This is not a Cycling Hub export: the file has no activities list.",
    ],
    [
      "an object without activities",
      text(notAnExport),
      "This is not a Cycling Hub export: the file has no activities list.",
    ],
    [
      "activities that is not a list",
      text({ version: 1, activities: {} }),
      "This is not a Cycling Hub export: the file has no activities list.",
    ],
    [
      "no version",
      text({ activities: [] }),
      "This is not a Cycling Hub export: the file has no version.",
    ],
    [
      "an unsupported version",
      text({ version: 3, activities: [] }),
      "Export version 3 is not supported yet.",
    ],
    [
      "a version that is text",
      text({ version: "1", activities: [] }),
      'Export version "1" is not supported yet.',
    ],
  ])("rejects %s", (_, input, message) => {
    const result = parseExport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe(message);
  });

  it("keeps the JSON parser's message as detail", () => {
    const result = parseExport("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/JSON/);
  });

  it("rejects files that are too large before reading them", () => {
    expect(rejectTooLarge(1_000)).toBeNull();
    // A backfill with streams is tens of MB (T12).
    expect(rejectTooLarge(60 * 1024 * 1024)).toBeNull();
    expect(rejectTooLarge(251 * 1024 * 1024)?.message).toBe(
      "This file is too large: an export is at most 250 MB.",
    );
  });

  it("accepts an empty activities list", () => {
    expect(parseOk(text({ version: 1, activities: [] }))).toMatchObject({
      total: 0,
      activities: [],
      skipped: [],
    });
  });
});

describe("parseExport, level 2: every activity", () => {
  it("reads every activity of a valid v1 export", () => {
    const result = parseOk(text(valid));
    expect(result.version).toBe(1);
    expect(result.total).toBe(10);
    expect(result.activities).toHaveLength(10);
    expect(result.skipped).toEqual([]);
    const rides = result.activities.filter((a) => isRideSportType(a.sport_type));
    expect(rides).toHaveLength(7);
  });

  it("normalises an activity and keeps the raw object", () => {
    const [first] = parseOk(text(valid)).activities;
    expect(first).toEqual({
      strava_id: 900000010,
      name: "Test evening ride",
      sport_type: "Ride",
      // v1: 19:05 UTC is 21:05 in Brussels in summer (T11).
      start_local: "2026-07-14T21:05:00",
      distance_m: 31250,
      moving_time_s: 4020,
      elevation_m: 210,
      commute: false,
      trainer: false,
      polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      average_watts: null,
      max_watts: null,
      average_heartrate: null,
      max_heartrate: null,
      average_cadence: null,
      raw: valid.activities[0],
    });
  });

  it("reads a startDateLocal with a trailing Z as UTC and converts it to Brussels time (T11)", () => {
    const result = parseOk(
      text({
        version: 1,
        activities: [{ ...valid.activities[0], startDateLocal: "2026-07-14T23:30:00Z" }],
      }),
    );
    // Past midnight in Brussels: the next day.
    expect(result.activities[0]?.start_local).toBe("2026-07-15T01:30:00");
  });

  it("keeps unknown and future (v2) fields and reads optional power and heart rate", () => {
    const gravel = parseOk(text(valid)).activities.find((a) => a.strava_id === 900000008);
    expect(gravel).toMatchObject({
      distance_m: 64000.5,
      average_watts: 182,
      average_heartrate: 141,
      max_watts: null,
    });
    expect(gravel?.raw.tags).toEqual(["gravel"]);
    expect(gravel?.raw.startDateUtc).toBe("2026-06-28T07:00:00Z");
  });

  it("ignores optional fields with a wrong type instead of skipping the ride", () => {
    const result = parseOk(
      text({
        version: 1,
        activities: [{ ...valid.activities[0], averageWatts: "high", polyline: 4 }],
      }),
    );
    expect(result.skipped).toEqual([]);
    expect(result.activities[0]).toMatchObject({ average_watts: null, polyline: null });
  });

  it("defaults missing commute and trainer flags to false and rounds moving time", () => {
    const { commute: _c, trainer: _t, ...rest } = valid.activities[0]!;
    const result = parseOk(text({ version: 1, activities: [{ ...rest, movingTime: 60.6 }] }));
    expect(result.activities[0]).toMatchObject({
      commute: false,
      trainer: false,
      moving_time_s: 61,
    });
  });

  it("skips broken activities, lists each with path and reason, and keeps the rest", () => {
    const result = parseOk(text(broken));
    expect(result.total).toBe(7);
    expect(result.activities.map((a) => a.strava_id)).toEqual([900000010, 900000006]);
    expect(result.skipped).toEqual([
      {
        index: 1,
        name: "Test hike",
        startLocal: null,
        issues: [{ path: "activities[1].startDateLocal", message: "is not a valid date" }],
      },
      {
        index: 2,
        name: "Test gravel loop",
        startLocal: "2026-06-28T11:00:00",
        issues: [{ path: "activities[2].distance", message: "must be a number (metres)" }],
      },
      {
        index: 3,
        name: "Test commute",
        startLocal: "2026-06-24T10:10:00",
        issues: [{ path: "activities[3].id", message: "is missing" }],
      },
      {
        index: 4,
        name: null,
        startLocal: null,
        issues: [{ path: "activities[4]", message: "is not an activity" }],
      },
    ]);
  });

  it("imports the first of two activities with the same ID and ignores the other", () => {
    const result = parseOk(text(broken));
    expect(result.activities.filter((a) => a.strava_id === 900000010)).toHaveLength(1);
    expect(result.skipped.map((s) => s.index)).not.toContain(6);
  });

  it("lists every broken field of an activity once", () => {
    const result = parseOk(
      text({ version: 1, activities: [{ id: -1, name: 3, distance: -5, elevation: null }] }),
    );
    expect(result.skipped[0]?.issues).toEqual([
      { path: "activities[0].id", message: "must be a positive number" },
      { path: "activities[0].name", message: "must be text" },
      { path: "activities[0].sportType", message: "is missing" },
      { path: "activities[0].startDateLocal", message: "is missing" },
      { path: "activities[0].distance", message: "must be 0 or more (metres)" },
      { path: "activities[0].movingTime", message: "is missing" },
      { path: "activities[0].elevation", message: "is missing" },
    ]);
  });
});

describe("toLocalDateTime (T11)", () => {
  it.each([
    // Without a zone (v2): already Brussels wall-clock time.
    ["2026-10-14T17:27:43", "2026-10-14T17:27:43"],
    ["2026-10-14T17:27:43.900", "2026-10-14T17:27:43"],
    // With Z (v1): UTC, converted. Summer time (UTC+2) and winter time (UTC+1).
    ["2026-10-14T15:27:43Z", "2026-10-14T17:27:43"],
    ["2026-10-14T15:27:43.250Z", "2026-10-14T17:27:43"],
    ["2026-01-15T09:00:00Z", "2026-01-15T10:00:00"],
    ["2024-02-29T00:00:00Z", "2024-02-29T01:00:00"],
    ["2026-12-31T23:30:00Z", "2027-01-01T00:30:00"],
    // March: summer time starts 29 Mar 2026 at 01:00 UTC (02:00 → 03:00 local).
    ["2026-03-29T00:59:59Z", "2026-03-29T01:59:59"],
    ["2026-03-29T01:00:00Z", "2026-03-29T03:00:00"],
    // October: summer time ends 25 Oct 2026 at 01:00 UTC (03:00 → 02:00 local).
    ["2026-10-25T00:59:59Z", "2026-10-25T02:59:59"],
    ["2026-10-25T01:00:00Z", "2026-10-25T02:00:00"],
    ["2026-10-25T02:00:00Z", "2026-10-25T03:00:00"],
    // Any other offset: that instant, converted.
    ["2026-10-14T17:27:43+02:00", "2026-10-14T17:27:43"],
    ["2026-10-14T11:27:43-04:00", "2026-10-14T17:27:43"],
    ["2026-10-14T20:57:43+0530", "2026-10-14T17:27:43"],
    ["2026-01-15T10:00:00+01:00", "2026-01-15T10:00:00"],
    // Not a date and time.
    ["2026-02-29T00:00:00Z", null],
    ["2026-02-29T00:00:00", null],
    ["2026-10-14T24:00:00Z", null],
    ["2026-10-14 15:27:43", null],
    ["2026-10-14T15:27:43+25:00", null],
    ["2026-10-14T15:27:43+02", null],
    ["yesterday", null],
  ])("%s → %s", (input, expected) => {
    expect(toLocalDateTime(input)).toBe(expected);
  });

  it("formats an instant as Brussels wall-clock time", () => {
    expect(toBrusselsWallClock(Date.UTC(2026, 9, 14, 15, 27, 43))).toBe("2026-10-14T17:27:43");
  });
});

describe("parseExport, export v2 (T12)", () => {
  const result = parseOk(text(v2));
  const byId = (id: number) => result.activities.find((a) => a.strava_id === id);

  it("reads a v2 file with v1-shaped activities in it", () => {
    expect(result.version).toBe(2);
    expect(result.total).toBe(5);
    expect(result.skipped).toEqual([]);
    expect(result.activities).toHaveLength(5);
    // v2 start without zone stays; the v1-shaped activity (Z) is converted.
    expect(byId(900000101)?.start_local).toBe("2026-10-14T17:27:43");
    expect(byId(900000102)?.start_local).toBe("2026-03-29T07:30:00");
    expect(byId(900000103)?.start_local).toBe("2026-10-14T08:10:00");
  });

  it("fills averages, maxima and the route from v2", () => {
    expect(byId(900000101)).toMatchObject({
      sport_type: "MountainBikeRide",
      polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      average_watts: 196,
      max_watts: 410,
      average_heartrate: 148,
      max_heartrate: 176,
      average_cadence: 82,
    });
    expect(byId(900000102)).toMatchObject({
      trainer: true,
      polyline: null,
      average_heartrate: null,
    });
  });

  it("keeps v2 fields in raw but never the streams", () => {
    for (const activity of result.activities) expect(activity.raw).not.toHaveProperty("streams");
    const { streams: _streams, ...expected } = v2.activities[0]!;
    expect(byId(900000101)?.raw).toEqual(expected);
    expect(byId(900000101)?.raw).toMatchObject({
      elapsedTime: 2700,
      gearId: 12345,
      details: "gpx",
    });
  });

  it("returns valid streams next to the activities, unknown keys included", () => {
    expect(result.streams.map((s) => s.stravaId)).toEqual([900000101, 900000102]);
    expect(result.streams[0]?.streams).toEqual(v2.activities[0]!.streams);
  });

  it("drops invalid streams, still imports the activity and reports it", () => {
    expect(byId(900000104)).toBeDefined();
    expect(result.droppedStreams).toEqual([
      { stravaId: 900000104, reason: "streams.heartrate must have one entry per point" },
    ]);
  });

  it("gives the same raw with or without streams, so a re-import is unchanged", () => {
    const withoutStreams = {
      ...v2,
      activities: v2.activities.map(({ streams: _s, ...rest }) => rest),
    };
    expect(parseOk(text(withoutStreams)).activities).toEqual(result.activities);
  });
});

describe("readStoredSkipped", () => {
  it("reads the stored list back and ignores anything else", () => {
    const list = [
      { index: 2, name: null, startLocal: null, issues: [{ path: "activities[2]", message: "x" }] },
    ];
    expect(readStoredSkipped(list)).toEqual(list);
    expect(readStoredSkipped({ nope: true })).toEqual([]);
  });
});

// Local-only check against the real export (never committed): IMPORT_SAMPLE_FILE=/path/to/activities.json
// (The app's tsconfig has no Node types, hence the narrow casts.)
const sample = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
  ?.env.IMPORT_SAMPLE_FILE;
describe.skipIf(!sample)("the real sample export (local only)", () => {
  it("reads all 305 activities and splits rides from other sports", async () => {
    const fsModule = "node:fs";
    const fs = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync: (path: string, encoding: "utf8") => string;
    };
    const result = parseOk(fs.readFileSync(sample ?? "", "utf8"));
    const rides = result.activities.filter((a) => isRideSportType(a.sport_type)).length;
    console.warn(
      `sample: ${result.total} activities, ${rides} rides, ${result.total - rides} not a ride`,
    );
    expect(result.total).toBe(305);
    expect(result.activities).toHaveLength(305);
    expect(result.skipped).toEqual([]);
    expect(rides).toBe(208);
  });
});

// Local-only timing of a big v2 backfill with streams (not in CI):
// PARSE_BENCH_MB=50 pnpm exec vitest run src/features/import/parse.test.ts -t "big synthetic"
const benchMb = Number(
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
    .PARSE_BENCH_MB ?? 0,
);
describe.skipIf(!benchMb)("a big synthetic v2 export (local only)", () => {
  it("is read in a few seconds", () => {
    const points = 7200; // 2 h at 1 s
    const series = (f: (t: number) => number) => Array.from({ length: points }, (_, t) => f(t));
    const ride = (i: number) => ({
      ...v2.activities[0],
      id: 800000000 + i,
      streams: {
        time: series((t) => t),
        latlng: Array.from({ length: points }, (_, t) => [
          Math.round((50.85 + t * 1e-5) * 1e5) / 1e5,
          Math.round((4.35 + t * 1e-5) * 1e5) / 1e5,
        ]),
        altitude: series((t) => Math.round((20 + Math.sin(t / 300) * 15) * 10) / 10),
        heartrate: series((t) => 120 + (t % 40)),
        watts: series((t) => 150 + (t % 120)),
        cadence: series((t) => 80 + (t % 15)),
      },
    });
    const count = Math.ceil((benchMb * 1_000_000) / JSON.stringify(ride(0)).length);
    const file = JSON.stringify({
      version: 2,
      activities: Array.from({ length: count }, (_, i) => ride(i)),
    });
    const start = performance.now();
    const result = parseOk(file);
    const ms = performance.now() - start;
    console.warn(
      `parse: ${(file.length / 1_000_000).toFixed(1)} MB, ${count} rides × ${points} points, ${Math.round(ms)} ms`,
    );
    expect(result.streams).toHaveLength(count);
  });
});
