import { addDays, type IsoDate } from "@/features/athlete";
import {
  brusselsTime,
  dayLabel,
  dayLabelYear,
  dayMonth,
  firstDayOfMonth,
  grouped,
  hoursMinutes,
  joinAnd,
  lastDayOfMonth,
  monthLabel,
  oneDecimal,
  oneLine,
  plural,
  minutesText,
} from "./format";
import {
  assemble,
  earlier,
  goalsLines,
  heartRateZonesLine,
  powerZonesLine,
  sumZoneMinutes,
  todayOf,
  weightMonthLines,
  zoneMinutesText,
  type Block,
} from "./summary-parts";
import { donePercent, flagsText, tally, weekInfoText, type Tally } from "./summary-records";
import type {
  ExportRide,
  MonthSummaryInput,
  MonthWeekInput,
  PlannedRecord,
  SummaryContext,
  SummaryOptions,
} from "./types";

type Period = { from: IsoDate; to: IsoDate; empty: boolean };

/** "1 to 28 Oct", "28 Oct", or "28 Oct to 3 Nov" across two months. */
function periodText(from: IsoDate, to: IsoDate): string {
  if (from === to) return dayMonth(from);
  const [d1, m1] = dayMonth(from).split(" ");
  const [d2, m2] = dayMonth(to).split(" ");
  return m1 === m2
    ? `${d1 ?? ""} to ${d2 ?? ""} ${m2 ?? ""}`
    : `${dayMonth(from)} to ${dayMonth(to)}`;
}

function doneText(count: number, minutes: number): string {
  return count === 0 ? "done 0" : `done ${plural(count, "session")}, ${hoursMinutes(minutes)}`;
}

