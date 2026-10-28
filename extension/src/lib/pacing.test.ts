import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPacer, sleep } from "./pacing";

describe("createPacer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const task = (ms: number, starts: number[]) => () => {
    starts.push(Date.now());
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve("done");
      }, ms);
    });
  };

  it("starts the first task at once and spaces the next ones from the end of the previous", async () => {
    const paced = createPacer(2000);
    const starts: number[] = [];
    const t0 = Date.now();
    const run = (async () => {
      for (let i = 0; i < 3; i++) expect(await paced(task(500, starts))).toBe("done");
    })();
    await vi.advanceTimersByTimeAsync(20_000);
    await run;
    // Each task takes 500 ms, then 2000 ms pause: starts at 0, 2500, 5000.
    expect(starts.map((t) => t - t0)).toEqual([0, 2500, 5000]);
  });

  it("does not wait when enough time has passed already", async () => {
    const paced = createPacer(1000);
    await paced(() => Promise.resolve());
    vi.advanceTimersByTime(1500);
    const before = Date.now();
    await paced(() => Promise.resolve());
    expect(Date.now()).toBe(before);
  });

  it("waits only the rest of the interval", async () => {
    const paced = createPacer(1000);
    await paced(() => Promise.resolve());
    vi.advanceTimersByTime(400);
    let started = false;
    const next = paced(() => {
      started = true;
      return Promise.resolve();
    });
    await vi.advanceTimersByTimeAsync(599);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(started).toBe(true);
  });

  it("also spaces out after a task that failed", async () => {
    const paced = createPacer(1000);
    await expect(paced(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    let started = false;
    const next = paced(() => {
      started = true;
      return Promise.resolve();
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(started).toBe(true);
  });
});

describe("sleep", () => {
  it("rejects when aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const waiting = sleep(10_000, controller.signal);
    controller.abort(new Error("stop"));
    await expect(waiting).rejects.toThrow("stop");
    vi.useRealTimers();
  });
});
