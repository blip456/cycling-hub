/**
 * Matching rides to planned sessions (docs/plan/engine-rules.md, section 11). Pure and deterministic: the same
 * sessions and rides always give the same links. One ride counts for one session; a manual link or unlink is
 * locked and never changed.
 */
import type { IsoDate } from "@/features/athlete";
import type { PlannedSession, SessionKind } from "../engine";
import type { MatchFlag } from "../export/types";
import { between, mondayOf } from "./dates";
import type { AdaptRide, Match, MatchResult, StoredSession } from "./types";

/** Rides tagged commute, or shorter than this, are ignored unless the PO links them (section 11). */
export const IGNORED_RIDE_MINUTES = 20;
/** Sessions from this many days ago are matched again at every evaluation (`LATE_IMPORT_WINDOW`). */
export const LATE_IMPORT_DAYS = 3;
/** A ride is short of the plan below this share of the planned time. */
export const SHORT_BELOW = 0.85;
/** Intensity ratio that still counts as a fit; outside it the match carries a flag (never blocks). */
export const INTENSITY_FIT: readonly [low: number, high: number] = [0.8, 1.25];
/** A long ride substitution needs at least this share of the planned long ride. */
export const LONG_SUBSTITUTION_MIN = 0.75;

const DATE_PENALTY_ONE_DAY = 10;
const DURATION_WEIGHT = 20;
const INTENSITY_WEIGHT = 10;

/** True for a ride matching ignores (commute, or under 20 minutes). */
export function isIgnoredRide(ride: AdaptRide): boolean {
  return ride.commute === true || ride.movingMinutes < IGNORED_RIDE_MINUTES;
}

/** Duration fit of a ride to a session kind: `r = moving time / planned minutes` must be inside the range. */
function fitRange(kind: SessionKind): readonly [number, number] {
  switch (kind) {
    case "recovery":
    case "endurance":
      return [0.6, 1.5];
    case "long":
      return [0.75, Number.POSITIVE_INFINITY];
    case "event":
      return [0.5, Number.POSITIVE_INFINITY];
    default:
      return [0.7, 1.3];
  }
}

/** Time-weighted planned intensity of a session in percent of FTP (0 when it has no steps). */
export function plannedPercentFtp(session: Pick<PlannedSession, "steps">): number {
  let seconds = 0;
  let weighted = 0;
  for (const step of session.steps) {
    seconds += step.durationSec;
    weighted += step.durationSec * step.target.percentFtp;
  }
  return seconds === 0 ? 0 : weighted / seconds;
}

type Pair = {
  ratio: number;
  flags: MatchFlag[];
  shortByMinutes: number | null;
  intensityPenalty: number;
};

function pairOf(session: PlannedSession, ride: AdaptRide, ftp: number | null): Pair {
  const ratio = session.durationMin > 0 ? ride.movingMinutes / session.durationMin : 0;
  const flags: MatchFlag[] = [];
  let shortByMinutes: number | null = null;
  if (ratio < SHORT_BELOW) {
    flags.push("short");
    shortByMinutes = Math.max(0, Math.round(session.durationMin - ride.movingMinutes));
  }
  let intensityPenalty = 0;
  const planned = plannedPercentFtp(session) / 100;
  if (ftp !== null && ftp > 0 && ride.avgPowerW !== null && ride.avgPowerW > 0 && planned > 0) {
    const intensity = ride.avgPowerW / ftp / planned;
    intensityPenalty = INTENSITY_WEIGHT * Math.abs(1 - intensity);
    if (intensity < INTENSITY_FIT[0]) flags.push("easier");
    else if (intensity > INTENSITY_FIT[1]) flags.push("harder");
  }
  return { ratio, flags, shortByMinutes, intensityPenalty };
}

/** True when a ride may count for a session: date window and duration fit, or a long ride done early. */
function legal(session: StoredSession, ride: AdaptRide): boolean {
  const [low, high] = fitRange(session.kind);
  const ratio = session.durationMin > 0 ? ride.movingMinutes / session.durationMin : 0;
  const apart = Math.abs(between(session.date, ride.date));
  if (apart <= (session.kind === "event" ? 0 : 1) && ratio >= low && ratio <= high) return true;
  return (
    session.kind === "long" &&
    ride.date < session.date &&
    mondayOf(ride.date) === mondayOf(session.date) &&
    ratio >= LONG_SUBSTITUTION_MIN
  );
}

