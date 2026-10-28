import {
  findBestFtpEstimate,
  findHighestHeartRate,
  readChannel,
  type FtpEstimate,
  type HeartRateSuggestion,
  type RideStream,
} from "@/features/athlete";

/** The newest rides that are looked at (P54). */
export const MAX_RIDES = 60;

/** A ride the loader reads: `id` is the activity id, `stravaId` names the file in Storage. */
export type StreamRide = { id: string; stravaId: number };

/** Downloads and parses one ride's streams. Null when the ride has no stored file. Throws when it cannot be read. */
export type StreamDownloader = (ride: StreamRide) => Promise<unknown>;

export type LoadProgress = {
  /** Rides handled so far (read, missing or failed). */
  done: number;
  total: number;
  /** Rides whose file could not be read (not the same as missing). */
  failed: number;
};

export type LoaderOptions = {
  channel: "watts" | "heartrate";
  download: StreamDownloader;
  signal?: AbortSignal;
  onProgress?: (progress: LoadProgress) => void;
  /** Called with the ids of the rides that could not be read, when the loader is done. */
  onFailed?: (rideIds: string[]) => void;
};

/**
 * Reads the rides' streams one at a time, in the order given (newest first), at most `MAX_RIDES`, and
 * yields each as a `RideStream` for the athlete calculations. Only one ride is in memory at a time. A ride
 * without a stored file, or that cannot be read, yields a null stream; the ones that cannot be read are
 * counted separately (`onFailed`) so the screen can say "based on 115 of 118 rides".
 */
export async function* loadRideStreams(
  rides: readonly StreamRide[],
  options: LoaderOptions,
): AsyncGenerator<RideStream> {
  const list = rides.slice(0, MAX_RIDES);
  const failed: string[] = [];
  let done = 0;
  options.onProgress?.({ done, total: list.length, failed: 0 });
  try {
    for (const ride of list) {
      if (options.signal?.aborted) return;
      let stream: RideStream["stream"] = null;
      try {
        const parsed = await options.download(ride);
        stream = parsed === null ? null : readChannel(parsed, options.channel);
      } catch {
        failed.push(ride.id);
      }
      done += 1;
      options.onProgress?.({ done, total: list.length, failed: failed.length });
      yield { id: ride.id, stream };
    }
  } finally {
    options.onFailed?.(failed);
  }
}

export type SuggestionScan<T> = {
  result: T | null;
  /** Rides looked at. */
  checked: number;
  /** Rides whose file could not be read. */
  failed: number;
};

async function scan<T>(
  rides: readonly StreamRide[],
  options: Omit<LoaderOptions, "onFailed">,
  run: (stream: AsyncGenerator<RideStream>) => Promise<T | null>,
): Promise<SuggestionScan<T>> {
  let failed = 0;
  const generator = loadRideStreams(rides, {
    ...options,
    onFailed: (ids) => {
      failed = ids.length;
    },
  });
  const result = await run(generator);
  await generator.return(undefined);
  const checked = Math.min(rides.length, MAX_RIDES);
  return { result, checked, failed };
}

/** The best FTP estimate in the rides' power streams (P41): 95 % of the best 20 minutes. */
export function scanFtp(
  rides: readonly StreamRide[],
  options: Omit<LoaderOptions, "channel" | "onFailed">,
): Promise<SuggestionScan<FtpEstimate>> {
  return scan(rides, { ...options, channel: "watts" }, (rideStreams) =>
    findBestFtpEstimate(rideStreams, {
      maxRides: MAX_RIDES,
      ...(options.signal ? { signal: options.signal } : {}),
    }),
  );
}

/** The highest sustained heart rate in the rides' heart rate streams (P42). */
export function scanHeartRate(
  rides: readonly StreamRide[],
  options: Omit<LoaderOptions, "channel" | "onFailed">,
): Promise<SuggestionScan<HeartRateSuggestion>> {
  return scan(rides, { ...options, channel: "heartrate" }, (rideStreams) =>
    findHighestHeartRate(rideStreams, {
      maxRides: MAX_RIDES,
      ...(options.signal ? { signal: options.signal } : {}),
    }),
  );
}

// ---- reading a stored file ------------------------------------------------------------------------

/** True for the two magic bytes at the start of a gzip file. */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Parses a stored streams file: gzipped JSON (T13), decompressed in the browser with `DecompressionStream`.
 * A file that is not gzip is read as plain JSON, which the bucket also accepts.
 */
export async function parseStreamsFile(blob: Blob): Promise<unknown> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!isGzip(bytes)) return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return (await new Response(stream).json()) as unknown;
}
