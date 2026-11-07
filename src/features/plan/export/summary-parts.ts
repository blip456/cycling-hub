/**
 * Building blocks shared by the session, week and month summaries (P67, wireframe R11): the weight
 * block, the goals block, the zone lines and the final assembly with the instruction line.
 *
 * Output is plain text with simple markdown headings ("# " and "## ") and "- " lists, the working default
 * of R11-PO1: readable as it is, no table syntax, no emoji. Wording is fixed, so the same input always
 * gives the same text.
 */
import {
  addDays,
  brusselsDate,
  diffDays,
  heartRateZones,
  normalizeEntries,
  powerZones,
  trend,
  type IsoDate,
  type TrendPoint,
  type Weekday,
} from "@/features/athlete";
import { dayLabelYear, dayMonth, oneDecimal, oneLine, trimmedDecimal, zoneLimits } from "./format";
import type { SummaryContext, SummaryGoals } from "./types";

/** The app's own instruction line for each kind of summary (R11-PO3), shown in the editable field. */
export const DEFAULT_PROMPT_LINES = {
  session:
    "Analyse this ride against my plan. Say what went well, what to watch and what to change next time. Keep it short.",
  week: "Analyse my training week below. Compare planned with done, point out what went well and what to watch, and give practical tips for next week. Keep it short.",
  month:
    "Analyse my training month below. Look at consistency, the balance of easy and hard work and the weight trend. Give three practical tips for the next four weeks.",
} as const;

/** A heading with its list lines. */
export type Block = { heading: string; lines: readonly string[] };

/** Title lines, then the blocks, each with a blank line before it. Prepends the instruction line. */
export function assemble(
  promptLine: string | null,
  title: readonly string[],
  blocks: readonly Block[],
): string {
  const out: string[] = [];
  const prompt = promptLine === null ? "" : promptLine.replace(/\r\n?/g, "\n").trim();
  if (prompt !== "") out.push(prompt, "");
  out.push(...title);
  for (const block of blocks) {
    out.push("", `## ${block.heading}`, ...block.lines);
  }
  return out.join("\n");
}

/** Today's Brussels date from the context, or null when `madeAt` is not a valid Date. */
export function todayOf(context: SummaryContext): IsoDate | null {
  return brusselsDate(context.madeAt);
}

/** The earlier of two dates; a null side is ignored. */
export function earlier(a: IsoDate | null, b: IsoDate): IsoDate {
  return a !== null && a < b ? a : b;
}

// Zones

/** "Power zones: Z1 up to 138 W, ..." or null without a usable FTP. */
export function powerZonesLine(context: SummaryContext): string | null {
  const zones = powerZones(context.ftp);
  return zones === null ? null : `Power zones: ${zoneLimits(zones, "W")}.`;
}

/** "Heart rate zones: Z1 up to 124 bpm, ..." or null without LTHR or max HR. */
export function heartRateZonesLine(context: SummaryContext): string | null {
  const set = heartRateZones({ lthr: context.lthr, maxHr: context.maxHr });
  return set === null ? null : `Heart rate zones: ${zoneLimits(set.zones, "bpm")}.`;
}

/** "Z2 130 min, Z3 6 min"; zones with no time are left out. Null when there is no time in any zone. */
export function zoneMinutesText(
  minutes: readonly number[],
  format: (value: number) => string,
): string | null {
  const items: string[] = [];
  minutes.forEach((value, index) => {
    if (Math.round(value) > 0) items.push(`Z${index + 1} ${format(value)}`);
  });
  return items.length > 0 ? items.join(", ") : null;
}

/** Element-wise sum of zone minute lists of different lengths. */
export function sumZoneMinutes(lists: readonly (readonly number[])[]): number[] {
  const total: number[] = [];
  for (const list of lists) {
    list.forEach((value, index) => {
      total[index] = (total[index] ?? 0) + value;
    });
  }
  return total;
}

// Weight

/** Weight facts as of a date (P45: 7-day average, 4-week trend). */
export type WeightFacts = {
  asOf: IsoDate;
  /** The newest 7-day average on or before `asOf`; null with no weigh-ins at all. */
  latest: TrendPoint | null;
  /** True when the newest weigh-in is older than 14 days. */
  stale: boolean;
  /** kg a week over the last 4 weeks (negative is down); null with too little data. */
  ratePerWeek: number | null;
  /** kg a week the target needs from `asOf` (negative is down); null without a target or with a past date. */
  targetPerWeek: number | null;
};

