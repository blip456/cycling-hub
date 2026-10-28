import type { StoredStreamsState } from "./api";
import type { ActivityStreams } from "./parse";
import { canonicalStreamsJson, sha256Hex, type Gzip } from "./streams";

/**
 * Saves the per-second data of the imported rides in Storage (T12), after `import_activities()` has
 * saved the file. Only new or changed streams are uploaded: the SHA-256 of the canonical JSON is
 * compared with `activities.streams_sha256`. Rides deleted in the app (P15) and activities that are not
 * rides are skipped. A failed upload does not undo the import; the failed rides can be tried again.
 */

/** Uploads at the same time. */
export const UPLOAD_CONCURRENCY = 4;

export type PreparedStreams = ActivityStreams & { json: string; sha256: string; points: number };

export type UploadPlan = {
  /** New or changed: upload. */
  upload: PreparedStreams[];
  /** Same hash as stored: nothing to do. */
  unchanged: PreparedStreams[];
  /** Not stored, deleted in the app, or not a ride. */
  skipped: PreparedStreams[];
};

export function planUploads(
  prepared: readonly PreparedStreams[],
  stored: readonly StoredStreamsState[],
): UploadPlan {
  const byId = new Map(stored.map((row) => [row.strava_id, row]));
  const plan: UploadPlan = { upload: [], unchanged: [], skipped: [] };
  for (const item of prepared) {
    const row = byId.get(item.stravaId);
    if (!row || row.deleted_at !== null || row.is_ride !== true) plan.skipped.push(item);
    else if (row.streams_sha256 === item.sha256) plan.unchanged.push(item);
    else plan.upload.push(item);
  }
  return plan;
}

export async function prepareStreams(
  items: readonly ActivityStreams[],
): Promise<PreparedStreams[]> {
  return Promise.all(
    items.map(async (item) => {
      const json = canonicalStreamsJson(item.streams);
      return { ...item, json, sha256: await sha256Hex(json), points: item.streams.time.length };
    }),
  );
}

export type StreamsDeps = {
  fetchState: (stravaIds: readonly number[]) => Promise<StoredStreamsState[]>;
  upload: (input: { stravaId: number; body: Blob }) => Promise<void>;
  markSaved: (input: { stravaId: number; sha256: string; points: number }) => Promise<void>;
  gzip: Gzip;
};

export type StreamsProgress = { done: number; total: number | null };

export type StreamsSaveResult = {
  /** Rides whose streams are now stored: uploaded now or already the same. */
  saved: number;
  uploaded: number;
  /** Could not be saved; pass these to saveRideStreams again to retry. */
  failed: ActivityStreams[];
};

export async function saveRideStreams(
  items: readonly ActivityStreams[],
  deps: StreamsDeps,
  onProgress: (progress: StreamsProgress) => void = () => undefined,
): Promise<StreamsSaveResult> {
  if (items.length === 0) return { saved: 0, uploaded: 0, failed: [] };
  onProgress({ done: 0, total: null });

  let plan: UploadPlan;
  try {
    const prepared = await prepareStreams(items);
    plan = planUploads(prepared, await deps.fetchState(prepared.map((p) => p.stravaId)));
  } catch {
    // Nothing is known about what is stored: try them all again later.
    return { saved: 0, uploaded: 0, failed: [...items] };
  }

  const total = plan.upload.length;
  const failed: ActivityStreams[] = [];
  let done = 0;
  onProgress({ done, total });

  const queue = [...plan.upload];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        await deps.upload({ stravaId: item.stravaId, body: await deps.gzip(item.json) });
        await deps.markSaved({ stravaId: item.stravaId, sha256: item.sha256, points: item.points });
      } catch {
        failed.push({ stravaId: item.stravaId, streams: item.streams });
      }
      done += 1;
      onProgress({ done, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, total) }, worker));

  const uploaded = total - failed.length;
  return { saved: plan.unchanged.length + uploaded, uploaded, failed };
}
