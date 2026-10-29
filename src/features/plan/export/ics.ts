/**
 * Calendar export (P63, wireframe R10a): planned sessions as an RFC 5545 iCalendar file.
 *
 * Decisions (the wireframe's recommended defaults, R10-PO1 to PO5):
 * - ICS download, not a subscription link. No server, no secret.
 * - One event per session with a stable UID derived from the session id (`plan-session-<id>@cycling-hub`).
 *   Importing the file again therefore updates the events in most calendar apps instead of duplicating
 *   them. Sessions that left the plan are not removed from the calendar by a re-import (an ICS file cannot
 *   say "delete"), the PO has to remove those by hand.
 * - All-day events by default (sessions have a date, not a time). Optionally timed events at one chosen
 *   start time, in the Europe/Brussels zone: the file carries a VTIMEZONE with the EU rules (last Sunday of
 *   March and October), and the start is written as local time with `TZID=Europe/Brussels`, so the event
 *   stays at the same wall clock time on both sides of the changes on 29 Mar and 25 Oct 2026. The length is
 *   a `DURATION` (elapsed time), so a ride over the changeover is still as long as planned. A local time
 *   that does not exist (02:00 to 03:00 on 29 Mar) or exists twice (02:00 to 03:00 on 25 Oct) is resolved
 *   by the calendar app, as RFC 5545 specifies. All-day events end on the next date (DTEND is exclusive).
 * - The event day (P66) is an all-day event without workout details, also in timed mode.
 * - Description: the planned length and, when switched on, the steps with targets. No reminder (R10-PO5).
 * - Which sessions: the ones still to do, or the whole plan (R10-PO4).
 * - DTSTAMP comes from `options.now`; nothing here reads the clock, so equal input gives equal output.
 *
 * Output has CRLF line endings, lines of at most 75 octets (folded with CRLF and one space, never inside a
 * UTF-8 character) and escaped text values. Nothing here throws: a session with an invalid date is left
 * out, an invalid start time falls back to all-day events.
 */
import { addDays, isIsoDate, type IsoDate } from "@/features/athlete";
import { stepText } from "./summary-records";
import type { PlannedSessionInput } from "./types";

/** What the calendar file needs from a session. */
export type IcsSessionInput = Pick<
  PlannedSessionInput,
  "id" | "date" | "title" | "minutes" | "status" | "steps"
>;

export type IcsTiming = { mode: "all-day" } | { mode: "timed"; startTime: string };

/** `todo` is the sessions still to do; `all` is every session, done, missed and skipped ones included. */
export type IcsScope = "todo" | "all";

export type IcsEvent = {
  /** Stable id of the event (e.g. the plan's id), used in the UID. */
  id: string;
  name: string;
  date: IsoDate;
};

export type IcsOptions = {
  /** Written as DTSTAMP (UTC). Pass the moment of the download. */
  now: Date;
  scope: IcsScope;
  timing: IcsTiming;
  /** Add the steps and their targets to the event description. */
  includeSteps: boolean;
  /** The event day, exported without workout details; null for a plan without event. */
  event: IcsEvent | null;
  /** Calendar name shown by apps that support X-WR-CALNAME. */
  calendarName?: string | undefined;
};

export const ICS_FILENAME = "cycling-hub-plan.ics";
export const ICS_MIME_TYPE = "text/calendar;charset=utf-8";
const DEFAULT_CALENDAR_NAME = "Cycling Hub plan";
const PRODID = "-//Cycling Hub//Training plan//EN";
const TZID = "Europe/Brussels";
const CRLF = "\r\n";
const MAX_OCTETS = 75;

/** The file name of the download (R10a: the helper text names it). */
export function icsFilename(): string {
  return ICS_FILENAME;
}

const encoder = new TextEncoder();

