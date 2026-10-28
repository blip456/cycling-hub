import type { ListActivity } from "./types";

/**
 * The call behind Strava's "My Activities" page, as the PO captured it in DevTools on 28 Oct 2026.
 * Adjust here if Strava changes it. `{session}` is replaced by a fresh `search_session_id` per export
 * run (Strava's page generates one per search), `{page}` by the page number (1, 2, …). Strava answers
 * with 20 models per page and the `total`.
 */
export const LIST_URL_TEMPLATE =
  "https://www.strava.com/athlete/training_activities?keywords=&sport_type=&tags=&commute=" +
  "&private_activities=&trainer=&gear=&search_session_id={session}&new_activity_only=false" +
  "&page={page}";

export function listPageUrl(page: number, searchSessionId: string): string {
  return LIST_URL_TEMPLATE.replace("{session}", encodeURIComponent(searchSessionId)).replace(
    "{page}",
    String(page),
  );
}

/** Safety net against an endless loop when Strava never sends an empty page. */
export const MAX_LIST_PAGES = 2000;

export interface ListPage {
  models: unknown[];
  total: number | null;
}

type Model = Record<string, unknown>;

function isRecord(value: unknown): value is Model {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: unknown): number {
  const n = finiteNumber(value);
  return n !== null && n > 0 ? n : 0;
}

/** Reads one list response. Returns null when it is not the JSON shape we expect. */
export function readListPage(body: unknown): ListPage | null {
  if (!isRecord(body) || !Array.isArray(body.models)) return null;
  const total = finiteNumber(body.total);
  return { models: body.models, total };
}

/** Unix seconds of the local wall clock → `YYYY-MM-DDTHH:MM:SS` without a zone (T11). */
export function localWallClock(raw: number): string {
  return new Date(raw * 1000).toISOString().slice(0, 19);
}

const START_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

/** `2026-10-18T06:04:40+0000` (or any offset, or `Z`) → `2026-10-18T06:04:40Z`. */
export function utcStartDate(startTime: string): string | null {
  const match = START_TIME.exec(startTime.trim());
  if (!match) return null;
  const [, date, time, zone] = match;
  let offset = zone ?? "Z";
  if (offset !== "Z" && !offset.includes(":")) offset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const instant = new Date(`${date ?? ""}T${time ?? ""}${offset}`);
  if (Number.isNaN(instant.getTime())) return null;
  return `${instant.toISOString().slice(0, 19)}Z`;
}

/** Maps one model of the list to the export fields. Returns null for a model we can't read. */
export function mapListModel(model: unknown): ListActivity | null {
  if (!isRecord(model)) return null;
  const id = finiteNumber(model.id);
  const localRaw = finiteNumber(model.start_date_local_raw);
  const startDate = typeof model.start_time === "string" ? utcStartDate(model.start_time) : null;
  const sportType = typeof model.sport_type === "string" ? model.sport_type : null;
  if (id === null || id <= 0 || !Number.isInteger(id) || localRaw === null) return null;
  if (startDate === null || sportType === null) return null;

  const activity: ListActivity = {
    id,
    name: typeof model.name === "string" ? model.name : "",
    sportType,
    startDateLocal: localWallClock(localRaw),
    startDate,
    distance: nonNegative(model.distance_raw),
    movingTime: nonNegative(model.moving_time_raw),
    elevation: nonNegative(model.elevation_gain_raw),
    commute: model.commute === true,
    trainer: model.trainer === true,
  };
  const elapsed = finiteNumber(model.elapsed_time_raw);
  if (elapsed !== null) activity.elapsedTime = Math.max(0, elapsed);
  if (typeof model.private === "boolean") activity.private = model.private;
  if (typeof model.has_latlng === "boolean") activity.hasLatlng = model.has_latlng;
  if ("bike_id" in model) activity.gearId = finiteNumber(model.bike_id);
  if (typeof model.description === "string") activity.description = model.description;
  return activity;
}

/**
 * Fingerprint of the list values that change when a ride is edited or replaced on Strava. A cached
 * GPX result is reused only while the fingerprint is the same.
 */
export function fingerprint(activity: ListActivity): string {
  return [
    activity.distance,
    activity.movingTime,
    activity.elapsedTime ?? "",
    activity.sportType,
  ].join("|");
}

export interface ReadListOptions {
  /** Fetches one page; the caller spaces the requests out. */
  fetchPage: (page: number) => Promise<ListPage>;
  signal?: AbortSignal;
  onProgress?: (read: number, total: number | null) => void;
}

export interface ListResult {
  activities: ListActivity[];
  /** Models that could not be read (missing id or start time). */
  unreadable: number;
}

/** Reads every page until `total` items are in or a page has no models. */
export async function readActivityList(options: ReadListOptions): Promise<ListResult> {
  const { fetchPage, signal, onProgress } = options;
  const byId = new Map<number, ListActivity>();
  let unreadable = 0;
  let seen = 0;
  let total: number | null = null;

  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    if (result.total !== null) total = result.total;
    if (result.models.length === 0) break;
    for (const model of result.models) {
      seen++;
      const activity = mapListModel(model);
      if (activity) byId.set(activity.id, activity);
      else unreadable++;
    }
    onProgress?.(Math.min(seen, total ?? seen), total);
    if (total !== null && seen >= total) break;
  }
  return { activities: [...byId.values()], unreadable };
}
