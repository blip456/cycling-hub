import { useMemo } from "react";
import { useRides } from "@/features/rides/hooks";
import { intakeToday } from "../data/intake";
import { usePlanProfile } from "../data/hooks";
import type { HistoryRide, HistoryStat } from "../engine";
import { DEFAULT_HISTORY_STAT } from "../schemas";
import { toAdaptRide } from "./stored";

/** The rides in the form the history suggestions need, with today and the history statistic of the PO. */
export function useHistoryRides(): { rides: HistoryRide[]; today: string; stat: HistoryStat } {
  const rides = useRides();
  const profile = usePlanProfile();
  const stat = profile.data?.training.historyStat ?? DEFAULT_HISTORY_STAT;
  const list = useMemo(() => (rides.data ?? []).map(toAdaptRide), [rides.data]);
  return { rides: list, today: intakeToday(), stat };
}
