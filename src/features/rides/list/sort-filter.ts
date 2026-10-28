import type { Ride } from "../api";
import {
  averageSpeedKmh,
  formatDuration,
  type GroupBy,
  type RideGroup,
  type Totals,
} from "../format";
import type { ListState, RideType, SortDir, SortKey } from "./list-state";

/** Sorting, filtering and the totals line of the ride list (X1, P35). Pure, so it is easy to test. */

const brusselsDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Brussels as `YYYY-MM-DD` (P6), to compare with the wall-clock `start_local`. */
export function todayInBrussels(now: Date = new Date()): string {
  return brusselsDate.format(now);
}

function shiftDate(date: string, { days = 0, months = 0 }: { days?: number; months?: number }) {
  const d = new Date(`${date}T00:00:00Z`);
  if (months) d.setUTCMonth(d.getUTCMonth() + months);
  if (days) d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date range of a period; an open end is "". */
export function periodRange(
  state: Pick<ListState, "period" | "from" | "to">,
  today: string,
): { from: string; to: string } {
  const { period } = state;
  if (period === "4w") return { from: shiftDate(today, { days: -27 }), to: "" };
  if (period === "3m") return { from: shiftDate(today, { months: -3 }), to: "" };
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: "" };
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  if (period === "custom") return { from: state.from, to: state.to };
  return { from: "", to: "" };
}

const isIndoor = (ride: Ride) => ride.trainer || ride.sport_type === "VirtualRide";

/** The Type filter (X1): Road, Gravel, MTB, E-bike, Indoor, Commute. */
export function matchesType(ride: Ride, type: RideType): boolean {
  switch (type) {
    case "all":
      return true;
    case "road":
      return ride.sport_type === "Ride" && !isIndoor(ride);
    case "gravel":
      return ride.sport_type === "GravelRide";
    case "mtb":
      return ride.sport_type === "MountainBikeRide";
    case "ebike":
      return ride.sport_type === "EBikeRide" || ride.sport_type === "EMountainBikeRide";
    case "indoor":
      return isIndoor(ride);
    case "commute":
      return ride.commute;
  }
}

/** Lower case without accents, so "cote" finds "Côte". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Applies name search, type, period and hide commutes. Keeps the order of `rides`. */
export function filterRides(rides: readonly Ride[], state: ListState, today: string): Ride[] {
  const query = fold(state.q.trim());
  const { from, to } = periodRange(state, today);
  return rides.filter((ride) => {
    if (state.hideCommutes && ride.commute) return false;
    if (!matchesType(ride, state.type)) return false;
    const day = ride.start_local.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return !query || fold(ride.name).includes(query);
  });
}

/** The value a column sorts on; null (no power or HR in the export) always sorts last. */
function sortValue(ride: Ride, key: SortKey): number | string | null {
  switch (key) {
    case "date":
      return ride.start_at;
    case "name":
      return ride.name;
    case "distance":
      return ride.distance_m;
    case "time":
      return ride.moving_time_s;
    case "speed":
      return averageSpeedKmh(ride);
    case "power":
      return ride.average_watts;
    case "hr":
      return ride.average_heartrate;
    case "elevation":
      return ride.elevation_m;
  }
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** A sorted copy. Ties and missing values keep newest first. */
export function sortRides(rides: readonly Ride[], key: SortKey, dir: SortDir): Ride[] {
  const sign = dir === "asc" ? 1 : -1;
  const newestFirst = (a: Ride, b: Ride) =>
    a.start_at < b.start_at ? 1 : a.start_at > b.start_at ? -1 : 0;
  return rides
    .map((ride) => ({ ride, value: sortValue(ride, key) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value !== b.value) return a.value === null ? 1 : -1;
        return newestFirst(a.ride, b.ride);
      }
      let order: number;
      if (typeof a.value === "string" && typeof b.value === "string") {
        order =
          key === "name"
            ? collator.compare(a.value, b.value)
            : a.value < b.value
              ? -1
              : a.value > b.value
                ? 1
                : 0;
      } else {
        order = Number(a.value) - Number(b.value);
      }
      return order !== 0 ? order * sign : newestFirst(a.ride, b.ride);
    })
    .map(({ ride }) => ride);
}

/** Earlier years with rides, newest first, for the Period select ("This year" covers the current one). */
export function earlierYears(rides: readonly Ride[], today: string): string[] {
  const current = today.slice(0, 4);
  const years = new Set<string>();
  for (const ride of rides) {
    const year = ride.start_local.slice(0, 4);
    if (year < current) years.add(year);
  }
  return [...years].sort().reverse();
}

const kmFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const wholeFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** "1,234.5" km for totals. */
export function formatKmTotal(meters: number): string {
  return kmFormat.format(meters / 1000);
}

/** "1,020" with a thousands comma (DESIGN.md), "—" when missing. */
export function formatThousands(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : wholeFormat.format(Math.round(value));
}

export function formatRideCount(n: number): string {
  return `${wholeFormat.format(n)} ${n === 1 ? "ride" : "rides"}`;
}

/** "4 rides · 210.0 km · 7:19 h" (week, month and filter totals, P11). */
export function formatTotalsLine(t: Totals): string {
  return `${formatRideCount(t.rides)} · ${formatKmTotal(t.distanceM)} km · ${formatDuration(t.movingTimeS)} h`;
}

/**
 * The group header split into its bold part and the rest: "Week 41" + "6–12 Oct" (with the year when it
 * is not the current one, so weeks of different years can't be confused), or "October 2026".
 */
export function groupTitle(
  group: RideGroup,
  by: GroupBy,
  currentYear: string,
): { title: string; detail: string } {
  if (by === "month") return { title: group.label, detail: "" };
  const [title = group.label, range = ""] = group.label.split(" · ");
  const year = group.key.slice(0, 4);
  return { title, detail: year === currentYear ? range : `${range} ${year}` };
}