/** Escapes a TEXT value (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks; drops other control characters. */
export function escapeIcsText(value: string): string {
  return stripControl(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Removes control characters except tab and the line breaks (those are escaped, not dropped). */
function stripControl(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const control = code < 0x20 || code === 0x7f;
    if (!control || code === 0x09 || code === 0x0a || code === 0x0d) out += char;
  }
  return out;
}

/**
 * Folds a content line to at most 75 octets per line (RFC 5545 3.1): a break is CRLF plus one space, and
 * the space counts towards the next line's 75. Characters are never split. The result has no trailing CRLF.
 */
export function foldIcsLine(line: string): string {
  const pieces: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = pieces.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      pieces.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  pieces.push(current);
  return pieces.join(`${CRLF} `);
}

function compactDate(date: IsoDate): string {
  return date.replace(/-/g, "");
}

function utcStamp(instant: Date): string {
  const valid = Number.isNaN(instant.getTime()) ? new Date(0) : instant;
  return valid
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function durationText(minutes: number): string {
  const total = Math.max(1, Math.round(Number.isFinite(minutes) ? minutes : 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 || h === 0 ? `${m}M` : ""}`;
}

const START_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:mm` is valid when it is a real time of day. */
export function isStartTime(value: string): boolean {
  return START_TIME.test(value);
}

function uidPart(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]/g, "-");
}

function byDateThenId(a: IcsSessionInput, b: IcsSessionInput): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The sessions that go into the file: valid dates only, filtered by scope, in date order. */
export function selectIcsSessions<T extends IcsSessionInput>(
  sessions: readonly T[],
  scope: IcsScope,
): T[] {
  return sessions
    .filter((s) => isIsoDate(s.date))
    .filter((s) => (scope === "all" ? true : s.status === "planned"))
    .sort(byDateThenId);
}

/** How many events a file for these inputs holds (R10a: "26 sessions and the event"). */
export function countIcsEvents(
  sessions: readonly IcsSessionInput[],
  options: Pick<IcsOptions, "scope" | "event">,
): { sessions: number; event: boolean } {
  return {
    sessions: selectIcsSessions(sessions, options.scope).length,
    event: options.event !== null && isIsoDate(options.event.date),
  };
}

function description(session: IcsSessionInput, includeSteps: boolean): string {
  const lines = [`${Math.max(1, Math.round(session.minutes))} min planned.`];
  if (session.status !== "planned") {
    lines.push(`Status: ${session.status}.`);
  }
  if (includeSteps && session.steps.length > 0) {
    lines.push("Steps:", ...session.steps.map((step) => `- ${stepText(step)}`));
  }
  return lines.join("\n");
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19701025T030000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "TZNAME:CET",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19700329T020000",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "TZNAME:CEST",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

function allDayLines(date: IsoDate): string[] {
  const next = addDays(date, 1) ?? date;
  return [`DTSTART;VALUE=DATE:${compactDate(date)}`, `DTEND;VALUE=DATE:${compactDate(next)}`];
}

/**
 * Builds the calendar file. Sessions and the event day become VEVENTs; see the file header for the
 * decisions. The result always ends with CRLF.
 */
export function buildIcs(sessions: readonly IcsSessionInput[], options: IcsOptions): string {
  const stamp = utcStamp(options.now);
  const timed =
    options.timing.mode === "timed" && isStartTime(options.timing.startTime)
      ? options.timing.startTime
      : null;
  const selected = selectIcsSessions(sessions, options.scope);
  const event = options.event !== null && isIsoDate(options.event.date) ? options.event : null;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName ?? DEFAULT_CALENDAR_NAME)}`,
    `X-WR-TIMEZONE:${TZID}`,
  ];
  if (timed !== null && selected.length > 0) lines.push(...VTIMEZONE);

  for (const session of selected) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:plan-session-${uidPart(session.id)}@cycling-hub`,
      `DTSTAMP:${stamp}`,
    );
    if (timed !== null) {
      lines.push(
        `DTSTART;TZID=${TZID}:${compactDate(session.date)}T${timed.replace(":", "")}00`,
        `DURATION:${durationText(session.minutes)}`,
      );
    } else {
      lines.push(...allDayLines(session.date), "TRANSP:TRANSPARENT");
    }
    lines.push(
      `SUMMARY:${escapeIcsText(session.title)}`,
      `DESCRIPTION:${escapeIcsText(description(session, options.includeSteps))}`,
      "END:VEVENT",
    );
  }

  if (event !== null) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:plan-event-${uidPart(event.id)}@cycling-hub`,
      `DTSTAMP:${stamp}`,
      ...allDayLines(event.date),
      "TRANSP:TRANSPARENT",
      `SUMMARY:${escapeIcsText(event.name)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** A 53-bit string hash (cyrb53); not a security feature, only a change detector. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * A fingerprint of what the file would contain: the events with their dates, titles, lengths, steps and
 * statuses, but not the DTSTAMP. Store it with the options when the file is downloaded. Changing an option
 * (scope, timing, steps) changes the fingerprint too, so compare with the options stored at download time.
 */
export function icsFingerprint(sessions: readonly IcsSessionInput[], options: IcsOptions): string {
  const file = buildIcs(sessions, { ...options, now: new Date(0) });
  return `ics1-${hash(file)}`;
}

/**
 * True when the plan changed since the file was downloaded (R10a note 4): the stored fingerprint differs
 * from the current one. With no stored fingerprint (never downloaded) nothing is out of date.
 */
export function isIcsOutOfDate(
  storedFingerprint: string | null,
  sessions: readonly IcsSessionInput[],
  options: IcsOptions,
): boolean {
  return storedFingerprint !== null && storedFingerprint !== icsFingerprint(sessions, options);
}
