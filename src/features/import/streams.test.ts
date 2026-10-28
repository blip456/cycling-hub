import { describe, expect, it } from "vitest";
import {
  canonicalStreamsJson,
  readStreams,
  sha256Hex,
  streamsObjectName,
  type Streams,
} from "./streams";

const valid: Streams = {
  time: [0, 1, 1, 5],
  latlng: [[51.0445, 4.8906], null, [51.0446, 4.8907], [51.0447, 4.8908]],
  altitude: [12.4, 12.6, null, 13],
  heartrate: [98, 101, 103, null],
  watts: [0, 180, 210, 205],
  cadence: [0, 85, 88, 90],
  temperature: [14, 14, 14, 15],
};

describe("readStreams", () => {
  it("treats a missing or null field as no streams", () => {
    expect(readStreams(undefined)).toEqual({ kind: "none" });
    expect(readStreams(null)).toEqual({ kind: "none" });
  });

  it("accepts streams that follow the contract, also with only time", () => {
    expect(readStreams(valid)).toEqual({ kind: "valid", streams: valid });
    expect(readStreams({ time: [0] })).toEqual({ kind: "valid", streams: { time: [0] } });
  });

  it("keeps unknown keys", () => {
    const withUnknown = { ...valid, grade: [0, 1, "x", null] };
    expect(readStreams(withUnknown)).toEqual({ kind: "valid", streams: withUnknown });
  });

  it.each([
    ["not an object", [1, 2], "streams is not valid"],
    ["no time", { watts: [1] }, "streams.time"],
    ["an empty time", { time: [] }, "streams.time"],
    ["time going back", { time: [0, 2, 1] }, "streams.time.2 must be whole seconds in time order"],
    ["fractions of a second", { time: [0, 1.5] }, "streams.time.1 must be whole seconds"],
    ["negative time", { time: [-1, 0] }, "streams.time.0 must be whole seconds"],
    ["time as text", { time: ["0"] }, "streams.time.0 must be whole seconds"],
    [
      "a shorter column",
      { time: [0, 1], watts: [1] },
      "streams.watts must have one entry per point",
    ],
    ["a column that is not a list", { time: [0], watts: 5 }, "streams.watts must have one entry"],
    ["text in a number column", { time: [0, 1], heartrate: [90, "91"] }, "streams.heartrate.1"],
    ["a bad latlng pair", { time: [0, 1], latlng: [[51, 4], [51]] }, "streams.latlng.1"],
    ["latlng out of range", { time: [0], latlng: [[91, 4]] }, "streams.latlng.0"],
    ["latlng as numbers", { time: [0], latlng: [51] }, "streams.latlng.0 is not a valid value"],
  ])("rejects %s", (_, input, reason) => {
    const result = readStreams(input);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") expect(result.reason).toContain(reason);
  });
});

describe("canonicalStreamsJson and sha256Hex", () => {
  it("writes the keys in alphabetical order, so the key order of the export does not matter", () => {
    const reordered: Streams = { watts: [1, 2], time: [0, 1] };
    expect(canonicalStreamsJson(reordered)).toBe('{"time":[0,1],"watts":[1,2]}');
    expect(canonicalStreamsJson({ time: [0, 1], watts: [1, 2] })).toBe(
      canonicalStreamsJson(reordered),
    );
  });

  it("hashes text as SHA-256 hex", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("streamsObjectName", () => {
  it("puts the file in the user's folder (storage policy) named by the Strava ID", () => {
    expect(streamsObjectName("1111-aaaa", 1234567890123)).toBe("1111-aaaa/1234567890123.json.gz");
  });
});
