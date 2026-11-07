/**
 * Merging a rebuilt plan into the stored sessions (docs/plan/engine-rules.md section 12). Sessions are
 * matched by date (one session per date), frozen sessions are never touched, and the result is an applicable
 * diff `{insert, update, delete}` plus its inverse for Undo. Pure.
 */
import type { IsoDate } from "@/features/athlete";
import type { SessionChange } from "../engine";
import type { PlanDiff, SessionData, StoredSession } from "./types";

/** Stable JSON: object keys sorted, so rows read from the database compare equal to built sessions. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function content(session: SessionData): string {
  const { week, slot, kind, title, durationMin, steps, reason, indoor, load, mainSet } = session;
  return canonical({
    week,
    slot,
    kind,
    title,
    durationMin,
    steps,
    reason,
    indoor,
    load,
    mainSet,
    ladderStep: session.ladderStep,
    strengthNote: session.strengthNote,
    movedFrom: session.movedFrom,
  });
}

/** True when two sessions hold the same plan content (status and match are not part of it). */
export function sameSession(a: SessionData, b: SessionData): boolean {
  return content(a) === content(b);
}

/** The stored session without its row fields: what a diff carries. */
export function sessionData(session: StoredSession | SessionData): SessionData {
  const {
    date,
    week,
    slot,
    kind,
    title,
    durationMin,
    steps,
    reason,
    indoor,
    status,
    load,
    mainSet,
    ladderStep,
    strengthNote,
    movedFrom,
  } = session;
  return {
    date,
    week,
    slot,
    kind,
    title,
    durationMin,
    steps,
    reason,
    indoor,
    status,
    load,
    mainSet,
    ladderStep,
    strengthNote,
    movedFrom,
  };
}

/**
 * Sessions the re-evaluation never changes (section 12): a date before today, a status other than planned,
 * a manual match (locked), and today's session when a ride for today already exists (it has started).
 */
export function isFrozen(session: StoredSession, today: IsoDate, startedToday: boolean): boolean {
  return (
    session.date < today ||
    session.status !== "planned" ||
    session.matchSource === "manual" ||
    (session.date === today && startedToday)
  );
}

function summary(session: SessionData): NonNullable<SessionChange["before"]> {
  return { kind: session.kind, durationMin: session.durationMin, mainSet: session.mainSet };
}

function targetsOf(session: SessionData): string {
  return canonical(session.steps.map((step) => [step.target, step.heartRate]));
}

/**
 * What differs between an old and a new future session, as a `SessionChange`; null when only wording or
 * notes differ (those are written but not announced). Kind wins over main set, over minutes, over targets.
 */
export function describeChange(
  before: SessionData | null,
  after: SessionData | null,
): SessionChange | null {
  if (before === null && after === null) return null;
  if (before === null && after !== null) {
    return { date: after.date, change: "added", before: null, after: summary(after) };
  }
  if (before !== null && after === null) {
    return { date: before.date, change: "removed", before: summary(before), after: null };
  }
  if (before === null || after === null) return null;
  let change: SessionChange["change"] | null = null;
  if (before.kind !== after.kind) change = "kind";
  else if (before.mainSet !== after.mainSet) change = "main-set";
  else if (before.durationMin !== after.durationMin) change = "minutes";
  else if (targetsOf(before) !== targetsOf(after)) change = "targets";
  if (change === null) return null;
  return { date: after.date, change, before: summary(before), after: summary(after) };
}

/**
 * The diff that turns the stored future sessions into `rebuilt`. Frozen stored sessions are kept as they
 * are and their dates are not offered to the rebuilt plan; rebuilt sessions before today are ignored.
 * Matching is by date: a date only in `rebuilt` is inserted, a date only in the stored future is deleted,
 * and a date in both is updated when the plan content differs (the row keeps its id).
 */
