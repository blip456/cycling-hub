import { dayLabelYear, joinAnd, minutesText, oneLine, rangeText } from "./format";
import {
  assemble,
  earlier,
  goalsLines,
  heartRateZonesLine,
  powerZonesLine,
  todayOf,
  weightFacts,
  weightLines,
  zoneMinutesText,
  type Block,
} from "./summary-parts";
import {
  dayOffsetText,
  flagsText,
  plannedText,
  rideFacts,
  stepText,
  weekInfoText,
} from "./summary-records";
import type {
  ExportRide,
  PlannedSessionInput,
  SessionSummaryInput,
  SummaryContext,
  SummaryOptions,
} from "./types";

function planBlock(session: PlannedSessionInput | null): Block {
  if (session === null) {
    return { heading: "Plan", lines: ["- Not part of the plan (an extra ride)."] };
  }
  const lines = [`- Planned: ${plannedText(session)}.`];
  if (session.reason !== null && oneLine(session.reason) !== "") {
    lines.push(`- Reason: ${oneLine(session.reason)}`);
  }
  if (session.steps.length > 1) {
    lines.push("- Steps:", ...session.steps.map((step) => `  - ${stepText(step)}`));
  }
  return { heading: "Plan", lines };
}

function doneBlock(input: SessionSummaryInput): Block {
  const { session, ride, match } = input;
  if (ride === null) {
    const status = session?.status;
    const line =
      status === "missed"
        ? "- Missed, no ride."
        : status === "skipped"
          ? "- Skipped."
          : status === "planned"
            ? "- Not done yet."
            : status === "done"
              ? "- Marked as done, no ride data."
              : "- No ride data.";
    return { heading: "Done", lines: [line] };
  }
  const facts = rideFacts(ride);
  const lines = [facts.length > 0 ? `- ${facts.join(", ")}.` : "- Ride found, no details."];
  if (session !== null && match !== null) {
    const how = match.by === "automatic" ? "automatically" : "by hand";
    const share =
      ride.movingMinutes !== null && session.minutes > 0
        ? `, ${Math.round((ride.movingMinutes / session.minutes) * 100)} % of the planned time`
        : "";
    const flags = flagsText(match);
    lines.push(
      `- Matched to this session ${how}: ${dayOffsetText(session.date, ride.date)}${share}.${flags === "" ? "" : ` Flagged: ${flags}.`}`,
    );
  }
  return { heading: "Done", lines };
}

function powerBlock(
  ride: ExportRide,
  session: PlannedSessionInput | null,
  context: SummaryContext,
): Block {
  const heading = context.ftp !== null ? `Power (FTP ${Math.round(context.ftp)} W)` : "Power";
  if (ride.avgPowerW === null) {
    return { heading, lines: ["- No power data for this ride."] };
  }
  const averages = [
    `Average ${Math.round(ride.avgPowerW)} W`,
    ride.normalizedPowerW === null ? null : `normalised ${Math.round(ride.normalizedPowerW)} W`,
  ].filter((x): x is string => x !== null);
  const lines = [`- ${averages.join(", ")}.`];
  if (ride.intervalWatts !== null && ride.intervalWatts.length > 0) {
    const target =
      session?.target?.watts != null
        ? ` against a target of ${rangeText(session.target.watts, "W")}`
        : "";
    lines.push(
      `- Intervals ${joinAnd(ride.intervalWatts.map((w) => `${Math.round(w)} W`))}${target}.`,
    );
  }
  const zones =
    ride.powerZoneMinutes === null ? null : zoneMinutesText(ride.powerZoneMinutes, minutesText);
  if (zones !== null) lines.push(`- Time in zones: ${zones}.`);
  const limits = powerZonesLine(context);
  if (limits !== null) lines.push(`- ${limits}`);
  return { heading, lines };
}

function heartRateBlock(ride: ExportRide, context: SummaryContext): Block {
  const heading = "Heart rate";
  if (ride.avgHr === null && ride.maxHr === null) {
    return { heading, lines: ["- No heart rate data for this ride."] };
  }
  const parts = [
    ride.avgHr === null ? null : `Average ${Math.round(ride.avgHr)} bpm`,
    ride.maxHr === null
      ? null
      : `${ride.avgHr === null ? "Maximum" : "maximum"} ${Math.round(ride.maxHr)} bpm`,
  ].filter((x): x is string => x !== null);
  const lines = [`- ${parts.join(", ")}.`];
  const zones =
    ride.hrZoneMinutes === null ? null : zoneMinutesText(ride.hrZoneMinutes, minutesText);
  if (zones !== null) lines.push(`- Time in zones: ${zones}.`);
  const limits = heartRateZonesLine(context);
  if (limits !== null) lines.push(`- ${limits}`);
  return { heading, lines };
}

/**
 * The summary of one session (R11a): plan, done, power, heart rate, weight, goals. Pass the planned
 * session and, when there is one, the matched ride; a ride without a plan session works too. Never throws.
 */
export function summarizeSession(
  input: SessionSummaryInput,
  context: SummaryContext,
  options: SummaryOptions,
): string {
  const { session, ride, week } = input;
  const date = session?.date ?? ride?.date ?? null;
  const place = week === null ? "" : ` (${weekInfoText(week, { withPhase: true, withOf: true })})`;
  const title = [
    session === null
      ? `# Ride: ${date === null ? "date unknown" : dayLabelYear(date)}${place}`
      : `# Session: ${session.title}, ${dayLabelYear(session.date)}${place}`,
  ];

  const blocks: Block[] = [planBlock(session), doneBlock(input)];
  if (ride !== null) {
    blocks.push(powerBlock(ride, session, context), heartRateBlock(ride, context));
  }
  if (options.includeWeight) {
    const asOf = date === null ? todayOf(context) : earlier(todayOf(context), date);
    blocks.push({
      heading: "Weight",
      lines:
        asOf === null
          ? ["- No weight data."]
          : weightLines(context, weightFacts(context, asOf), false),
    });
  }
  if (options.includeGoals) {
    blocks.push({ heading: "Goals", lines: goalsLines(context.goals, "session") });
  }
  return assemble(options.promptLine, title, blocks);
}
