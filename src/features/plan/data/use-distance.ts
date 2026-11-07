import { useMemo } from "react";
import { brusselsDate } from "@/features/athlete";
import { useBaseline } from "@/features/baseline/hooks";
import { useRides } from "@/features/rides/hooks";
import { speedModel, type SpeedModel, type SpeedRide } from "./distance";
import type { StoredPlan } from "./types";

export type Distances = {
  /** Null while the rides load, or with too few outdoor rides in the last 90 days. */
  model: SpeedModel | null;
  ridesById: ReadonlyMap<string, Pick<SpeedRide, "distance_m">>;
};

/**
 * The speed trendline for the distance estimates (P89), from the rides already loaded for the ride list.
 * Uses the plan's FTP (the sessions' targets come from it) and the current LTHR for rides without power.
 */
export function useDistances(plan: Pick<StoredPlan, "ftp"> | null | undefined): Distances {
  const rides = useRides();
  const { baseline } = useBaseline();
  const today = brusselsDate() ?? "";
  const ftp = plan?.ftp ?? baseline?.ftp?.value ?? null;
  const lthr = baseline?.lthr?.value ?? null;
  return useMemo(() => {
    const list = rides.data ?? [];
    return {
      model: list.length > 0 ? speedModel({ rides: list, today, ftp, lthr }) : null,
      ridesById: new Map(list.map((r) => [r.id, r])),
    };
  }, [rides.data, today, ftp, lthr]);
}