export function mergePlan(
  stored: readonly StoredSession[],
  rebuilt: readonly SessionData[],
  options: { today: IsoDate; startedToday?: boolean },
): PlanDiff {
  const startedToday = options.startedToday ?? false;
  const frozenDates = new Set(
    stored.filter((s) => isFrozen(s, options.today, startedToday)).map((s) => s.date),
  );
  const future = new Map<IsoDate, StoredSession>();
  for (const session of stored) {
    if (!isFrozen(session, options.today, startedToday)) future.set(session.date, session);
  }
  const next = new Map<IsoDate, SessionData>();
  for (const session of rebuilt) {
    if (session.date < options.today || frozenDates.has(session.date)) continue;
    next.set(session.date, { ...sessionData(session), status: "planned" });
  }

  const diff: PlanDiff = { insert: [], update: [], delete: [] };
  for (const date of [...next.keys()].sort()) {
    const after = next.get(date);
    if (!after) continue;
    const old = future.get(date);
    if (!old) {
      diff.insert.push({ session: after });
    } else if (!sameSession(sessionData(old), after)) {
      diff.update.push({ id: old.id, date, before: sessionData(old), after });
    }
  }
  for (const date of [...future.keys()].sort()) {
    const old = future.get(date);
    if (old && !next.has(date)) diff.delete.push({ id: old.id, date, session: sessionData(old) });
  }
  return diff;
}

/**
 * The diff between two lists of stored sessions, by row id: rows only in `after` are inserted (with their
 * status and match), rows only in `before` are deleted, rows in both whose plan content differs are updated.
 */
export function diffStored(
  before: readonly StoredSession[],
  after: readonly StoredSession[],
): PlanDiff {
  const old = new Map(before.map((s) => [s.id, s]));
  const next = new Map(after.map((s) => [s.id, s]));
  const diff: PlanDiff = { insert: [], update: [], delete: [] };
  for (const s of after) {
    const was = old.get(s.id);
    if (!was) {
      diff.insert.push({
        session: sessionData(s),
        ...(s.activityId === null ? {} : { activityId: s.activityId }),
        ...(s.matchSource === null ? {} : { matchSource: s.matchSource }),
      });
    } else if (!sameSession(sessionData(was), sessionData(s))) {
      diff.update.push({ id: s.id, date: s.date, before: sessionData(was), after: sessionData(s) });
    }
  }
  for (const s of before) {
    if (!next.has(s.id)) diff.delete.push({ id: s.id, date: s.date, session: sessionData(s) });
  }
  const byDate = (a: { date: string }, b: { date: string }): number =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  diff.insert.sort((a, b) => byDate(a.session, b.session));
  diff.update.sort(byDate);
  diff.delete.sort(byDate);
  return diff;
}

/** True when the diff changes nothing. */
export function isEmptyDiff(diff: PlanDiff): boolean {
  return diff.insert.length === 0 && diff.update.length === 0 && diff.delete.length === 0;
}

/**
 * The inverse of a diff, for Undo: inserted sessions are deleted (by date), deleted sessions are inserted
 * again with their old id, updated sessions get their old content back. `invertDiff(invertDiff(d))` is `d`
 * up to the ids of the inserted rows.
 */
export function invertDiff(diff: PlanDiff): PlanDiff {
  return {
    insert: diff.delete.map((d) => ({
      ...(d.id === undefined ? {} : { id: d.id }),
      session: d.session,
    })),
    update: diff.update.map((u) => ({ id: u.id, date: u.date, before: u.after, after: u.before })),
    delete: diff.insert.map((i) => ({
      ...(i.id === undefined ? {} : { id: i.id }),
      date: i.session.date,
      session: i.session,
    })),
  };
}

/**
 * Applies a diff to a list of stored sessions (the data layer's state, and the tests). New rows get their
 * id from `newId`, which defaults to a date based id; the result is ordered by date. Does not change the
 * input.
 */
export function applyDiff(
  sessions: readonly StoredSession[],
  diff: PlanDiff,
  newId: (session: SessionData) => string = (s) => `session-${s.date}`,
): StoredSession[] {
  const deleted = new Set(diff.delete.map((d) => d.id ?? `date:${d.date}`));
  const updates = new Map(diff.update.map((u) => [u.id, u]));
  const kept = sessions
    .filter((s) => !deleted.has(s.id) && !deleted.has(`date:${s.date}`))
    .map((s): StoredSession => {
      const update = updates.get(s.id);
      return update ? { ...s, ...update.after, status: s.status } : s;
    });
  const added = diff.insert.map((i): StoredSession => ({
    ...i.session,
    id: i.id ?? newId(i.session),
    activityId: i.activityId ?? null,
    matchSource: i.matchSource ?? null,
  }));
  return [...kept, ...added].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