const STALE_DAYS = 14;
const TREND_DAYS = 28;
const MIN_TREND_SPAN_DAYS = 14;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Computes the weight facts from the raw entries. Never throws; missing data gives nulls. */
export function weightFacts(context: SummaryContext, asOf: IsoDate): WeightFacts {
  const points = trend(context.weight, { to: asOf });
  const latest = points[points.length - 1] ?? null;
  if (latest === null) {
    return { asOf, latest: null, stale: false, ratePerWeek: null, targetPerWeek: null };
  }
  const stale = (diffDays(latest.date, asOf) ?? 0) > STALE_DAYS;
  const windowStart = addDays(asOf, -TREND_DAYS) ?? asOf;
  const before = points.filter((p) => p.date <= windowStart);
  const base = before[before.length - 1] ?? points.find((p) => p.date > windowStart) ?? null;
  const span = base === null ? null : diffDays(base.date, latest.date);
  const ratePerWeek =
    base !== null && span !== null && span >= MIN_TREND_SPAN_DAYS && !stale
      ? round2(((latest.average - base.average) / span) * 7)
      : null;
  const goals = context.goals;
  const daysLeft = goals?.targetWeightDate != null ? diffDays(asOf, goals.targetWeightDate) : null;
  const targetPerWeek =
    goals?.targetWeightKg != null && daysLeft !== null && daysLeft > 0 && !stale
      ? round2(((goals.targetWeightKg - latest.average) / daysLeft) * 7)
      : null;
  return { asOf, latest, stale, ratePerWeek, targetPerWeek };
}

function trendSentence(facts: WeightFacts): string {
  if (facts.ratePerWeek === null) return "Not enough weigh-ins for a 4-week trend.";
  if (facts.ratePerWeek === 0) return "Steady over the last 4 weeks.";
  const word = facts.ratePerWeek < 0 ? "Down" : "Up";
  return `${word} ${Math.abs(facts.ratePerWeek).toFixed(2)} kg a week over the last 4 weeks.`;
}

function staleLine(facts: WeightFacts): string {
  const latest = facts.latest as TrendPoint;
  return `No weigh-in in the last ${STALE_DAYS} days. Last 7-day average ${oneDecimal(latest.average)} kg on ${dayMonth(latest.date)}.`;
}

function targetNeed(facts: WeightFacts): string | null {
  const path = facts.targetPerWeek;
  if (path === null || path === 0) return null;
  const amount = Math.abs(path).toFixed(2);
  return path < 0 ? `needs ${amount} kg a week` : `needs a gain of ${amount} kg a week`;
}

/** Weight lines for a session or a week; `withTarget` adds the target pace and the cap. */
export function weightLines(
  context: SummaryContext,
  facts: WeightFacts,
  withTarget = true,
): string[] {
  if (facts.latest === null) return ["- No weight entries yet."];
  if (facts.stale) return [`- ${staleLine(facts)}`];
  const lines = [`- 7-day average ${oneDecimal(facts.latest.average)} kg. ${trendSentence(facts)}`];
  const need = withTarget ? targetNeed(facts) : null;
  if (need !== null) {
    const cap =
      facts.targetPerWeek !== null &&
      facts.targetPerWeek < 0 &&
      context.weightRateCapKgPerWeek !== null
        ? ` The plan's cap is ${context.weightRateCapKgPerWeek.toFixed(2)} kg a week.`
        : "";
    lines.push(`- Target path ${need}.${cap}`);
  }
  return lines;
}

