import type { Ride } from "../api";
import {
  averageSpeedKmh,
  formatDistanceKm,
  formatDuration,
  formatSpeed,
  formatWhole,
  rideTags,
} from "../format";
import type { SortKey } from "./list-state";
import { formatThousands } from "./sort-filter";

export interface Metric {
  key: Exclude<SortKey, "date" | "name">;
  label: string;
  /** Shorter header for the dense desktop table. */
  short: string;
  unit: string;
  /** Text colour of the value (P10, DESIGN.md metric colours). */
  color: string;
  format: (ride: Ride) => string;
}

/** The six metrics in their fixed order (P10): distance, time, speed, power, heart rate, elevation. */
export const METRICS: readonly Metric[] = [
  {
    key: "distance",
    label: "Distance",
    short: "Distance",
    unit: "km",
    color: "text-m-dist",
    format: (r) => formatDistanceKm(r.distance_m),
  },
  {
    key: "time",
    label: "Moving time",
    short: "Moving time",
    unit: "h",
    color: "text-m-time",
    format: (r) => formatDuration(r.moving_time_s),
  },
  {
    key: "speed",
    label: "Avg speed",
    short: "Avg speed",
    unit: "km/h",
    color: "text-m-speed",
    format: (r) => formatSpeed(averageSpeedKmh(r)),
  },
  {
    key: "power",
    label: "Avg power",
    short: "Avg power",
    unit: "W",
    color: "text-m-power",
    format: (r) => formatWhole(r.average_watts),
  },
  {
    key: "hr",
    label: "Avg heart rate",
    short: "Avg HR",
    unit: "bpm",
    color: "text-m-hr",
    format: (r) => formatWhole(r.average_heartrate),
  },
  {
    key: "elevation",
    label: "Elevation",
    short: "Elevation",
    unit: "m",
    color: "text-m-elev",
    format: (r) => formatThousands(r.elevation_m),
  },
];

export const MISSING = "—";

/** Tags for the date line (P24, plain text). The table leaves out "Road", the usual case (X1). */
export function dateLineTags(ride: Ride, { withRoad }: { withRoad: boolean }): string[] {
  const tags = rideTags(ride);
  return withRoad ? tags : tags.filter((tag) => tag !== "Road");
}
