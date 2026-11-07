import { describe, expect, it, vi } from "vitest";
import {
  loadRideStreams,
  MAX_RIDES,
  scanFtp,
  scanHeartRate,
  type LoadProgress,
  type StreamRide,
} from "./stream-source";

/** A ride file with `seconds` of constant power and heart rate, one point per second. */
function file(seconds: number, watts: number | null, heartrate: number | null = null) {
  return {
    time: Array.from({ length: seconds }, (_, i) => i),
    watts: Array.from({ length: seconds }, () => watts),
    heartrate: Array.from({ length: seconds }, () => heartrate),
  };
}

function rides(count: number): StreamRide[] {
  return Array.from({ length: count }, (_, i) => ({ id: `ride-${String(i)}`, stravaId: 1000 + i }));
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe("loadRideStreams", () => {
  it("yields the rides in the order given, reading one file per ride", async () => {
    const download = vi.fn(async () => file(10, 200));
    const out = await collect(loadRideStreams(rides(3), { channel: "watts", download }));
    expect(out.map((r) => r.id)).toEqual(["ride-0", "ride-1", "ride-2"]);
    expect(download).toHaveBeenCalledTimes(3);
    expect(out[0]?.stream?.values[0]).toBe(200);
  });

  it("reads at most 60 rides", async () => {
    const download = vi.fn(async () => file(5, 100));
    const out = await collect(loadRideStreams(rides(80), { channel: "watts", download }));
    expect(out).toHaveLength(MAX_RIDES);
    expect(download).toHaveBeenCalledTimes(60);
  });

  it("reads lazily: a consumer that stops early causes no further downloads", async () => {
    const download = vi.fn(async () => file(5, 100));
    const generator = loadRideStreams(rides(10), { channel: "watts", download });
    await generator.next();
    await generator.return(undefined);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("yields a null stream for a missing file and for a file without the channel", async () => {
    const download = vi.fn(async (ride: StreamRide) =>
      ride.id === "ride-0" ? null : { time: [0, 1], heartrate: [100, 100] },
    );
    const out = await collect(loadRideStreams(rides(2), { channel: "watts", download }));
    expect(out.map((r) => r.stream)).toEqual([null, null]);
  });

  it("counts the files it could not read, apart from missing ones, and reports progress", async () => {
    const download = vi.fn(async (ride: StreamRide) => {
      if (ride.id === "ride-1") throw new Error("network");
      if (ride.id === "ride-2") return null;
      return file(5, 100);
    });
    const progress: LoadProgress[] = [];
    let failed: string[] = [];
    await collect(
      loadRideStreams(rides(3), {
        channel: "watts",
        download,
        onProgress: (p) => progress.push(p),
        onFailed: (ids) => {
          failed = ids;
        },
      }),
    );
    expect(failed).toEqual(["ride-1"]);
    expect(progress[0]).toEqual({ done: 0, total: 3, failed: 0 });
    expect(progress.at(-1)).toEqual({ done: 3, total: 3, failed: 1 });
  });

  it("stops when the signal aborts", async () => {
    const controller = new AbortController();
    const download = vi.fn(async () => {
      controller.abort();
      return file(5, 100);
    });
    const out = await collect(
      loadRideStreams(rides(5), { channel: "watts", download, signal: controller.signal }),
    );
    expect(out).toHaveLength(1);
    expect(download).toHaveBeenCalledTimes(1);
  });
});

describe("scanFtp", () => {
  it("finds the best 20 minutes across rides, newest first, and says which ride", async () => {
    const download = async (ride: StreamRide) =>
      ride.id === "ride-1" ? file(1500, 280) : file(1500, 200);
    const scan = await scanFtp(rides(3), { download });
    expect(scan.result).toMatchObject({ ftp: 266, avg20MinW: 280, rideId: "ride-1" });
    expect(scan.checked).toBe(3);
    expect(scan.failed).toBe(0);
  });

  it("suggests from the rest when some files fail, and counts the failures", async () => {
    const download = async (ride: StreamRide) => {
      if (ride.id === "ride-0") throw new Error("network");
      return file(1500, 250);
    };
    const scan = await scanFtp(rides(3), { download });
    expect(scan.result?.ftp).toBe(238);
    expect(scan.failed).toBe(1);
    expect(scan.checked).toBe(3);
  });

  it("has no suggestion when no ride has 20 minutes of power", async () => {
    const scan = await scanFtp(rides(2), { download: async () => file(600, 300) });
    expect(scan.result).toBeNull();
  });

  it("has no suggestion without rides", async () => {
    const scan = await scanFtp([], { download: async () => file(10, 100) });
    expect(scan).toEqual({ result: null, checked: 0, failed: 0 });
  });
});

describe("scanHeartRate", () => {
  it("finds the highest sustained heart rate and ignores a short spike", async () => {
    const spike = file(60, null, 150);
    spike.heartrate[30] = 250;
    const download = async (ride: StreamRide) =>
      ride.id === "ride-0" ? spike : file(60, null, 181);
    const scan = await scanHeartRate(rides(2), { download });
    expect(scan.result).toMatchObject({ bpm: 181, rideId: "ride-1" });
  });
});
