import type { GroupBy } from "../format";

/**
 * The ride list view (B1a, X1) lives in the URL query, so Back from a ride and a reload return to the
 * same view (DESIGN.md, sortable table). Defaults are left out of the URL.
 */

export const SORT_KEYS = [
  "date",
  "name",
  "distance",
  "time",
  "speed",
  "power",
  "hr",
  "elevation",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const RIDE_TYPES = ["all", "road", "gravel", "mtb", "ebike", "indoor", "commute"] as const;
export type RideType = (typeof RIDE_TYPES)[number];

/** "all", "4w", "3m", "year" (this year), a year such as "2025", or "custom" (from/to). */
export type Period = string;

export interface ListState {
  view: GroupBy;
  hideCommutes: boolean;
  q: string;
  type: RideType;
  period: Period;
  /** Custom range, inclusive `YYYY-MM-DD`; "" when open. */
  from: string;
  to: string;
  sort: SortKey;
  dir: SortDir;
}

export const DEFAULT_STATE: ListState = {
  view: "week",
  hideCommutes: false,
  q: "",
  type: "all",
  period: "all",
  from: "",
  to: "",
  sort: "date",
  dir: "desc",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIXED_PERIODS: ReadonlySet<string> = new Set(["all", "4w", "3m", "year", "custom"]);

export function isPeriod(value: string): boolean {
  return FIXED_PERIODS.has(value) || /^\d{4}$/.test(value);
}

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.find((v) => v === value) ?? fallback;
}

/** First click: names A to Z, dates newest first, numbers highest first (DESIGN.md). */
export function defaultDir(sort: SortKey): SortDir {
  return sort === "name" ? "asc" : "desc";
}

/** Reads the view from the query; unknown or broken values fall back to the defaults. */
export function parseListState(params: URLSearchParams): ListState {
  const sort = oneOf(SORT_KEYS, params.get("sort"), DEFAULT_STATE.sort);
  const rawPeriod = params.get("period") ?? "all";
  const period = isPeriod(rawPeriod) ? rawPeriod : "all";
  const date = (key: string) => {
    const value = params.get(key) ?? "";
    return period === "custom" && DATE.test(value) ? value : "";
  };
  return {
    view: params.get("view") === "month" ? "month" : "week",
    hideCommutes: params.get("commutes") === "hide",
    q: params.get("q") ?? "",
    type: oneOf(RIDE_TYPES, params.get("type"), "all"),
    period,
    from: date("from"),
    to: date("to"),
    sort,
    dir: oneOf(["asc", "desc"] as const, params.get("dir"), defaultDir(sort)),
  };
}

export function writeListState(state: ListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== "week") params.set("view", state.view);
  if (state.hideCommutes) params.set("commutes", "hide");
  if (state.q) params.set("q", state.q);
  if (state.type !== "all") params.set("type", state.type);
  if (state.period !== "all") params.set("period", state.period);
  if (state.period === "custom") {
    if (state.from) params.set("from", state.from);
    if (state.to) params.set("to", state.to);
  }
  if (state.sort !== "date") params.set("sort", state.sort);
  if (state.dir !== defaultDir(state.sort)) params.set("dir", state.dir);
  return params;
}

/** A click on a column header: the same column reverses, another column starts at its default. */
export function nextSort(
  state: Pick<ListState, "sort" | "dir">,
  sort: SortKey,
): Pick<ListState, "sort" | "dir"> {
  if (state.sort === sort) return { sort, dir: state.dir === "asc" ? "desc" : "asc" };
  return { sort, dir: defaultDir(sort) };
}

/** Is anything filtered out on the desktop filter bar? Then Clear filters and the count line show. */
export function hasFilters(state: ListState): boolean {
  return (
    state.hideCommutes || state.q.trim() !== "" || state.type !== "all" || state.period !== "all"
  );
}

export const CLEARED_FILTERS: Pick<
  ListState,
  "hideCommutes" | "q" | "type" | "period" | "from" | "to"
> = { hideCommutes: false, q: "", type: "all", period: "all", from: "", to: "" };
