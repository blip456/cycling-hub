import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addDays,
  best20MinPower,
  bestAveragePower,
  lthrFrom20MinTest,
  readChannel,
  type FtpEstimate,
  type HeartRateSuggestion,
  type IsoDate,
} from "@/features/athlete";
import {
  addBaselineEntry,
  createTestWeek,
  downloadRideStreams,
  fetchActiveTestWeek,
  fetchBaselineEntries,
  fetchCurrentBaseline,
  fetchHeartRateRides,
  fetchPowerRideOnDay,
  fetchPowerRides,
  fetchSourceRide,
  setTestWeekStatus,
  toStreamRide,
  updateTestSession,
  type SessionPatch,
  type SourceRide,
  type TestWeekWithSessions,
} from "./api";
import { currentBaseline, type CurrentBaseline } from "./model";
import type { Protocol } from "./protocols";
import { MAX_RIDES, scanFtp, scanHeartRate, type LoadProgress } from "./stream-source";

export const baselineKeys = {
  all: ["baseline"] as const,
  current: () => [...baselineKeys.all, "current"] as const,
  entries: () => [...baselineKeys.all, "entries"] as const,
  powerRides: () => [...baselineKeys.all, "power-rides"] as const,
  ftpScan: () => [...baselineKeys.all, "scan", "ftp"] as const,
  hrScan: () => [...baselineKeys.all, "scan", "hr"] as const,
  testWeek: () => [...baselineKeys.all, "test-week"] as const,
  sessionRide: (day: string, protocol: Protocol) =>
    [...baselineKeys.all, "session-ride", day, protocol] as const,
  ride: (id: string) => [...baselineKeys.all, "ride", id] as const,
};

/** The history rows, newest first. */
export function useBaselineEntries() {
  return useQuery({ queryKey: baselineKeys.entries(), queryFn: fetchBaselineEntries });
}

/** The current baseline (view) with the source of each value (from the history). */
export function useBaseline(): {
  baseline: CurrentBaseline | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const view = useQuery({ queryKey: baselineKeys.current(), queryFn: fetchCurrentBaseline });
  const entries = useBaselineEntries();
  const baseline = useMemo(
    () =>
      view.data !== undefined && entries.data
        ? currentBaseline(view.data, entries.data)
        : undefined,
    [view.data, entries.data],
  );
  return {
    baseline,
    isPending: view.isPending || entries.isPending,
    isError: view.isError || entries.isError,
    refetch: () => {
      void view.refetch();
      void entries.refetch();
    },
  };
}

/** Saves one baseline row and refreshes everything that shows the baseline. */
export function useAddBaseline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addBaselineEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baselineKeys.all }),
  });
}

/** Whether any ride has power data (for the empty state). */
export function useHasPowerRides() {
  return useQuery({
    queryKey: baselineKeys.powerRides(),
    queryFn: async () => (await fetchPowerRides(1)).length > 0,
  });
}

/** One ride by id, for "found in this ride". */
export function useSourceRide(id: string | null) {
  return useQuery({
    queryKey: baselineKeys.ride(id ?? ""),
    queryFn: () => (id ? fetchSourceRide(id) : Promise.resolve(null)),
    enabled: id !== null,
  });
}

// ---- stream scans --------------------------------------------------------------------------------

export type FtpScan = {
  estimate: FtpEstimate | null;
  ride: SourceRide | null;
  /** Rides with power data that were looked at (at most 60). */
  looked: number;
  /** Rides whose file could not be read. */
  failed: number;
  /** Oldest and newest of the rides that were looked at. */
  from: IsoDate | null;
  to: IsoDate | null;
};

const SCAN_STALE_MS = 10 * 60_000;

/**
 * Reads the newest rides with power (stream by stream, newest first) and finds the best 20 minutes (P41, P54).
 * `progress` is null until reading starts. A result is kept for ten minutes, so coming back does not read the
 * files again. All files failing is an error; some failing gives a suggestion from the rest with a count.
 */
export function useFtpScan() {
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const query = useQuery({
    queryKey: baselineKeys.ftpScan(),
    staleTime: SCAN_STALE_MS,
    queryFn: async ({ signal }): Promise<FtpScan> => {
      setProgress(null);
      const rides = await fetchPowerRides(MAX_RIDES);
      const dates = rides.map((r) => r.start_local.slice(0, 10)).sort();
      const span = { from: dates[0] ?? null, to: dates.at(-1) ?? null };
      if (rides.length === 0) {
        return { estimate: null, ride: null, looked: 0, failed: 0, ...span };
      }
      const scan = await scanFtp(rides.map(toStreamRide), {
        download: downloadRideStreams,
        signal,
        onProgress: setProgress,
      });
      if (scan.failed === scan.checked) throw new Error("No ride file could be read");
      const estimate = scan.result;
      return {
        estimate,
        ride: estimate ? (rides.find((r) => r.id === estimate.rideId) ?? null) : null,
        looked: scan.checked,
        failed: scan.failed,
        ...span,
      };
    },
  });
  return { ...query, progress };
}

