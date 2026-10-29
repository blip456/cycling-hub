/**
 * Text for one planned session and one ride, shared by the session, week and month summaries.
 */
import { diffDays } from "@/features/athlete";
import { minutesText, oneDecimal, grouped, rangeText, zoneText } from "./format";
import type {
  ExportRide,
  ExportStep,
  MatchInfo,
  PlannedRecord,
  PlannedSessionInput,
  SessionTarget,
  WeekInfo,
} from "./types";

/** "zone 2, 140 to 187 W and 125 to 142 bpm" (parts that are not known are left out), or "". */
export function targetText(target: SessionTarget | null): string {
  if (target === null) return "";
  const zone = target.zone === null ? "" : ` ${zoneText(target.zone)}`;
  const numbers = [
    target.watts === null ? null : rangeText(target.watts, "W"),
    target.bpm === null ? null : rangeText(target.bpm, "bpm"),
  ].filter((x): x is string => x !== null);
  const head = zone === "" ? "" : ` in${zone}`;
  const tail = numbers.length > 0 ? `, ${numbers.join(" and ")}` : "";
  return `${head}${tail}`;
}

/** "150 min steady endurance in zone 2, 140 to 187 W and 125 to 142 bpm". */
export function plannedText(session: PlannedSessionInput): string {
  const words = session.description ?? session.title;
  return `${minutesText(session.minutes)} ${words}${targetText(session.target)}`;
}

/** "3 x 10 min Threshold, 95 to 105 % FTP, 238 to 263 W, zone 4, 156 to 173 bpm". */
export function stepText(step: ExportStep): string {
  const repeats = step.repeats !== undefined && step.repeats > 1 ? `${step.repeats} x ` : "";
  const details = [
    step.percentFtp === null ? null : rangeText(step.percentFtp, "% FTP"),
    step.watts === null ? null : rangeText(step.watts, "W"),
    step.zone === null ? null : zoneText(step.zone),
    step.bpm === null ? null : rangeText(step.bpm, "bpm"),
  ].filter((x): x is string => x !== null);
  return [`${repeats}${minutesText(step.minutes)} ${step.label}`, ...details].join(", ");
}

/** Total minutes of a step list, repeats included. */
export function stepsMinutes(steps: readonly ExportStep[]): number {
  return steps.reduce((sum, s) => sum + s.minutes * (s.repeats ?? 1), 0);
}

/** "week 5 of 12, build" or "week 4, recovery week". */
export function weekInfoText(
  week: WeekInfo,
  options: { withPhase: boolean; withOf: boolean },
): string {
  const number =
    options.withOf && week.of !== null
      ? `week ${week.number} of ${week.of}`
      : `week ${week.number}`;
  const tail = week.recovery ? "recovery week" : options.withPhase ? week.phase : null;
  return tail === null || tail === "" ? number : `${number}, ${tail}`;
}

/** "142 min, 68.4 km, 410 m climbing, average speed 28.9 km/h" with the known parts only. */
export function rideFacts(ride: ExportRide): string[] {
  const facts: string[] = [];
  if (ride.movingMinutes !== null) facts.push(minutesText(ride.movingMinutes));
  if (ride.distanceKm !== null) facts.push(`${oneDecimal(ride.distanceKm)} km`);
  if (ride.climbingM !== null) facts.push(`${grouped(ride.climbingM)} m climbing`);
  if (ride.avgSpeedKmh !== null) facts.push(`average speed ${oneDecimal(ride.avgSpeedKmh)} km/h`);
  return facts;
}

/** "short by 4 min, easier than planned" for the flags of a match, or "". */
export function flagsText(match: MatchInfo | null): string {
  if (match === null) return "";
  return match.flags
    .map((flag) => {
      if (flag === "short") {
        return match.shortByMinutes === null
          ? "short"
          : `short by ${minutesText(match.shortByMinutes)}`;
      }
      return `${flag} than planned`;
    })
    .join(", ");
}

/** "same day", "1 day later", "2 days earlier" from the session date to the ride date. */
export function dayOffsetText(sessionDate: string, rideDate: string): string {
  const diff = diffDays(sessionDate, rideDate);
  if (diff === null || diff === 0) return "same day";
  const n = Math.abs(diff);
  return `${n} ${n === 1 ? "day" : "days"} ${diff > 0 ? "later" : "earlier"}`;
}

/** Minutes of a ride that count as done time. */
export function doneMinutes(ride: ExportRide | null): number {
  return ride?.movingMinutes ?? 0;
}

/** Planned against done for a list of sessions. Skipped sessions are not counted as planned. */
export type Tally = {
  /** Sessions that count as planned (everything but skipped). */
  planned: number;
  plannedMinutes: number;
  /** Planned minutes of the sessions that are due (planned minus the ones still to do). */
  dueMinutes: number;
  done: number;
  doneMinutes: number;
  /** Sessions still to do. */
  pending: number;
  missed: readonly PlannedRecord[];
};

export function tally(records: readonly PlannedRecord[]): Tally {
  const result = {
    planned: 0,
    plannedMinutes: 0,
    dueMinutes: 0,
    done: 0,
    doneMinutes: 0,
    pending: 0,
    missed: [] as PlannedRecord[],
  };
  for (const record of records) {
    const { session } = record;
    if (session.status === "skipped") continue;
    result.planned += 1;
    result.plannedMinutes += session.minutes;
    if (session.status === "planned") {
      result.pending += 1;
      continue;
    }
    result.dueMinutes += session.minutes;
    if (session.status === "done") {
      result.done += 1;
      result.doneMinutes += doneMinutes(record.ride);
    } else {
      result.missed.push(record);
    }
  }
  return result;
}

/** The share of due time that was done, in whole percent; null when nothing is due. */
export function donePercent(t: Tally): number | null {
  return t.dueMinutes > 0 ? Math.round((t.doneMinutes / t.dueMinutes) * 100) : null;
}
