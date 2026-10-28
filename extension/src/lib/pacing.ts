/** Spacing between requests to Strava, and an abortable sleep. */

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export const sleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export type Paced = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Runs tasks one at a time with at least `intervalMs` between the end of one task and the start of
 * the next (so the gap between two requests is never shorter, however long a request takes). The
 * first task starts at once.
 */
export function createPacer(
  intervalMs: number,
  options: { now?: () => number; sleep?: Sleep; signal?: AbortSignal } = {},
): Paced {
  const now = options.now ?? (() => Date.now());
  const wait = options.sleep ?? sleep;
  let last: number | null = null;
  return async (task) => {
    if (last !== null) {
      const remaining = last + intervalMs - now();
      if (remaining > 0) await wait(remaining, options.signal);
    }
    try {
      return await task();
    } finally {
      last = now();
    }
  };
}
