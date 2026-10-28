import { describe, expect, it } from "vitest";
import { isCacheable, isUsable, memoryCache, type CacheEntry } from "./cache";
import { summaryWithout } from "./types";

const entry = (details: "gpx" | "no_gpx" | "failed", fp = "1000|300|320|Ride"): CacheEntry => ({
  id: 1,
  fingerprint: fp,
  summary: { ...summaryWithout("no_gpx"), details },
  savedAt: "2026-10-28T10:00:00.000Z",
});

describe("isUsable", () => {
  it("reuses a GPX or no-GPX result with the same fingerprint", () => {
    expect(isUsable(entry("gpx"), "1000|300|320|Ride")).toBe(true);
    expect(isUsable(entry("no_gpx"), "1000|300|320|Ride")).toBe(true);
  });

  it("downloads again when the ride changed, was never read, or failed", () => {
    expect(isUsable(entry("gpx"), "1001|300|320|Ride")).toBe(false);
    expect(isUsable(undefined, "1000|300|320|Ride")).toBe(false);
    expect(isUsable(entry("failed"), "1000|300|320|Ride")).toBe(false);
  });
});

describe("isCacheable", () => {
  it("never caches failed or skipped results", () => {
    expect(isCacheable(summaryWithout("failed"))).toBe(false);
    expect(isCacheable(summaryWithout("skipped"))).toBe(false);
    expect(isCacheable(summaryWithout("no_gpx"))).toBe(true);
  });
});

describe("memoryCache", () => {
  it("stores, counts and clears", async () => {
    const cache = memoryCache();
    await cache.put(entry("gpx"));
    expect(await cache.get(1)).toEqual(entry("gpx"));
    expect(await cache.count()).toBe(1);
    await cache.clear();
    expect(await cache.get(1)).toBeUndefined();
  });
});
