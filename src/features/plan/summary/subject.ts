import { addDays, addMonths, isIsoDate, type IsoDate } from "@/features/athlete";
import { mondayOf } from "./adapt";

/** What a summary is about: one planned session, the week of a date, or a calendar month. */
export type Subject =
  | { kind: "session"; id: string }
  | { kind: "week"; date: IsoDate }
  | { kind: "month"; year: number; month: number };

// ---- the page address ---------------------------------------------------------------------------------

/**
 * Reads `?type=session|week|month&id=|date=`: `id` is a planned session id; `date` is any `YYYY-MM-DD`
 * (for a month also `YYYY-MM`). A missing or unreadable address means this week.
 */
export function subjectFromParams(params: URLSearchParams, today: IsoDate): Subject {
  const type = params.get("type");
  const date = params.get("date");
  const validDate = date !== null && isIsoDate(date) ? date : null;
  if (type === "session") {
    const id = params.get("id");
    if (id !== null && id !== "") return { kind: "session", id };
    return { kind: "session", id: "" };
  }
  if (type === "month") {
    const match = date === null ? null : /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(date);
    const month = match ? Number(match[2]) : 0;
    if (match && month >= 1 && month <= 12) return { kind: "month", year: Number(match[1]), month };
    return { kind: "month", year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  }
  return { kind: "week", date: validDate ?? today };
}

/** The address for a subject, the inverse of `subjectFromParams`. */
export function paramsFor(subject: Subject): URLSearchParams {
  if (subject.kind === "session") return new URLSearchParams({ type: "session", id: subject.id });
  if (subject.kind === "week") return new URLSearchParams({ type: "week", date: subject.date });
  return new URLSearchParams({
    type: "month",
    date: `${subject.year}-${String(subject.month).padStart(2, "0")}-01`,
  });
}

/** A planned session in the order of the plan, as the navigation needs it. */
export type SessionRef = { id: string; session_date: IsoDate };

function byDate(a: SessionRef, b: SessionRef): number {
  return a.session_date === b.session_date
    ? a.id.localeCompare(b.id)
    : a.session_date < b.session_date
      ? -1
      : 1;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** The day a subject is about: the session's date, any day of the week, or the first of the month. */
export function subjectDate(subject: Subject, sessions: readonly SessionRef[]): IsoDate | null {
  if (subject.kind === "session")
    return sessions.find((s) => s.id === subject.id)?.session_date ?? null;
  if (subject.kind === "week") return subject.date;
  return `${subject.year}-${pad(subject.month)}-01`;
}

/** The session nearest to a date, preferring the first one on or after it. Null without sessions. */
function sessionNear(date: IsoDate, sessions: readonly SessionRef[]): SessionRef | null {
  const sorted = [...sessions].sort(byDate);
  return sorted.find((s) => s.session_date >= date) ?? sorted[sorted.length - 1] ?? null;
}

/**
 * The same moment in another kind of summary. Week and month keep the day (a month the day's month); a
 * session is the one on or after the day. Today stands in when the current subject has no day, and when
 * the current month is this month.
 */
export function switchKind(
  current: Subject,
  kind: Subject["kind"],
  today: IsoDate,
  sessions: readonly SessionRef[],
): Subject {
  if (current.kind === kind) return current;
  const date = subjectDate(current, sessions) ?? today;
  const day = current.kind === "month" && date.slice(0, 7) === today.slice(0, 7) ? today : date;
  if (kind === "session") return { kind, id: sessionNear(day, sessions)?.id ?? "" };
  if (kind === "week") return { kind, date: day };
  return { kind, year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** The previous (-1) or next (1) session, week or month; null when a session is the first or last. */
export function stepSubject(
  subject: Subject,
  direction: -1 | 1,
  sessions: readonly SessionRef[],
): Subject | null {
  if (subject.kind === "session") {
    const sorted = [...sessions].sort(byDate);
    const index = sorted.findIndex((s) => s.id === subject.id);
    const target = index === -1 ? undefined : sorted[index + direction];
    return target ? { kind: "session", id: target.id } : null;
  }
  if (subject.kind === "week") {
    const date = addDays(mondayOf(subject.date), 7 * direction);
    return date === null ? null : { kind: "week", date };
  }
  const first = addMonths(`${subject.year}-${pad(subject.month)}-01`, direction);
  return first === null
    ? null
    : { kind: "month", year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)) };
}