export type HeartRateScan = {
  suggestion: HeartRateSuggestion | null;
  ride: SourceRide | null;
  failed: number;
};

/** The highest sustained heart rate in the newest rides with heart rate data (P42). */
export function useHeartRateScan(enabled: boolean) {
  return useQuery({
    queryKey: baselineKeys.hrScan(),
    staleTime: SCAN_STALE_MS,
    enabled,
    queryFn: async ({ signal }): Promise<HeartRateScan> => {
      const rides = await fetchHeartRateRides(MAX_RIDES);
      if (rides.length === 0) return { suggestion: null, ride: null, failed: 0 };
      const scan = await scanHeartRate(rides.map(toStreamRide), {
        download: downloadRideStreams,
        signal,
      });
      if (scan.failed === scan.checked) throw new Error("No ride file could be read");
      const suggestion = scan.result;
      return {
        suggestion,
        ride: suggestion ? (rides.find((r) => r.id === suggestion.rideId) ?? null) : null,
        failed: scan.failed,
      };
    },
  });
}

// ---- test week -----------------------------------------------------------------------------------

export function useActiveTestWeek() {
  return useQuery({ queryKey: baselineKeys.testWeek(), queryFn: fetchActiveTestWeek });
}

export function useCreateTestWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTestWeek,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baselineKeys.testWeek() }),
  });
}

/** Changes one session. The new value shows at once and comes back when the save fails. */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SessionPatch }) =>
      updateTestSession(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: baselineKeys.testWeek() });
      const previous = queryClient.getQueryData<TestWeekWithSessions | null>(
        baselineKeys.testWeek(),
      );
      if (previous) {
        queryClient.setQueryData<TestWeekWithSessions>(baselineKeys.testWeek(), {
          ...previous,
          sessions: previous.sessions.map((s) => {
            if (s.id !== id) return s;
            return {
              ...s,
              ...(patch.scheduled_on !== undefined ? { scheduled_on: patch.scheduled_on } : {}),
              ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
              ...(patch.result_avg_power_w !== undefined
                ? { result_avg_power_w: patch.result_avg_power_w }
                : {}),
              ...(patch.result_ftp_w !== undefined ? { result_ftp_w: patch.result_ftp_w } : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(baselineKeys.testWeek(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: baselineKeys.testWeek() }),
  });
}

export function useSetWeekStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Parameters<typeof setTestWeekStatus>[1] }) =>
      setTestWeekStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baselineKeys.testWeek() }),
  });
}

/** A ride found on the session's day, with its best effort read from its stream. */
export type SessionRide = {
  ride: SourceRide;
  /** Best 20 minutes (20-minute test) or best minute (ramp) in W; null when the stream cannot be read. */
  bestW: number | null;
  /** Average heart rate of the last 15 minutes of that best 20 minutes (LTHR), when the stream allows. */
  lthr: number | null;
};

/** Looks for a ride with power on `day` and reads its best effort for the protocol (T13). */
export function useSessionRide(day: IsoDate | null, protocol: Protocol) {
  return useQuery({
    queryKey: baselineKeys.sessionRide(day ?? "", protocol),
    enabled: day !== null,
    queryFn: async (): Promise<SessionRide | null> => {
      if (day === null) return null;
      const ride = await fetchPowerRideOnDay(day, addDays(day, 1) ?? day);
      if (!ride) return null;
      let bestW: number | null = null;
      let lthr: number | null = null;
      try {
        const streams = await downloadRideStreams({ stravaId: ride.strava_id });
        const power = readChannel(streams, "watts");
        if (protocol === "ramp") {
          bestW = bestAveragePower(power, 60)?.watts ?? null;
        } else {
          const best = best20MinPower(power);
          bestW = best?.watts ?? null;
          lthr = best
            ? lthrFrom20MinTest(readChannel(streams, "heartrate"), best.startOffsetS)
            : null;
        }
      } catch {
        bestW = null;
      }
      return { ride, bestW, lthr };
    },
  });
}
