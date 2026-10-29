import { addDays, type IsoDate } from "@/features/athlete";
import {
  brusselsTime,
  dayLabel,
  dayLabelYear,
  dayName,
  dayRangeLabel,
  joinAnd,
  minutesText,
  oneLine,
  plural,
  rangeText,
} from "./format";
import {
  assemble,
  earlier,
  goalsLines,
  heartRateZonesLine,
  powerZonesLine,
  sumZoneMinutes,
  todayOf,
  weightFacts,
  weightLines,
  zoneMinutesText,
  type Block,
} from "./summary-parts";
import { donePercent, flagsText, rideFacts, tally, type Tally } from "./summary-records";
import type {
  ExportRide,
  PlannedRecord,
  SummaryContext,
  SummaryOptions,
  WeekSummaryInput,
} from "./types";

function byDate<T extends { date: string; id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1,
  );
}

function recordLine(record: PlannedRecord): string {
  const { session, ride, match } = record;
  const head = `- ${dayLabel(session.date)}: planned ${session.title}, ${minutesText(session.minutes)}.`;
  let outcome: string;
  switch (session.status) {
    case "done": {
      const facts = ride === null ? [] : rideFacts(ride);
      outcome = facts.length > 0 ? `Done, ${facts.join(", ")}.` : "Done.";
      break;
    }
    case "missed":
      outcome = "Missed, no ride.";
      break;
    case "skipped":
      outcome = "Skipped.";
      break;
    case "planned":
      outcome = "Still to do.";
      break;
  }
  const flags = session.status === "done" ? flagsText(match) : "";
  return `${head} ${outcome}${flags === "" ? "" : ` Flagged: ${flags}.`}`;
}

function totalLine(t: Tally): string {
  const percent = donePercent(t);
  const done = `done ${minutesText(t.doneMinutes)} in ${plural(t.done, "session")}${percent === null ? "" : ` (${percent} %)`}`;
  const left = t.pending > 0 ? ` Still to do: ${plural(t.pending, "session")}.` : "";
  return `- Total: planned ${minutesText(t.plannedMinutes)} in ${plural(t.planned, "session")}, ${done}.${left}`;
}

function plannedBlock(input: WeekSummaryInput, extras: readonly ExportRide[]): Block {
  const sorted = [...input.records].sort((a, b) =>
    a.session.date === b.session.date
      ? a.session.id < b.session.id
        ? -1
        : 1
      : a.session.date < b.session.date
        ? -1
        : 1,
  );
  if (sorted.length === 0 && extras.length === 0) {
    return { heading: "Planned vs done", lines: ["- No planned sessions and no rides this week."] };
  }
  const lines: string[] = [];
  if (sorted.length === 0) lines.push("- No planned sessions this week.");
  for (const record of sorted) lines.push(recordLine(record));
  for (const ride of extras) {
    const facts = rideFacts(ride);
    lines.push(
      `- ${dayLabel(ride.date)}: extra ride, not in the plan${facts.length > 0 ? `, ${facts.join(", ")}` : ""}.`,
    );
  }
  if (sorted.length > 0) lines.push(totalLine(tally(sorted)));
  return { heading: "Planned vs done", lines };
}

function powerBlock(
  rides: readonly ExportRide[],
  recordOf: ReadonlyMap<string, PlannedRecord>,
  context: SummaryContext,
): Block {
  const heading = context.ftp !== null ? `Power (FTP ${Math.round(context.ftp)} W)` : "Power";
  if (rides.length === 0) return { heading, lines: ["- No rides this week."] };
  const lines = rides.map((ride) => {
    if (ride.avgPowerW === null) return `- ${dayName(ride.date)}: no power data.`;
    const averages = [
      `average ${Math.round(ride.avgPowerW)} W`,
      ride.normalizedPowerW === null ? null : `normalised ${Math.round(ride.normalizedPowerW)} W`,
    ].filter((x): x is string => x !== null);
    const target = recordOf.get(ride.id)?.session.target ?? null;
    const watts = target?.watts ?? null;
    const zone = target?.zone == null ? "" : ` (zone ${target.zone})`;
    const intervals =
      ride.intervalWatts !== null && ride.intervalWatts.length > 0
        ? joinAnd(ride.intervalWatts.map((w) => `${Math.round(w)} W`))
        : null;
    let extra = "";
    if (intervals !== null) {
      extra = ` Intervals ${intervals}${watts === null ? "" : ` against a target of ${rangeText(watts, "W")}${zone}`}.`;
    } else if (watts !== null) {
      extra = ` Target ${rangeText(watts, "W")}${zone}.`;
    }
    return `- ${dayName(ride.date)}: ${averages.join(", ")}.${extra}`;
  });
  return { heading, lines };
}

