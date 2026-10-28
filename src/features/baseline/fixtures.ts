import type { Database } from "@/lib/supabase/database.types";
import type { SourceRide, TestSession, TestWeekWithSessions } from "./api";
import type { BaselineEntry } from "./model";
import { PROTOCOLS, type Protocol } from "./protocols";

type CurrentRow = Database["public"]["Views"]["current_baseline"]["Row"];

/** Test data for the baseline tests. */
export function makeEntry(overrides: Partial<BaselineEntry> & { id: string }): BaselineEntry {
  return {
    effective_date: "2026-10-11",
    ftp_w: null,
    max_hr: null,
    resting_hr: null,
    lthr: null,
    source: "manual",
    source_activity_id: null,
    note: null,
    created_at: "2026-10-11T10:00:00Z",
    ...overrides,
  };
}

export const HISTORY: BaselineEntry[] = [
  makeEntry({
    id: "e4",
    effective_date: "2026-10-11",
    ftp_w: 250,
    source: "stream_estimate",
    source_activity_id: "ride-1",
    note: "Best 20 minutes",
  }),
  makeEntry({
    id: "e3",
    effective_date: "2026-06-06",
    ftp_w: 240,
    max_hr: 186,
    source: "test_20min",
  }),
  makeEntry({ id: "e2", effective_date: "2026-03-07", ftp_w: 228 }),
  makeEntry({ id: "e1", effective_date: "2026-01-10", ftp_w: 215, note: "First value" }),
];

/** The view row for HISTORY plus a typed max HR of 188 on 6 Jun. */
export const VIEW: CurrentRow = {
  user_id: "u",
  ftp_w: 250,
  ftp_effective_date: "2026-10-11",
  max_hr: 186,
  max_hr_effective_date: "2026-06-06",
  lthr: null,
  lthr_effective_date: null,
  resting_hr: null,
  resting_hr_effective_date: null,
};

export function makeSourceRide(overrides: Partial<SourceRide> = {}): SourceRide {
  return {
    id: "ride-1",
    strava_id: 111,
    name: "Sunday Long Ride",
    start_local: "2026-10-25T08:30:00",
    distance_m: 64_200,
    moving_time_s: 7500,
    ...overrides,
  };
}

export function makeWeek(
  protocol: Protocol,
  overrides: Partial<TestSession>[] = [],
): TestWeekWithSessions {
  return {
    week: { id: "week-1", protocol, status: "planned", created_at: "2026-10-28T10:00:00Z" },
    protocol,
    sessions: PROTOCOLS[protocol].sessions.map((s, i) => ({
      id: `session-${String(s.position)}`,
      week_id: "week-1",
      position: s.position,
      kind: s.kind,
      scheduled_on: null,
      completed_at: null,
      result_avg_power_w: null,
      result_ftp_w: null,
      notes: null,
      ...overrides[i],
    })),
  };
}

/** One point per second of constant power and heart rate. */
export function rideFile(seconds: number, watts: number | null, heartrate: number | null = null) {
  return {
    time: Array.from({ length: seconds }, (_, i) => i),
    watts: Array.from({ length: seconds }, () => watts),
    heartrate: Array.from({ length: seconds }, () => heartrate),
  };
}
