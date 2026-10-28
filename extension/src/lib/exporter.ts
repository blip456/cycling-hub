/** The whole export: read the list, add GPX details per ride (cached), build the v2 file. */
import { isRideSportType } from "../../../src/features/import/sport-types";
import { isCacheable, isUsable, type GpxCache } from "./cache";
import { createPacer, sleep as realSleep, type Sleep } from "./pacing";
import { fetchGpx, fetchListPage, RateLimitError, StravaError, type Fetch } from "./strava-client";
import { fingerprint, readActivityList } from "./strava-list";
import { summarize } from "./summary";
import {
  summaryWithout,
  type ExportActivity,
  type ExportFile,
  type GpxSummary,
  type ListActivity,
} from "./types";

/** At least this long between two list pages. */
export const LIST_INTERVAL_MS = 1000;
/** At least this long between two GPX downloads. */
export const GPX_INTERVAL_MS = 2000;

export type Progress =
  | { phase: "list"; read: number; total: number | null }
  | { phase: "details"; done: number; total: number; secondsLeft: number };

export interface ExportSummary {
  activities: number;
  rides: number;
  ridesWithGpx: number;
  ridesWithoutGpx: number;
  failed: number;
  downloaded: number;
  fromCache: number;
  unreadable: number;
  rateLimited: boolean;
}

export interface ExportResult {
  file: ExportFile;
  summary: ExportSummary;
}

export interface ExportOptions {
  version: string;
  cache: GpxCache;
  fetch: Fetch;
  sleep?: Sleep;
  now?: () => number;
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
  listIntervalMs?: number;
  gpxIntervalMs?: number;
  /** For tests; a new random UUID per export run otherwise. */
  searchSessionId?: string;
}

function newestFirst(a: ExportActivity, b: ExportActivity): number {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
  return b.id - a.id;
}

export function buildExportFile(
  activities: readonly ExportActivity[],
  exportedAt: Date,
  version: string,
): ExportFile {
  return {
    version: 2,
    exportedAt: exportedAt.toISOString(),
    source: `cycling-hub-extension ${version}`,
    activities: [...activities].sort(newestFirst),
  };
}

/** `cycling-hub-export-YYYY-MM-DD.json`, with the local date of the export. */
export function exportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `cycling-hub-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

function combine(activity: ListActivity, summary: GpxSummary): ExportActivity {
  return { ...activity, ...summary };
}

export async function runExport(options: ExportOptions): Promise<ExportResult> {
  const { cache, signal, onProgress } = options;
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? (() => Date.now());
  const gpxInterval = options.gpxIntervalMs ?? GPX_INTERVAL_MS;
  const pacerOptions = { now, sleep, ...(signal ? { signal } : {}) };

  // One search session per export run, like Strava's own "My Activities" page.
  const searchSessionId = options.searchSessionId ?? crypto.randomUUID();
  const listPaced = createPacer(options.listIntervalMs ?? LIST_INTERVAL_MS, pacerOptions);
  const list = await readActivityList({
    fetchPage: (page) =>
      listPaced(() => fetchListPage(options.fetch, page, searchSessionId, sleep, signal)),
    ...(signal ? { signal } : {}),
    onProgress: (read, total) => onProgress?.({ phase: "list", read, total }),
  });

  const summary: ExportSummary = {
    activities: list.activities.length,
    rides: 0,
    ridesWithGpx: 0,
    ridesWithoutGpx: 0,
    failed: 0,
    downloaded: 0,
    fromCache: 0,
    unreadable: list.unreadable,
    rateLimited: false,
  };

  // Rides first look in the cache; what's left is downloaded one at a time.
  const results = new Map<number, GpxSummary>();
  const toDownload: ListActivity[] = [];
  for (const activity of list.activities) {
    if (!isRideSportType(activity.sportType)) {
      results.set(activity.id, summaryWithout("skipped"));
      continue;
    }
    summary.rides++;
    const cached = await cache.get(activity.id).catch(() => undefined);
    if (isUsable(cached, fingerprint(activity))) {
      results.set(activity.id, cached.summary);
      summary.fromCache++;
    } else {
      toDownload.push(activity);
    }
  }
  // Newest rides first, so a stopped or rate-limited export has the recent ones.
  toDownload.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const gpxPaced = createPacer(gpxInterval, pacerOptions);
  const started = now();
  const report = (done: number) => {
    const remaining = toDownload.length - done;
    const perRide = done > 0 ? Math.max(gpxInterval, (now() - started) / done) : gpxInterval;
    onProgress?.({
      phase: "details",
      done,
      total: toDownload.length,
      secondsLeft: Math.ceil((remaining * perRide) / 1000),
    });
  };
  if (toDownload.length > 0) report(0);

  for (const [index, activity] of toDownload.entries()) {
    signal?.throwIfAborted();
    if (summary.rateLimited) {
      results.set(activity.id, summaryWithout("failed"));
      continue;
    }
    let result: GpxSummary;
    try {
      const download = await gpxPaced(() => fetchGpx(options.fetch, activity.id, sleep, signal));
      result = download.kind === "gpx" ? summarize(download.points) : summaryWithout("no_gpx");
      summary.downloaded++;
    } catch (error) {
      if (error instanceof RateLimitError) summary.rateLimited = true;
      else if (!(error instanceof StravaError)) throw error;
      result = summaryWithout("failed");
    }
    results.set(activity.id, result);
    if (isCacheable(result)) {
      await cache
        .put({
          id: activity.id,
          fingerprint: fingerprint(activity),
          summary: result,
          savedAt: new Date(now()).toISOString(),
        })
        .catch(() => undefined);
    }
    report(index + 1);
  }

  const activities = list.activities.map((activity) =>
    combine(activity, results.get(activity.id) ?? summaryWithout("failed")),
  );
  for (const activity of activities) {
    if (activity.details === "gpx") summary.ridesWithGpx++;
    else if (activity.details === "no_gpx") summary.ridesWithoutGpx++;
    else if (activity.details === "failed") summary.failed++;
  }
  return { file: buildExportFile(activities, new Date(now()), options.version), summary };
}
