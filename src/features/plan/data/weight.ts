import { addDays, diffDays, trend, type IsoDate, type WeightEntry } from "@/features/athlete";

/** The latest 7-day average and how fast the trend moves. */
export type CurrentWeight = {
  /** 7-day average on `date`, to 0.1 kg. */
  kg: number;
  date: IsoDate;
  /** Kilograms per week over the last 28 days (negative is losing), to 0.1; null with less than a week of data. */
  perWeek: number | null;
};

const PACE_DAYS = 28;

/** The 7-day average of the newest weigh-in on or before `today`, with the weekly pace; null without weigh-ins. */
export function currentWeight(
  entries: readonly WeightEntry[],
  today: IsoDate,
): CurrentWeight | null {
  const points = trend(entries, { to: today });
  const last = points[points.length - 1];
  if (!last) return null;
  const from = addDays(last.date, -PACE_DAYS) ?? last.date;
  const first = points.find((p) => p.date >= from);
  const days = first ? diffDays(first.date, last.date) : null;
  const perWeek =
    first && days !== null && days >= 7 ? ((last.average - first.average) / days) * 7 : null;
  return {
    kg: Math.round(last.average * 10) / 10,
    date: last.date,
    perWeek: perWeek === null ? null : Math.round(perWeek * 10) / 10,
  };
}
