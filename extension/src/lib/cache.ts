/** Cache of GPX results, so a later export only downloads new or changed rides. */
import type { GpxSummary } from "./types";

export interface CacheEntry {
  id: number;
  /** `fingerprint()` of the list values when the GPX was read. */
  fingerprint: string;
  summary: GpxSummary;
  savedAt: string;
}

export interface GpxCache {
  get(id: number): Promise<CacheEntry | undefined>;
  put(entry: CacheEntry): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
}

/** A cached result is reused only for the same fingerprint, and never when the download failed. */
export function isUsable(entry: CacheEntry | undefined, fingerprint: string): entry is CacheEntry {
  return (
    entry !== undefined &&
    entry.fingerprint === fingerprint &&
    (entry.summary.details === "gpx" || entry.summary.details === "no_gpx")
  );
}

/** Only real results are cached: a failed download is tried again next export. */
export function isCacheable(summary: GpxSummary): boolean {
  return summary.details === "gpx" || summary.details === "no_gpx";
}

export function memoryCache(): GpxCache {
  const entries = new Map<number, CacheEntry>();
  return {
    get: (id) => Promise.resolve(entries.get(id)),
    put: (entry) => {
      entries.set(entry.id, entry);
      return Promise.resolve();
    },
    clear: () => {
      entries.clear();
      return Promise.resolve();
    },
    count: () => Promise.resolve(entries.size),
  };
}

const DB_NAME = "cycling-hub-extension";
const STORE = "gpx";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function openDb(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE, { keyPath: "id" });
  };
  return request(req);
}

/** IndexedDB on the extension's origin (with the unlimitedStorage permission). */
export function indexedDbCache(): GpxCache {
  let db: Promise<IDBDatabase> | null = null;
  const store = async (mode: IDBTransactionMode) => {
    db ??= openDb();
    return (await db).transaction(STORE, mode).objectStore(STORE);
  };
  return {
    get: async (id) => (await request((await store("readonly")).get(id))) as CacheEntry | undefined,
    put: async (entry) => {
      await request((await store("readwrite")).put(entry));
    },
    clear: async () => {
      await request((await store("readwrite")).clear());
    },
    count: async () => request((await store("readonly")).count()),
  };
}
