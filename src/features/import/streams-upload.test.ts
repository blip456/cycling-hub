import { describe, expect, it, vi } from "vitest";
import type { StoredStreamsState } from "./api";
import type { ActivityStreams } from "./parse";
import { canonicalStreamsJson, sha256Hex } from "./streams";
import {
  planUploads,
  prepareStreams,
  saveRideStreams,
  UPLOAD_CONCURRENCY,
  type StreamsDeps,
} from "./streams-upload";

const item = (stravaId: number, watts = 200): ActivityStreams => ({
  stravaId,
  streams: { time: [0, 1, 2], watts: [watts, watts + 1, watts + 2] },
});

const row = (
  strava_id: number,
  overrides: Partial<StoredStreamsState> = {},
): StoredStreamsState => ({
  strava_id,
  is_ride: true,
  deleted_at: null,
  streams_sha256: null,
  ...overrides,
});

const hashOf = (a: ActivityStreams) => sha256Hex(canonicalStreamsJson(a.streams));

function deps(overrides: Partial<StreamsDeps> = {}): StreamsDeps & {
  upload: ReturnType<typeof vi.fn>;
  markSaved: ReturnType<typeof vi.fn>;
} {
  return {
    fetchState: vi.fn(async (ids: readonly number[]) => ids.map((id) => row(id))),
    upload: vi.fn(async () => undefined),
    markSaved: vi.fn(async () => undefined),
    gzip: vi.fn(async (text: string) => new Blob([`gz:${text}`])),
    ...overrides,
  } as StreamsDeps & {
    upload: ReturnType<typeof vi.fn>;
    markSaved: ReturnType<typeof vi.fn>;
  };
}

describe("prepareStreams", () => {
  it("adds the canonical JSON, its SHA-256 and the number of points", async () => {
    const [prepared] = await prepareStreams([item(1)]);
    expect(prepared).toMatchObject({
      stravaId: 1,
      json: '{"time":[0,1,2],"watts":[200,201,202]}',
      points: 3,
    });
    expect(prepared?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("planUploads", () => {
  it("uploads new and changed streams, skips unchanged, deleted rides and non-rides", async () => {
    const prepared = await prepareStreams([item(1), item(2), item(3), item(4), item(5), item(6)]);
    const plan = planUploads(prepared, [
      row(1), // never stored
      row(2, { streams_sha256: await hashOf(item(2)) }), // same
      row(3, { streams_sha256: await hashOf(item(3, 999)) }), // changed
      row(4, { deleted_at: "2026-10-20T10:00:00Z" }), // deleted in the app (P15)
      row(5, { is_ride: false }), // not a ride
      // 6: no row (not stored)
    ]);
    expect(plan.upload.map((p) => p.stravaId)).toEqual([1, 3]);
    expect(plan.unchanged.map((p) => p.stravaId)).toEqual([2]);
    expect(plan.skipped.map((p) => p.stravaId)).toEqual([4, 5, 6]);
  });
});

describe("saveRideStreams", () => {
  it("does nothing without streams", async () => {
    const d = deps();
    expect(await saveRideStreams([], d)).toEqual({ saved: 0, uploaded: 0, failed: [] });
    expect(d.fetchState).not.toHaveBeenCalled();
  });

  it("uploads only changed rides, gzipped, then records the hash and points", async () => {
    const unchanged = item(2);
    const d = deps({
      fetchState: vi.fn(async () => [row(1), row(2, { streams_sha256: await hashOf(unchanged) })]),
    });
    const progress = vi.fn();
    const result = await saveRideStreams([item(1), unchanged], d, progress);

    expect(result).toEqual({ saved: 2, uploaded: 1, failed: [] });
    expect(d.fetchState).toHaveBeenCalledWith([1, 2]);
    expect(d.upload).toHaveBeenCalledTimes(1);
    const body = (d.upload.mock.calls[0]![0] as { stravaId: number; body: Blob }).body;
    expect(await body.text()).toBe('gz:{"time":[0,1,2],"watts":[200,201,202]}');
    expect(d.markSaved).toHaveBeenCalledWith({
      stravaId: 1,
      sha256: await hashOf(item(1)),
      points: 3,
    });
    expect(progress.mock.calls.map(([p]) => p as unknown)).toEqual([
      { done: 0, total: null },
      { done: 0, total: 1 },
      { done: 1, total: 1 },
    ]);
  });

  it("uploads at most a few at a time", async () => {
    let running = 0;
    let most = 0;
    const d = deps({
      upload: vi.fn(async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
      }),
    });
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1));
    const result = await saveRideStreams(items, d);
    expect(result.uploaded).toBe(10);
    expect(most).toBe(UPLOAD_CONCURRENCY);
  });

  it("returns failed uploads and failed hash updates so they can be tried again", async () => {
    const d = deps({
      upload: vi.fn(async ({ stravaId }: { stravaId: number }) => {
        if (stravaId === 2) throw new Error("Failed to fetch");
      }),
      markSaved: vi.fn(async ({ stravaId }: { stravaId: number }) => {
        if (stravaId === 3) throw new Error("Failed to fetch");
      }),
    });
    const result = await saveRideStreams([item(1), item(2), item(3)], d);
    expect(result.saved).toBe(1);
    expect(result.failed.map((f) => f.stravaId).sort()).toEqual([2, 3]);
    expect(result.failed[0]?.streams).toEqual(item(result.failed[0]!.stravaId).streams);

    // Retry with only the failed ones: everything works now.
    const retry = deps();
    const again = await saveRideStreams(result.failed, retry);
    expect(again).toEqual({ saved: 2, uploaded: 2, failed: [] });
    expect(
      retry.upload.mock.calls.map(([c]) => (c as { stravaId: number }).stravaId).sort(),
    ).toEqual([2, 3]);
  });

  it("treats every ride as failed when the stored state cannot be read", async () => {
    const d = deps({ fetchState: vi.fn(async () => Promise.reject(new Error("offline"))) });
    const result = await saveRideStreams([item(1), item(2)], d);
    expect(result).toEqual({ saved: 0, uploaded: 0, failed: [item(1), item(2)] });
    expect(d.upload).not.toHaveBeenCalled();
  });
});
