import type { IsoDate } from "@/features/athlete";
import { STREAMS_BUCKET } from "@/features/import/api";
import { streamsObjectName } from "@/features/import/streams";
import { getSupabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { ENTRY_COLUMNS, type BaselineEntry, type BaselineSource } from "./model";
import type { Protocol, SessionKind } from "./protocols";
import { parseStreamsFile, type StreamRide } from "./stream-source";

type CurrentRow = Database["public"]["Views"]["current_baseline"]["Row"];
type WeekRow = Database["public"]["Tables"]["test_weeks"]["Row"];
type SessionRow = Database["public"]["Tables"]["test_sessions"]["Row"];

// ---- baseline ------------------------------------------------------------------------------------

/** The current baseline view: one row (the newest value per metric), or null before anything was saved. */
export async function fetchCurrentBaseline(): Promise<CurrentRow | null> {
  const { data, error } = await getSupabase().from("current_baseline").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Every baseline row, newest first. The table is append-only, so this is the whole history. */
export async function fetchBaselineEntries(): Promise<BaselineEntry[]> {
  const { data, error } = await getSupabase()
    .from("baseline_entries")
    .select(ENTRY_COLUMNS)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<BaselineEntry[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

export type NewBaselineEntry = {
  effectiveDate: IsoDate;
  ftp: number | null;
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
  source: BaselineSource;
  sourceActivityId?: string | null;
  note?: string | null;
};

/** Adds one history row. Rows are never updated (a correction is a new row). */
export async function addBaselineEntry(entry: NewBaselineEntry): Promise<void> {
  const { error } = await getSupabase()
    .from("baseline_entries")
    .insert({
      effective_date: entry.effectiveDate,
      ftp_w: entry.ftp,
      max_hr: entry.maxHr,
      resting_hr: entry.restingHr,
      lthr: entry.lthr,
      source: entry.source,
      source_activity_id: entry.sourceActivityId ?? null,
      note: entry.note ?? null,
    });
  if (error) throw new Error(error.message);
}

// ---- rides and their streams ----------------------------------------------------------------------

/** What the screens show about a ride a suggestion came from. */
export type SourceRide = {
  id: string;
  strava_id: number;
  name: string;
  start_local: string;
  distance_m: number;
  moving_time_s: number;
};

const SOURCE_RIDE_COLUMNS = "id, strava_id, name, start_local, distance_m, moving_time_s";

/** The newest rides with power data (P54: at most 60), newest first. */
export async function fetchPowerRides(limit: number): Promise<SourceRide[]> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(SOURCE_RIDE_COLUMNS)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .not("average_watts", "is", null)
    .order("start_at", { ascending: false })
    .limit(limit)
    .overrideTypes<SourceRide[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/** The newest rides with heart rate data, newest first. */
export async function fetchHeartRateRides(limit: number): Promise<SourceRide[]> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(SOURCE_RIDE_COLUMNS)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .not("average_heartrate", "is", null)
    .order("start_at", { ascending: false })
    .limit(limit)
    .overrideTypes<SourceRide[], { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/** One ride by id, or null (also when it was deleted). */
export async function fetchSourceRide(id: string): Promise<SourceRide | null> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(SOURCE_RIDE_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
    .overrideTypes<SourceRide | null, { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

/** The longest ride with power on a day (Brussels `start_local` date), for the test result. */
export async function fetchPowerRideOnDay(
  day: IsoDate,
  nextDay: IsoDate,
): Promise<SourceRide | null> {
  const { data, error } = await getSupabase()
    .from("activities")
    .select(SOURCE_RIDE_COLUMNS)
    .eq("is_ride", true)
    .is("deleted_at", null)
    .not("average_watts", "is", null)
    .gte("start_local", `${day}T00:00:00`)
    .lt("start_local", `${nextDay}T00:00:00`)
    .order("moving_time_s", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<SourceRide | null, { merge: false }>();
  if (error) throw new Error(error.message);
  return data;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new Error(error?.message ?? "Not signed in");
  return id;
}

/** Storage answers 400 or 404 "Object not found" for a ride without a stored file. */
function isMissingFile(error: { message: string; status?: number; statusCode?: string }): boolean {
  return error.status === 404 || error.statusCode === "404" || /not.found/i.test(error.message);
}

/**
 * Downloads one ride's gzipped streams from the private `streams` bucket (`{auth.uid()}/{strava_id}.json.gz`,
 * T13) and decompresses them in the browser. Null when the ride has no stored file.
 */
export async function downloadRideStreams(ride: Pick<StreamRide, "stravaId">): Promise<unknown> {
  const name = streamsObjectName(await currentUserId(), ride.stravaId);
  const { data, error } = await getSupabase().storage.from(STREAMS_BUCKET).download(name);
  if (error) {
    if (isMissingFile(error as { message: string; status?: number; statusCode?: string })) {
      return null;
    }
    throw new Error(error.message);
  }
  return parseStreamsFile(data);
}

export function toStreamRide(ride: Pick<SourceRide, "id" | "strava_id">): StreamRide {
  return { id: ride.id, stravaId: ride.strava_id };
}

// ---- test weeks -----------------------------------------------------------------------------------

export type TestWeek = Pick<WeekRow, "id" | "protocol" | "status" | "created_at">;
export type TestSession = Pick<
  SessionRow,
  | "id"
  | "week_id"
  | "position"
  | "kind"
  | "scheduled_on"
  | "completed_at"
  | "result_avg_power_w"
  | "result_ftp_w"
  | "notes"
>;

export type TestWeekWithSessions = { week: TestWeek; protocol: Protocol; sessions: TestSession[] };

const WEEK_COLUMNS = "id, protocol, status, created_at";
const SESSION_COLUMNS =
  "id, week_id, position, kind, scheduled_on, completed_at, result_avg_power_w, result_ftp_w, notes";

/** The test week in progress (planned or in progress), newest first, with its sessions in order; or null. */
export async function fetchActiveTestWeek(): Promise<TestWeekWithSessions | null> {
  const { data: week, error } = await getSupabase()
    .from("test_weeks")
    .select(WEEK_COLUMNS)
    .in("status", ["planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<TestWeek | null, { merge: false }>();
  if (error) throw new Error(error.message);
  if (!week) return null;
  const { data: sessions, error: sessionsError } = await getSupabase()
    .from("test_sessions")
    .select(SESSION_COLUMNS)
    .eq("week_id", week.id)
    .order("position", { ascending: true })
    .overrideTypes<TestSession[], { merge: false }>();
  if (sessionsError) throw new Error(sessionsError.message);
  return { week, protocol: week.protocol === "ramp" ? "ramp" : "20min", sessions };
}

export type NewTestWeek = {
  protocol: Protocol;
  sessions: { position: number; kind: SessionKind; scheduledOn: IsoDate | null }[];
};

/** Creates a test week and its sessions (position 1 to n). A week whose sessions failed to save is removed again. */
export async function createTestWeek(input: NewTestWeek): Promise<string> {
  const { data: week, error } = await getSupabase()
    .from("test_weeks")
    .insert({ protocol: input.protocol })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: sessionsError } = await getSupabase()
    .from("test_sessions")
    .insert(
      input.sessions.map((s) => ({
        week_id: week.id,
        position: s.position,
        kind: s.kind,
        scheduled_on: s.scheduledOn,
      })),
    );
  if (sessionsError) {
    await getSupabase().from("test_weeks").delete().eq("id", week.id);
    throw new Error(sessionsError.message);
  }
  return week.id;
}

export type SessionPatch = Partial<
  Pick<
    Database["public"]["Tables"]["test_sessions"]["Update"],
    "scheduled_on" | "completed_at" | "result_avg_power_w" | "result_ftp_w" | "notes"
  >
>;

export async function updateTestSession(id: string, patch: SessionPatch): Promise<void> {
  const { error } = await getSupabase().from("test_sessions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setTestWeekStatus(
  id: string,
  status: "planned" | "in_progress" | "completed" | "cancelled",
): Promise<void> {
  const { error } = await getSupabase().from("test_weeks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
