/**
 * The effect of a plan update on the weeks it changed (R4): planned hours, load, hard sessions and minutes
 * above 105 % FTP before and after, so the PO sees what an update does and not only which sessions moved.
 * Pure.
 */
import { STRUCTURED_KINDS, aboveThresholdMinutes, type PlannedSession } from "../engine";
import type { IsoDate } from "@/features/athlete";
import type { UpdateEffect, UpdateWeek, WeekMetrics } from "./types";

const ZERO: WeekMetrics = { minutes: 0, load: 0, hard: 0, aboveMinutes: 0 };

function add(a: WeekMetrics, b: WeekMetrics): WeekMetrics {
  return {
    minutes: a.minutes + b.minutes,
    load: a.load + b.load,
    hard: a.hard + b.hard,
    aboveMinutes: a.aboveMinutes + b.aboveMinutes,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sessions are summed by date so the result does not depend on the order they come in (floating point). */
function metricsOf(sessions: readonly PlannedSession[]): WeekMetrics {
  const sum = sessions
    .filter((s) => s.kind !== "event")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .reduce<WeekMetrics>(
      (sum, s) =>
        add(sum, {
          minutes: s.durationMin,
          load: s.load,
          hard:
            STRUCTURED_KINDS.includes(s.kind) || (s.kind === "long" && s.mainSet !== null) ? 1 : 0,
          aboveMinutes: aboveThresholdMinutes(s.steps),
        }),
      ZERO,
    );
  return {
    minutes: round(sum.minutes),
    load: round(sum.load),
    hard: sum.hard,
    aboveMinutes: round(sum.aboveMinutes),
  };
}

/**
 * The weeks that hold a changed date, with the metrics of the sessions before and after the update. Weeks
 * come in plan order; `total` adds them up. Null when no week changed.
 */
export function updateEffect(
  before: readonly PlannedSession[],
  after: readonly PlannedSession[],
  changedDates: ReadonlySet<IsoDate>,
): UpdateEffect | null {
  const weeks = new Set<number>();
  for (const s of [...before, ...after]) if (changedDates.has(s.date)) weeks.add(s.week);
  if (weeks.size === 0) return null;
  const list: UpdateWeek[] = [...weeks]
    .sort((a, b) => a - b)
    .map((week) => ({
      week,
      before: metricsOf(before.filter((s) => s.week === week)),
      after: metricsOf(after.filter((s) => s.week === week)),
    }));
  return {
    weeks: list,
    total: {
      before: list.reduce((sum, w) => add(sum, w.before), ZERO),
      after: list.reduce((sum, w) => add(sum, w.after), ZERO),
    },
  };
}
