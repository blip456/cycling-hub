/**
 * Pure helpers for the plan screens: weeks and phases from the stored sessions, the day list of a week,
 * today's card, the days a session can move to, and the words and numbers the screens print. No React and
 * no Supabase, so they are tested on their own.
 */
import {
  addDays,
  diffDays,
  heartRateZones,
  powerZones,
  WEEKDAYS,
  weekdayIndex,
  type IsoDate,
  type Weekday,
} from "@/features/athlete";
import { formatDay } from "@/features/weight/format";
import {
  STRUCTURED_KINDS,
  type Intake,
  type SessionKind,
  type SessionStatus,
  type Step,
} from "../engine";
import type { PlanSession, StoredPhase, StoredPlan } from "./types";

// ---- words ---------------------------------------------------------------------------------------

/** "1 h 15", "45 min", "2 h". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${String(m)} min`;
  return m === 0 ? `${String(h)} h` : `${String(h)} h ${String(m)}`;
}

/** Duration for a screen reader: "1 hour 15 minutes". */
export function spokenDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${String(h)} ${h === 1 ? "hour" : "hours"}`);
  if (m > 0) parts.push(`${String(m)} ${m === 1 ? "minute" : "minutes"}`);
  return parts.join(" ");
}

/** Load as a whole number, as the screens print it. */
export function formatLoad(load: number): string {
  return String(Math.round(load));
}

export const STATUS_TEXT: Record<SessionStatus, string> = {
  planned: "Planned",
  done: "Done",
  missed: "Missed",
  skipped: "Skipped",
};

export const PHASE_TEXT: Record<StoredPhase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  recovery: "Recovery",
  taper: "Taper",
};

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** "Wednesday", from a date. */
export function weekdayName(date: IsoDate): string {
  return WEEKDAY_NAMES[weekdayIndex(date) ?? 0] ?? "";
}

/** "Wed 28 Oct". */
export { formatDay };

/** "Monday 2 Nov 2026". */
export function formatLongDate(date: IsoDate): string {
  const year = date.slice(0, 4);
  return `${weekdayName(date)} ${formatShortDate(date)} ${year}`;
}

/** "28 Oct". */
export function formatShortDate(date: IsoDate): string {
  return formatDay(date).split(" ").slice(1).join(" ");
}

/** "26 Oct – 1 Nov" for a week. */
export function weekRange(startDate: IsoDate): string {
  const end = addDays(startDate, 6) ?? startDate;
  return `${formatShortDate(startDate)} – ${formatShortDate(end)}`;
}

/** The facts of a session as separate parts: ["1 h 15", "Load 82", "Indoor"]. */
export function sessionFactParts(
  session: PlanSession,
  environment: Intake["environment"],
): string[] {
  if (session.kind === "event") return [`${formatDuration(session.durationMin)} expected`];
  const place = placeOf(session, environment);
  return [
    formatDuration(session.durationMin),
    `Load ${formatLoad(session.load)}`,
    ...(place === null ? [] : [place === "indoor" ? "Indoor" : "Outdoor"]),
  ];
}

/** Summary of a session for a row: "1 h 15 · Load 82 · Indoor". */
export function sessionFacts(session: PlanSession, environment: Intake["environment"]): string {
  return sessionFactParts(session, environment).join(" · ");
}

/** Where a session is ridden: its own choice, else the plan's environment; null when "both" and not chosen. */
export function placeOf(
  session: PlanSession,
  environment: Intake["environment"],
): "indoor" | "outdoor" | null {
  if (session.kind === "event") return null;
  if (session.indoor !== null) return session.indoor ? "indoor" : "outdoor";
  if (environment === "indoor") return "indoor";
  if (environment === "outdoor") return "outdoor";
  return null;
}

// ---- weeks ---------------------------------------------------------------------------------------

export function isHard(session: Pick<PlanSession, "kind" | "steps">): boolean {
  if (STRUCTURED_KINDS.includes(session.kind)) return true;
  return session.kind === "long" && session.steps.some((s) => s.kind === "work");
}

/** Sessions that count in a week's hours and load: everything but the event. */
function counted(sessions: readonly PlanSession[]): PlanSession[] {
  return sessions.filter((s) => s.kind !== "event" && s.status !== "skipped");
}

export type WeekSummary = {
  number: number;
  startDate: IsoDate;
  phase: StoredPhase;
  /** Planned minutes of the week without the event and skipped sessions. */
  minutes: number;
  load: number;
  sessions: PlanSession[];
  eventDate: IsoDate | null;
};

/** The weeks of a plan, one per week number from 1 to the plan's length, with what the sessions add up to. */
export function weekSummaries(plan: StoredPlan, sessions: readonly PlanSession[]): WeekSummary[] {
  const weeks: WeekSummary[] = [];
  let previous: StoredPhase = "base";
  for (let number = 1; number <= plan.weeks; number += 1) {
    const own = sessions.filter((s) => s.week === number);
    const phase: StoredPhase = own[0]?.phase ?? previous;
    previous = phase;
    const sum = counted(own);
    weeks.push({
      number,
      startDate: addDays(plan.startDate, 7 * (number - 1)) ?? plan.startDate,
      phase,
      minutes: sum.reduce((total, s) => total + s.durationMin, 0),
      load: sum.reduce((total, s) => total + s.load, 0),
      sessions: own,
      eventDate: own.find((s) => s.kind === "event")?.date ?? null,
    });
  }
  return weeks;
}

/** The 1-based week of a date; 0 before the plan starts, and the plan length + 1 after it ends. */
export function weekNumberOf(plan: StoredPlan, date: IsoDate): number {
  const days = diffDays(plan.startDate, date);
  if (days === null) return 0;
  if (days < 0) return 0;
  return Math.min(Math.floor(days / 7) + 1, plan.weeks + 1);
}

export type PhaseGroup = { phase: StoredPhase; weeks: WeekSummary[] };

/** Consecutive weeks of one phase, in plan order (recovery weeks are their own group, as in T4). */
export function phaseGroups(weeks: readonly WeekSummary[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const week of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.phase === week.phase) last.weeks.push(week);
    else groups.push({ phase: week.phase, weeks: [week] });
  }
  return groups;
}

/** "weeks 1 to 3" or "week 4". */
export function weekSpan(group: PhaseGroup): string {
  const first = group.weeks[0]?.number ?? 0;
  const last = group.weeks[group.weeks.length - 1]?.number ?? first;
  return first === last ? `week ${String(first)}` : `weeks ${String(first)} to ${String(last)}`;
}

/** Days from `today` to the event date, or null with no event or an event in the past. */
export function daysToEvent(sessions: readonly PlanSession[], today: IsoDate): number | null {
  const event = sessions.find((s) => s.kind === "event");
  if (!event) return null;
  const days = diffDays(today, event.date);
  return days !== null && days >= 0 ? days : null;
}

// ---- the days of a week ----------------------------------------------------------------------------

export type DayCell = {
  date: IsoDate;
  weekday: Weekday;
  sessions: PlanSession[];
  /** True for a day the PO can ride (profile); a day with a session also counts. */
  trainingDay: boolean;
  isToday: boolean;
};

/** Monday to Sunday of the week that starts on `startDate`. */
export function weekDays(
  startDate: IsoDate,
  sessions: readonly PlanSession[],
  availableDays: readonly Weekday[],
  today: IsoDate,
): DayCell[] {
  return WEEKDAYS.map((weekday, i) => {
    const date = addDays(startDate, i) ?? startDate;
    const own = sessions.filter((s) => s.date === date).sort((a, b) => a.dayOrder - b.dayOrder);
    return {
      date,
      weekday,
      sessions: own,
      trainingDay: availableDays.includes(weekday) || own.length > 0,
      isToday: date === today,
    };
  });
}

/** Monday of the week with `date`. */
export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, -(weekdayIndex(date) ?? 0)) ?? date;
}

// ---- today's card ----------------------------------------------------------------------------------

export type TodayCard =
  | { kind: "before"; startDate: IsoDate }
  | { kind: "after" }
  | { kind: "session"; session: PlanSession; more: number }
  | { kind: "done"; session: PlanSession }
  | { kind: "rest"; next: PlanSession | null };

/** What today's card shows (T6): the first open session of today, the done one, or a rest day. */
export function todayCard(
  plan: StoredPlan,
  sessions: readonly PlanSession[],
  today: IsoDate,
): TodayCard {
  if (today < plan.startDate) return { kind: "before", startDate: plan.startDate };
  const todays = sessions.filter((s) => s.date === today).sort((a, b) => a.dayOrder - b.dayOrder);
  const open = todays.filter((s) => s.status === "planned" || s.status === "missed");
  const first = open[0];
  if (first) return { kind: "session", session: first, more: open.length - 1 };
  const finished = todays.find((s) => s.status === "done");
  if (finished) return { kind: "done", session: finished };
  const skipped = todays[0];
  if (skipped) return { kind: "rest", next: nextSession(sessions, today) };
  const last = diffDays(plan.startDate, today);
  const length = plan.weeks * 7;
  if (last !== null && last >= length && nextSession(sessions, today) === null)
    return { kind: "after" };
  return { kind: "rest", next: nextSession(sessions, today) };
}

/** The first planned session after `date`. */
export function nextSession(sessions: readonly PlanSession[], date: IsoDate): PlanSession | null {
  return (
    [...sessions]
      .filter((s) => s.date > date && s.status === "planned")
      .sort((a, b) => a.date.localeCompare(b.date) || a.dayOrder - b.dayOrder)[0] ?? null
  );
}

// ---- moving a session ----------------------------------------------------------------------------

export type MoveOption = {
  date: IsoDate;
  /** The session that is on that day and swaps with the moved one; null for a free day. */
  swapWith: PlanSession | null;
  trainingDay: boolean;
  /** Words under the day: "Free", "Easy spin is planned. The two sessions swap". */
  note: string;
};

/**
 * The days a session can move to (T8b): from today to the end of its week, without its own day. A day with
 * another open session swaps with it; a done or skipped session is not moved over.
 */
export function moveOptions(
  session: PlanSession,
  sessions: readonly PlanSession[],
  availableDays: readonly Weekday[],
  today: IsoDate,
): MoveOption[] {
  const monday = mondayOf(session.date);
  const options: MoveOption[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(monday, i);
    if (date === null || date === session.date || date < today) continue;
    const there = sessions.filter((s) => s.date === date && s.id !== session.id);
    if (there.some((s) => s.status === "done")) continue;
    const swapWith = there.find((s) => s.status === "planned") ?? null;
    const index = weekdayIndex(date) ?? 0;
    const weekday = WEEKDAYS[index];
    const trainingDay = weekday !== undefined && availableDays.includes(weekday);
    options.push({
      date,
      swapWith,
      trainingDay,
      note: swapWith
        ? `${swapWith.title} is planned. The two sessions swap`
        : trainingDay
          ? "Free"
          : "Free. Not one of your training days",
    });
  }
  return options;
}

/** The session dates of a week after moving `session` to `option` (swapping when needed). */
function afterMove(
  session: PlanSession,
  option: MoveOption,
  sessions: readonly PlanSession[],
): PlanSession[] {
  return sessions
    .filter((s) => s.week === session.week && s.status !== "skipped")
    .map((s) => {
      if (s.id === session.id) return { ...s, date: option.date };
      if (option.swapWith && s.id === option.swapWith.id) return { ...s, date: session.date };
      return s;
    });
}

/**
 * A warning in words when the move would put hard sessions on the same or on back-to-back days (engine rules
 * C8: hard days need an easy day after). The move is still allowed; the PO decides.
 */
export function moveWarnings(
  session: PlanSession,
  option: MoveOption,
  sessions: readonly PlanSession[],
): string[] {
  const warnings: string[] = [];
  if (!option.trainingDay)
    warnings.push(
      `${weekdayName(option.date)} is not one of your training days. The session is moved anyway.`,
    );
  const hard = afterMove(session, option, sessions)
    .filter((s) => isHard(s))
    .map((s) => s.date)
    .sort();
  let clash = false;
  for (let i = 1; i < hard.length; i += 1) {
    const gap = diffDays(hard[i - 1] ?? "", hard[i] ?? "");
    if (gap !== null && gap <= 1) clash = true;
  }
  if (clash && (isHard(session) || (option.swapWith !== null && isHard(option.swapWith))))
    warnings.push(
      "That puts two hard sessions on the same or on back-to-back days. Hard days need an easy day between them.",
    );
  return warnings;
}

// ---- steps: words and numbers ---------------------------------------------------------------------

const POWER_NAMES = (powerZones(100) ?? []).map((z) => z.name);
const HR_NAMES = (heartRateZones({ lthr: 100 })?.zones ?? []).map((z) => z.name);

export function powerZoneName(zone: number): string {
  return POWER_NAMES[zone - 1] ?? "";
}

export function heartRateZoneName(zone: number): string {
  return HR_NAMES[zone - 1] ?? "";
}

/** "228 W", "228–262 W", "up to 137 W" or "300 W and up". */
export function wattsText(step: Step): string | null {
  const { target, min, max } = step.target.watts;
  if (step.target.exact) return target === null ? null : `${String(target)} W`;
  if (max === null && min === null) return null;
  if (max === null) return `${String(min)} W and up`;
  if (min === null || min === 0) return `up to ${String(max)} W`;
  return `${String(min)}–${String(max)} W`;
}

/** "151–169 bpm" or "up to 112 bpm"; null without heart rate. */
export function heartRateText(step: Step): string | null {
  const hr = step.heartRate;
  if (!hr) return null;
  if (hr.max === null) return `${String(hr.min)} bpm and up`;
  if (hr.min === 0) return `up to ${String(hr.max)} bpm`;
  return `${String(hr.min)}–${String(hr.max)} bpm`;
}

/** "Z4 · Threshold" for the power zone of a step; null for all-out work. */
export function powerZoneLabel(step: Step): string | null {
  const zone = step.target.powerZone;
  return zone === null ? null : `Z${String(zone)} · ${powerZoneName(zone)}`;
}

/** "Z3 to Z4 · Tempo" or "Z2 · Endurance" for the heart rate zones of a step. */
export function heartRateZoneLabel(step: Step): string | null {
  const hr = step.heartRate;
  if (!hr) return null;
  if (hr.zoneFrom === hr.zoneTo)
    return `Z${String(hr.zoneFrom)} · ${heartRateZoneName(hr.zoneFrom)}`;
  return `Z${String(hr.zoneFrom)} to Z${String(hr.zoneTo)} · ${heartRateZoneName(hr.zoneFrom)} to ${heartRateZoneName(hr.zoneTo)}`;
}

export type StepLine = { step: Step; repeats: number };

export type StepGroup = {
  /** "Warm-up", "Main set" or "Cool-down". */
  title: string;
  minutes: number;
  /** "3 × 12 min" for a main set of equal work steps. */
  summary: string | null;
  lines: StepLine[];
};

/** Steps as warm-up, main set and cool-down; equal steps of the main set are listed once with a repeat count. */
export function stepGroups(steps: readonly Step[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const main: Step[] = [];
  const flush = () => {
    if (main.length === 0) return;
    const lines: StepLine[] = [];
    for (const step of main) {
      const same = lines.find(
        (l) =>
          l.step.kind === step.kind &&
          l.step.durationSec === step.durationSec &&
          l.step.target.percentFtp === step.target.percentFtp,
      );
      if (same) same.repeats += 1;
      else lines.push({ step, repeats: 1 });
    }
    const work = main.filter((s) => s.kind === "work");
    const lengths = new Set(work.map((s) => s.durationMin));
    const only = work[0];
    groups.push({
      title: "Main set",
      minutes: main.reduce((sum, s) => sum + s.durationMin, 0),
      summary:
        only && lengths.size === 1
          ? `${String(work.length)} × ${formatStepMinutes(only.durationMin)}`
          : null,
      lines,
    });
    main.length = 0;
  };
  for (const step of steps) {
    if (step.kind === "warm-up" || step.kind === "cool-down") {
      flush();
      groups.push({
        title: step.kind === "warm-up" ? "Warm-up" : "Cool-down",
        minutes: step.durationMin,
        summary: null,
        lines: [{ step, repeats: 1 }],
      });
    } else main.push(step);
  }
  flush();
  return groups;
}

/** "12 min", "30 s" for very short steps. */
export function formatStepMinutes(minutes: number): string {
  if (minutes < 1) return `${String(Math.round(minutes * 60))} s`;
  const rounded = Math.round(minutes * 10) / 10;
  return `${String(rounded)} min`;
}

/** What the session is about in one line: its main set with watts and zone, for the today card. */
export function mainSetLine(session: PlanSession): string | null {
  const group = stepGroups(session.steps).find((g) => g.title === "Main set");
  const work = group?.lines.find((l) => l.step.kind === "work")?.step;
  if (!group || !work) return null;
  const watts = wattsText(work);
  const zone = powerZoneLabel(work);
  const what = group.summary ?? formatStepMinutes(group.minutes);
  return [`Main set: ${what}`, watts ? `at ${watts}` : null, zone ? `(${zone})` : null]
    .filter((part): part is string => part !== null)
    .join(" ");
}

/** Kind for a screen reader or a label, e.g. "sweet-spot" is "Sweet spot". */
export function kindName(kind: SessionKind): string {
  const text = kind === "vo2" ? "VO2 max" : kind.replace("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