function heartRateBlock(rides: readonly ExportRide[]): Block {
  const heading = "Heart rate";
  if (rides.length === 0) return { heading, lines: ["- No rides this week."] };
  const lines = rides.map((ride) => {
    const parts = [
      ride.avgHr === null ? null : `average ${Math.round(ride.avgHr)} bpm`,
      ride.maxHr === null ? null : `maximum ${Math.round(ride.maxHr)} bpm`,
    ].filter((x): x is string => x !== null);
    return parts.length === 0
      ? `- ${dayName(ride.date)}: no heart rate data.`
      : `- ${dayName(ride.date)}: ${parts.join(", ")}.`;
  });
  return { heading, lines };
}

/** One "Power, 216 min with power data: Z1 18 min, ..." style line, or the reason there is none. */
function zoneTimeLine(
  label: string,
  noData: string,
  rides: readonly ExportRide[],
  pick: (ride: ExportRide) => readonly number[] | null,
): string {
  const withData = rides.filter((ride) => pick(ride) !== null);
  if (withData.length === 0) return `- ${label}: ${noData}`;
  const minutes = withData.reduce((sum, ride) => sum + (ride.movingMinutes ?? 0), 0);
  const zones = zoneMinutesText(
    sumZoneMinutes(withData.map((ride) => pick(ride) ?? [])),
    minutesText,
  );
  const scope = withData.length < rides.length ? ` with ${label.toLowerCase()} data` : "";
  return `- ${label}, ${minutesText(minutes)}${scope}: ${zones ?? "no time in any zone"}.`;
}

function zonesBlock(rides: readonly ExportRide[], context: SummaryContext): Block {
  if (rides.length === 0) return { heading: "Time in zones", lines: ["- No rides this week."] };
  const lines = [
    zoneTimeLine("Power", "no power zone data this week.", rides, (r) => r.powerZoneMinutes),
    zoneTimeLine("Heart rate", "no heart rate zone data this week.", rides, (r) => r.hrZoneMinutes),
  ];
  const power = powerZonesLine(context);
  const heart = heartRateZonesLine(context);
  if (power !== null) lines.push(`- ${power}`);
  if (heart !== null) lines.push(`- ${heart}`);
  return { heading: "Time in zones", lines };
}

function comingBlock(input: WeekSummaryInput): Block | null {
  const next = input.next;
  if (next === null) return null;
  const end = addDays(next.start, 6) ?? next.start;
  const range = `${dayLabel(next.start)} to ${dayLabel(end)}`;
  const sessions = byDate(next.sessions).filter((s) => s.status !== "skipped");
  const heading = `Coming week (week ${next.week.number}, ${range})`;
  if (sessions.length === 0) return { heading, lines: ["- No sessions planned."] };
  return {
    heading,
    lines: [
      `- ${sessions.map((s) => `${dayName(s.date)} ${s.title} (${minutesText(s.minutes)})`).join(", ")}.`,
    ],
  };
}

/**
 * The summary of one week (R11b): planned against done, power, heart rate, time in zones, weight,
 * goals and the coming week. `input.start` is the Monday. Never throws; missing data is said in words.
 */
export function summarizeWeek(
  input: WeekSummaryInput,
  context: SummaryContext,
  options: SummaryOptions,
): string {
  const end: IsoDate = addDays(input.start, 6) ?? input.start;
  const range = dayRangeLabel(input.start, end);
  const week = input.week;
  const number =
    week === null ? "" : week.of !== null ? ` ${week.number} of ${week.of}` : ` ${week.number}`;
  const title = [`# Training week${number}: ${range}`];
  const today = todayOf(context);
  const made = Number.isNaN(context.madeAt.getTime())
    ? "Made on an unknown date."
    : `Made on ${dayLabelYear(today ?? "")}, ${brusselsTime(context.madeAt)} (Europe/Brussels).`;
  const phase =
    week === null
      ? ""
      : [
          week.phase !== null && week.phase !== "" ? `Phase: ${oneLine(week.phase)}.` : "",
          week.recovery ? "Recovery week." : "",
        ]
          .filter((x) => x !== "")
          .join(" ");
  title.push(phase === "" ? made : `${made} ${phase}`);

  const recordOf = new Map<string, PlannedRecord>();
  for (const record of input.records) {
    if (record.ride !== null) recordOf.set(record.ride.id, record);
  }
  const rides = byDate(input.rides);
  const extras = rides.filter((ride) => !recordOf.has(ride.id));

  const blocks: Block[] = [
    plannedBlock(input, extras),
    powerBlock(rides, recordOf, context),
    heartRateBlock(rides),
    zonesBlock(rides, context),
  ];
  const changes = input.changes.map(oneLine).filter((c) => c !== "");
  if (changes.length > 0) {
    blocks.push({ heading: "Plan changes this week", lines: changes.map((c) => `- ${c}`) });
  }
  if (options.includeWeight) {
    const asOf = earlier(today, end);
    blocks.push({ heading: "Weight", lines: weightLines(context, weightFacts(context, asOf)) });
  }
  if (options.includeGoals) {
    blocks.push({ heading: "Goals", lines: goalsLines(context.goals, "week") });
  }
  const coming = comingBlock(input);
  if (coming !== null) blocks.push(coming);
  return assemble(options.promptLine, title, blocks);
}
