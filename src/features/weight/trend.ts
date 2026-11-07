import type { TrendPoint } from "@/features/athlete";

/** Change of the 7-day average over the range: the average at its end minus the average at its start. */
export function averageChange(points: readonly TrendPoint[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  return Math.round((last.average - first.average) * 10) / 10;
}
