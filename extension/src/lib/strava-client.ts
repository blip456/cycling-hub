/** The two Strava calls, with the error handling the export needs. Runs on the extension page. */
import { parseGpx, type TrackPoint } from "./gpx";
import type { Sleep } from "./pacing";
import { listPageUrl, readListPage, type ListPage } from "./strava-list";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Strava sent a sign-in page, a redirect to it, or 401/403 instead of data. */
export class SignInError extends Error {
  constructor() {
    super("Sign in to Strava in this browser, then try again.");
    this.name = "SignInError";
  }
}

/** Strava still answered 429 after waiting once. */
export class RateLimitError extends Error {
  constructor() {
    super("Strava asked to slow down.");
    this.name = "RateLimitError";
  }
}

/** Any other answer we can't use (5xx, network error, unexpected status). */
export class StravaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaError";
  }
}

export const gpxUrl = (id: number) => `https://www.strava.com/activities/${id}/export_gpx`;

/** Default wait after a 429 when Strava sends no Retry-After; the wait is capped at 15 minutes. */
export const DEFAULT_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export function backoffMs(response: Response): number {
  const header = response.headers.get("Retry-After");
  const seconds = header === null ? Number.NaN : Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  return DEFAULT_BACKOFF_MS;
}

function isSignInRedirect(response: Response): boolean {
  if (!response.redirected || !response.url) return false;
  try {
    return /^\/(login|session|onboarding|register)/.test(new URL(response.url).pathname);
  } catch {
    return false;
  }
}

/** Fetches once; on 429 waits (Retry-After or 60 s) and tries exactly once more. */
export async function fetchWithRetry(
  fetchFn: Fetch,
  url: string,
  init: RequestInit,
  wait: Sleep,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StravaError("Strava could not be reached.");
  }
  if (response.status !== 429) return response;
  await wait(backoffMs(response), init.signal ?? undefined);
  try {
    response = await fetchFn(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StravaError("Strava could not be reached.");
  }
  if (response.status === 429) throw new RateLimitError();
  return response;
}

export async function fetchListPage(
  fetchFn: Fetch,
  page: number,
  searchSessionId: string,
  wait: Sleep,
  signal?: AbortSignal,
): Promise<ListPage> {
  const response = await fetchWithRetry(
    fetchFn,
    listPageUrl(page, searchSessionId),
    {
      credentials: "include",
      headers: {
        Accept: "application/json, text/javascript",
        "X-Requested-With": "XMLHttpRequest",
      },
      ...(signal ? { signal } : {}),
    },
    wait,
  );
  if (response.status === 401 || response.status === 403 || isSignInRedirect(response)) {
    throw new SignInError();
  }
  if (!response.ok) throw new StravaError(`Strava answered ${response.status}.`);
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // An HTML page instead of JSON: Strava's sign-in page.
    throw new SignInError();
  }
  const result = readListPage(body);
  if (!result) throw new SignInError();
  return result;
}

export type GpxDownload = { kind: "gpx"; points: TrackPoint[] } | { kind: "no_gpx" };

/**
 * Downloads and parses one GPX. 4xx answers, HTML and GPX files without a track are "no_gpx";
 * a sign-in redirect or 401 throws SignInError; 5xx and network errors throw StravaError.
 */
export async function fetchGpx(
  fetchFn: Fetch,
  id: number,
  wait: Sleep,
  signal?: AbortSignal,
): Promise<GpxDownload> {
  const response = await fetchWithRetry(
    fetchFn,
    gpxUrl(id),
    { credentials: "include", ...(signal ? { signal } : {}) },
    wait,
  );
  if (response.status === 401 || isSignInRedirect(response)) throw new SignInError();
  if (response.status >= 500) throw new StravaError(`Strava answered ${response.status}.`);
  if (!response.ok) return { kind: "no_gpx" };
  const parsed = parseGpx(await response.text());
  if (parsed.kind === "not_gpx" || parsed.points.length === 0) return { kind: "no_gpx" };
  return parsed;
}