/** Weight lines for a month: first and last 7-day average of the range, entry count, trend and target. */
export function weightMonthLines(context: SummaryContext, from: IsoDate, to: IsoDate): string[] {
  const facts = weightFacts(context, to);
  const inRange = normalizeEntries(context.weight).filter((e) => e.date >= from && e.date <= to);
  if (facts.latest === null || inRange.length === 0) {
    return facts.latest !== null && facts.stale
      ? [`- ${staleLine(facts)}`]
      : ["- No weigh-ins in this period."];
  }
  const points = trend(context.weight, { to });
  const onOrBefore = points.filter((p) => p.date <= from);
  const first =
    onOrBefore[onOrBefore.length - 1] ?? points.find((p) => p.date > from) ?? facts.latest;
  const last = facts.latest;
  const entries = `${inRange.length} ${inRange.length === 1 ? "entry" : "entries"}`;
  const lines: string[] = [];
  if (first.date === last.date) {
    lines.push(
      `- 7-day average: ${oneDecimal(last.average)} kg on ${dayMonth(last.date)}. ${entries}.`,
    );
  } else {
    const change = Math.round((last.average - first.average) * 10) / 10;
    const delta =
      change === 0
        ? "no change"
        : `${change < 0 ? "down" : "up"} ${Math.abs(change).toFixed(1)} kg`;
    lines.push(
      `- 7-day average: ${oneDecimal(first.average)} kg on ${dayMonth(first.date)}, ${oneDecimal(last.average)} kg on ${dayMonth(last.date)} (${delta}). ${entries}.`,
    );
  }
  const need = targetNeed(facts);
  const cap =
    facts.targetPerWeek !== null &&
    facts.targetPerWeek < 0 &&
    context.weightRateCapKgPerWeek !== null
      ? `, the cap is ${context.weightRateCapKgPerWeek.toFixed(2)} kg`
      : "";
  lines.push(`- ${trendSentence(facts)}${need === null ? "" : ` Target path ${need}${cap}.`}`);
  return lines;
}

// Goals

const DAY_CAPITAL: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function purposesLine(goals: SummaryGoals, withLevel: boolean): string {
  const purposes =
    goals.purposes.length > 0
      ? `Purposes in order: ${goals.purposes.map((p, i) => `${i + 1}. ${oneLine(p)}`).join(", ")}.`
      : "Purposes: not set.";
  return withLevel && goals.level !== null
    ? `${purposes} Level: ${oneLine(goals.level)}.`
    : purposes;
}

function weightTargetText(goals: SummaryGoals): string | null {
  if (goals.targetWeightKg === null) return null;
  const by = goals.targetWeightDate !== null ? ` by ${dayLabelYear(goals.targetWeightDate)}` : "";
  return `Weight target: ${oneDecimal(goals.targetWeightKg)} kg${by}.`;
}

function eventText(goals: SummaryGoals): string | null {
  if (goals.eventName === null && goals.eventDate === null) return null;
  const name = goals.eventName === null ? "" : oneLine(goals.eventName);
  const date = goals.eventDate === null ? "" : dayLabelYear(goals.eventDate);
  return `Event: ${[name, date].filter((x) => x !== "").join(", ")}.`;
}

function availabilityText(goals: SummaryGoals, withEnvironment: boolean): string[] {
  const items: string[] = [];
  if (goals.hoursPerWeek !== null)
    items.push(`About ${trimmedDecimal(goals.hoursPerWeek)} h a week.`);
  if (withEnvironment && goals.environment !== null) {
    items.push(
      `Rides ${goals.environment === "both" ? "indoors and outdoors" : goals.environment}.`,
    );
  }
  if (goals.availableDays.length > 0) {
    items.push(`Available days: ${goals.availableDays.map((d) => DAY_CAPITAL[d]).join(", ")}.`);
  }
  return items;
}

/**
 * The Goals block. `session` has no level and no hours (it is about one ride); `week` writes the weight
 * target and the event on their own lines and names indoors and outdoors; `month` puts them on one line.
 */
export function goalsLines(
  goals: SummaryGoals | null,
  style: "session" | "week" | "month",
): string[] {
  if (goals === null) return ["- No goals set in the profile."];
  const lines = [`- ${purposesLine(goals, style !== "session")}`];
  const target = weightTargetText(goals);
  const event = eventText(goals);
  if (style === "week") {
    if (target !== null) lines.push(`- ${target}`);
    if (event !== null) lines.push(`- ${event}`);
  } else {
    const joined = [target, event].filter((x): x is string => x !== null).join(" ");
    if (joined !== "") lines.push(`- ${joined}`);
  }
  if (style !== "session") {
    const availability = availabilityText(goals, style === "week");
    if (availability.length > 0) lines.push(`- ${availability.join(" ")}`);
  }
  if (goals.goalText !== null && oneLine(goals.goalText) !== "") {
    lines.push(`- In my own words: ${oneLine(goals.goalText)}`);
  }
  return lines;
}