function toMatch(
  session: StoredSession,
  ride: AdaptRide,
  pair: Pair,
  by: "automatic" | "manual",
): Match {
  return {
    sessionId: session.id,
    sessionDate: session.date,
    rideId: ride.id,
    rideDate: ride.date,
    by,
    flags: pair.flags,
    shortByMinutes: pair.shortByMinutes,
    ratio: pair.ratio,
    doneEarly: ride.date < session.date,
    info: { by, flags: pair.flags, shortByMinutes: pair.shortByMinutes },
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Links rides to sessions. The sessions from 3 days ago to tomorrow are matched again from scratch (a late
 * import can turn a missed session into done); older sessions keep their link. A session with a manual
 * link or unlink is locked, and its ride is not offered to others.
 *
 * Candidates: status planned, missed or an earlier automatic match, same day or one day either side, duration
 * inside the fit range of the kind. Intensity (only with power and an FTP) never blocks: it adds a flag
 * ("easier", "harder") and breaks ties. The lowest score wins first (date penalty, duration distance,
 * intensity distance); ties go to the earlier session, then the earlier ride. Afterwards a ride in the same
 * week as a still-planned long ride, at least 0.75 of its length, with no other long ride done that week,
 * counts as that long ride ("done early"). Rides that fit nothing come back as `extraRides`.
 */
export function matchRides(
  sessions: readonly StoredSession[],
  rides: readonly AdaptRide[],
  today: IsoDate,
  options: { ftp?: number | null } = {},
): MatchResult {
  const ftp = options.ftp ?? null;
  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
  const matches: Match[] = [];
  const used = new Set<string>();
  const taken = new Set<string>();

  const windowStart = -LATE_IMPORT_DAYS;
  const inWindow = (session: StoredSession): boolean => {
    const offset = between(today, session.date);
    return offset >= windowStart && offset <= 1;
  };

  // Locked links, and links of sessions older than the window, are kept as they are.
  for (const session of sessions) {
    const locked = session.matchSource === "manual";
    if (session.activityId === null) continue;
    if (!locked && inWindow(session)) continue;
    const ride = ridesById.get(session.activityId);
    if (!ride || used.has(ride.id)) continue;
    used.add(ride.id);
    taken.add(session.id);
    matches.push(
      toMatch(session, ride, pairOf(session, ride, ftp), locked ? "manual" : "automatic"),
    );
  }

  const lockedIds = new Set(
    sessions.filter((s) => s.matchSource === "manual").map((session) => session.id),
  );

  // Stability: an automatic link that is still a legal pair stays (a better pair for a new ride never
  // displaces it), so re-evaluating never shuffles links around. Only broken links are matched again.
  for (const session of sessions) {
    if (session.activityId === null || taken.has(session.id) || lockedIds.has(session.id)) continue;
    if (session.status === "skipped" || !inWindow(session)) continue;
    const ride = ridesById.get(session.activityId);
    if (!ride || used.has(ride.id) || !legal(session, ride)) continue;
    used.add(ride.id);
    taken.add(session.id);
    matches.push(toMatch(session, ride, pairOf(session, ride, ftp), "automatic"));
  }
  const candidates = sessions.filter(
    (session) =>
      !lockedIds.has(session.id) &&
      !taken.has(session.id) &&
      session.status !== "skipped" &&
      inWindow(session),
  );
  const freeRides = rides.filter((ride) => !used.has(ride.id) && !isIgnoredRide(ride));

  type Candidate = { session: StoredSession; ride: AdaptRide; pair: Pair; score: number };
  const pairs: Candidate[] = [];
  for (const session of candidates) {
    const [low, high] = fitRange(session.kind);
    for (const ride of freeRides) {
      const apart = Math.abs(between(session.date, ride.date));
      if (apart > (session.kind === "event" ? 0 : 1)) continue;
      const pair = pairOf(session, ride, ftp);
      if (pair.ratio < low || pair.ratio > high) continue;
      const score =
        (apart === 0 ? 0 : DATE_PENALTY_ONE_DAY) +
        DURATION_WEIGHT * Math.abs(1 - pair.ratio) +
        pair.intensityPenalty;
      pairs.push({ session, ride, pair, score });
    }
  }
  pairs.sort(
    (a, b) =>
      a.score - b.score ||
      compareText(a.session.date, b.session.date) ||
      compareText(a.ride.date, b.ride.date) ||
      compareText(a.session.id, b.session.id) ||
      compareText(a.ride.id, b.ride.id),
  );
  for (const { session, ride, pair } of pairs) {
    if (taken.has(session.id) || used.has(ride.id)) continue;
    taken.add(session.id);
    used.add(ride.id);
    matches.push(toMatch(session, ride, pair, "automatic"));
  }

  // Long ride substitution: an unmatched ride counts as a still-planned long ride of its week.
  const unmatched = freeRides
    .filter((ride) => !used.has(ride.id))
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
  for (const ride of unmatched) {
    const week = mondayOf(ride.date);
    const sameWeek = sessions.filter((s) => mondayOf(s.date) === week && s.kind === "long");
    if (sameWeek.some((s) => taken.has(s.id))) continue;
    const target = sameWeek
      .filter(
        (s) =>
          s.status === "planned" &&
          s.activityId === null &&
          !lockedIds.has(s.id) &&
          s.date > ride.date &&
          s.durationMin > 0 &&
          ride.movingMinutes / s.durationMin >= LONG_SUBSTITUTION_MIN,
      )
      .sort((a, b) => compareText(a.date, b.date))[0];
    if (!target) continue;
    taken.add(target.id);
    used.add(ride.id);
    matches.push(toMatch(target, ride, pairOf(target, ride, ftp), "automatic"));
  }

  matches.sort(
    (a, b) => compareText(a.sessionDate, b.sessionDate) || compareText(a.rideId, b.rideId),
  );
  const extraRides = rides
    .filter((ride) => !used.has(ride.id) && !isIgnoredRide(ride))
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.id, b.id));
  return { matches, extraRides };
}
