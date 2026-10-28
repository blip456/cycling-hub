import { describe, expect, it } from "vitest";
import { parseExport, readStoredSkipped, rejectTooLarge, toLocalDateTime } from "./parse";
import { isRideSportType } from "./sport-types";
import broken from "./fixtures/export-v1-broken.json";
import valid from "./fixtures/export-v1.json";
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
      text({ version: 2, activities: [] }),
      "Export version 2 is not supported yet.",
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
    expect(rejectTooLarge(60 * 1024 * 1024)?.message).toBe(
      "This file is too large: an export is at most 50 MB.",
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
      start_local: "2026-07-14T19:05:00",
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

  it("reads startDateLocal as wall-clock time and ignores the trailing Z (T5)", () => {
    const result = parseOk(
      text({
        version: 1,
        activities: [{ ...valid.activities[0], startDateLocal: "2026-07-14T23:30:00Z" }],
      }),
    );
    expect(result.activities[0]?.start_local).toBe("2026-07-14T23:30:00");
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
        startLocal: "2026-06-28T09:00:00",
        issues: [{ path: "activities[2].distance", message: "must be a number (metres)" }],
      },
      {
        index: 3,
        name: "Test commute",
        startLocal: "2026-06-24T08:10:00",
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

describe("toLocalDateTime", () => {
  it.each([
    ["2026-10-14T15:27:43Z", "2026-10-14T15:27:43"],
    ["2026-10-14T15:27:43", "2026-10-14T15:27:43"],
    ["2026-10-14T15:27:43.250Z", "2026-10-14T15:27:43"],
    ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00"],
    ["2026-02-29T00:00:00Z", null],
    ["2026-10-14T24:00:00Z", null],
    ["2026-10-14 15:27:43", null],
    ["2026-10-14T15:27:43+02:00", null],
    ["yesterday", null],
  ])("%s → %s", (input, expected) => {
    expect(toLocalDateTime(input)).toBe(expected);
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