function missedText(t: Tally): string {
  const parts: string[] = [];
  if (t.missed.length > 0) {
    parts.push(`${joinAnd(t.missed.map((m) => dayLabel(m.session.date)))} missed`);
  }
  if (t.pending > 0) parts.push(`${t.pending} still to do`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function inPeriod(date: IsoDate, period: Period): boolean {
  return !period.empty && date >= period.from && date <= period.to;
}

type WeekInPeriod = { input: MonthWeekInput; from: IsoDate; to: IsoDate; records: PlannedRecord[] };

function weeksInPeriod(weeks: readonly MonthWeekInput[], period: Period): WeekInPeriod[] {
  if (period.empty) return [];
  const result: WeekInPeriod[] = [];
  for (const input of [...weeks].sort((a, b) => (a.start < b.start ? -1 : 1))) {
    const end = addDays(input.start, 6) ?? input.start;
    if (end < period.from || input.start > period.to) continue;
    result.push({
      input,
      from: input.start > period.from ? input.start : period.from,
      to: end < period.to ? end : period.to,
      records: input.records.filter((r) => inPeriod(r.session.date, period)),
    });
  }
  return result;
}

function plannedBlock(weeks: readonly WeekInPeriod[], extraRides: number): Block {
  if (weeks.length === 0) {
    return {
      heading: "Planned vs done",
      lines: [
        extraRides > 0
          ? `- No plan weeks in this period, ${plural(extraRides, "extra ride")}.`
          : "- No planned sessions in this period.",
      ],
    };
  }
  const lines = weeks.map((w) => {
    const t = tally(w.records);
    const info = weekInfoText(w.input.week, { withPhase: false, withOf: false });
    return `- ${periodText(w.from, w.to)} (${info}): planned ${plural(t.planned, "session")}, ${hoursMinutes(t.plannedMinutes)}; ${doneText(t.done, t.doneMinutes)}${missedText(t)}.`;
  });
  const all = tally(weeks.flatMap((w) => w.records));
  const percent = donePercent(all);
  const extra = extraRides > 0 ? `, plus ${plural(extraRides, "extra ride")}` : "";
  lines.push(
    `- Total: planned ${plural(all.planned, "session")}, ${hoursMinutes(all.plannedMinutes)}; ${doneText(all.done, all.doneMinutes)}${percent === null ? "" : ` (${percent} %)`}${extra}.`,
  );
  return { heading: "Planned vs done", lines };
}

function sum(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

function ridesBlock(rides: readonly ExportRide[]): Block {
  if (rides.length === 0) return { heading: "Rides", lines: ["- No rides in this period."] };
  const km = sum(rides.map((r) => r.distanceKm));
  const climbing = sum(rides.map((r) => r.climbingM));
  const minutes = sum(rides.map((r) => r.movingMinutes));
  const facts = [
    plural(rides.length, "ride"),
    km === null ? null : `${oneDecimal(km)} km`,
    climbing === null ? null : `${grouped(climbing)} m climbing`,
    minutes === null ? null : `${hoursMinutes(minutes)} moving time`,
  ].filter((x): x is string => x !== null);
  const lines = [`- ${facts.join(", ")}.`];
  const byDistance = rides.some((r) => r.distanceKm !== null);
  const longest = [...rides].sort((a, b) => {
    const diff = byDistance
      ? (b.distanceKm ?? -1) - (a.distanceKm ?? -1)
      : (b.movingMinutes ?? -1) - (a.movingMinutes ?? -1);
    return diff !== 0 ? diff : a.date < b.date ? -1 : 1;
  })[0];
  if (longest !== undefined) {
    const parts = [
      dayLabel(longest.date),
      longest.distanceKm === null ? null : `${oneDecimal(longest.distanceKm)} km`,
      longest.movingMinutes === null ? null : minutesText(longest.movingMinutes),
    ].filter((x): x is string => x !== null);
    lines.push(`- Longest ride: ${parts.join(", ")}.`);
  }
  return { heading: "Rides", lines };
}

/** Mean of a value over rides, weighted by moving time where it is known. */
function weightedMean(
  rides: readonly ExportRide[],
  pick: (ride: ExportRide) => number | null,
): number | null {
  let total = 0;
  let weight = 0;
  for (const ride of rides) {
    const value = pick(ride);
    if (value === null) continue;
    const w = ride.movingMinutes !== null && ride.movingMinutes > 0 ? ride.movingMinutes : 1;
    total += value * w;
    weight += w;
  }
  return weight === 0 ? null : total / weight;
}

function hardSessionsLine(records: readonly PlannedRecord[]): string | null {
  const hard = records.filter((r) => r.session.hard && r.session.status !== "skipped");
  if (hard.length === 0) return null;
  const done = hard.filter((r) => r.session.status === "done");
  const short = done.flatMap((r) => {
    const flags = flagsText(r.match);
    const bad = r.match?.flags.some((f) => f === "short" || f === "easier") ?? false;
    return bad ? [`${dayLabel(r.session.date)} (${flags})`] : [];
  });
  const result =
    done.length === 0
      ? ""
      : short.length === 0
        ? " All targets reached."
        : ` All targets reached except ${joinAnd(short)}.`;
  return `Hard sessions: ${done.length} done of ${hard.length} planned.${result}`;
}

function powerBlock(
  rides: readonly ExportRide[],
  records: readonly PlannedRecord[],
  context: SummaryContext,
): Block {
  const heading = context.ftp !== null ? `Power (FTP ${Math.round(context.ftp)} W)` : "Power";
  if (rides.length === 0) return { heading, lines: ["- No rides, so no power data."] };
  const withPower = rides.filter((r) => r.avgPowerW !== null);
  if (withPower.length === 0) return { heading, lines: ["- No ride has power data."] };
  const average = weightedMean(rides, (r) => r.avgPowerW);
  const lines = [
    `- ${withPower.length} of ${plural(rides.length, "ride")} ${withPower.length === 1 && rides.length === 1 ? "has" : "have"} power data. Average power ${Math.round(average ?? 0)} W.`,
  ];
  const zones = zoneMinutesText(
    sumZoneMinutes(rides.flatMap((r) => (r.powerZoneMinutes === null ? [] : [r.powerZoneMinutes]))),
    hoursMinutes,
  );
  if (zones !== null) lines.push(`- Time in zones: ${zones}.`);
  const limits = powerZonesLine(context);
  if (limits !== null) lines.push(`- ${limits}`);
  const hard = hardSessionsLine(records);
  if (hard !== null) lines.push(`- ${hard}`);
  return { heading, lines };
}

function heartRateBlock(rides: readonly ExportRide[], context: SummaryContext): Block {
  const heading = "Heart rate";
  if (rides.length === 0) return { heading, lines: ["- No rides, so no heart rate data."] };
  const withHr = rides.filter((r) => r.avgHr !== null);
  if (withHr.length === 0) return { heading, lines: ["- No ride has heart rate data."] };
  const average = Math.round(weightedMean(rides, (r) => r.avgHr) ?? 0);
  const scope =
    withHr.length === rides.length ? "all rides" : `${withHr.length} of ${rides.length} rides`;
  const zones = zoneMinutesText(
    sumZoneMinutes(rides.flatMap((r) => (r.hrZoneMinutes === null ? [] : [r.hrZoneMinutes]))),
    hoursMinutes,
  );
  const lines = [
    `- Average ${average} bpm over ${scope}.${zones === null ? "" : ` Time in zones: ${zones}.`}`,
  ];
  const limits = heartRateZonesLine(context);
  if (limits !== null) lines.push(`- ${limits}`);
  return { heading, lines };
}

/**
 * The summary of one calendar month (R11c, R11-PO5): one line per plan week with the days that fall in
 * the month, totals, rides, power, heart rate, weight and goals. A month that is not over yet ends today.
 * Never throws; a month without plan or rides says so.
 */
export function summarizeMonth(
  input: MonthSummaryInput,
  context: SummaryContext,
  options: SummaryOptions,
): string {
  const first = firstDayOfMonth(input.year, input.month);
  const today = todayOf(context);
  const to = earlier(today, lastDayOfMonth(input.year, input.month));
  const period: Period = { from: first, to, empty: to < first };
  const name = monthLabel(input.year, input.month);
  const title = [
    `# Training month: ${name} (${period.empty ? "not started yet" : periodText(first, to)})`,
  ];

  const weeks = weeksInPeriod(input.weeks, period);
  const numbers = weeks.map((w) => w.input.week.number);
  const total = weeks.map((w) => w.input.week.of).find((of) => of !== null) ?? null;
  const planned =
    numbers.length === 0
      ? "No plan weeks in this month."
      : numbers.length === 1 || Math.min(...numbers) === Math.max(...numbers)
        ? `Plan week ${numbers[0]}${total === null ? "" : ` of ${total}`}.`
        : `Plan weeks ${Math.min(...numbers)} to ${Math.max(...numbers)}${total === null ? "" : ` of ${total}`}.`;
  const made = Number.isNaN(context.madeAt.getTime())
    ? "Made on an unknown date."
    : `Made on ${dayLabelYear(today ?? "")}, ${brusselsTime(context.madeAt)} (Europe/Brussels).`;
  title.push(`${made} ${planned}`);

  const rides = input.rides
    .filter((r) => inPeriod(r.date, period))
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  const records = weeks.flatMap((w) => w.records);
  const matched = new Set(records.flatMap((r) => (r.ride === null ? [] : [r.ride.id])));
  const extraRides = rides.filter((r) => !matched.has(r.id)).length;

  const blocks: Block[] = [
    plannedBlock(weeks, extraRides),
    ridesBlock(rides),
    powerBlock(rides, records, context),
    heartRateBlock(rides, context),
  ];
  const changes = input.changes.map(oneLine).filter((c) => c !== "");
  if (changes.length > 0) {
    blocks.push({ heading: "Plan changes this month", lines: changes.map((c) => `- ${c}`) });
  }
  if (options.includeWeight) {
    blocks.push({
      heading: "Weight",
      lines: period.empty
        ? ["- No weight data yet."]
        : weightMonthLines(context, period.from, period.to),
    });
  }
  if (options.includeGoals) {
    blocks.push({ heading: "Goals", lines: goalsLines(context.goals, "month") });
  }
  return assemble(options.promptLine, title, blocks);
}
