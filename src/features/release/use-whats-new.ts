import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchLastSeenVersion, saveLastSeenVersion } from "./profile-api";
import { APP_VERSION, isNewerThanSeen } from "./version";

export const lastSeenVersionKey = (userId: string) =>
  ["profile", userId, "last_seen_version"] as const;

/** profiles.last_seen_version of the signed-in user. Refetched on focus so another device's "seen" counts. */
export function useLastSeenVersion() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: lastSeenVersionKey(userId ?? ""),
    queryFn: () => fetchLastSeenVersion(userId ?? ""),
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
  });
}

/** Stores a version as seen, optimistically: the card disappears at once and returns if saving fails. */
export function useMarkVersionSeen() {
  const userId = useAuth().session?.user.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = lastSeenVersionKey(userId);
  return useMutation({
    mutationFn: (version: string) => saveLastSeenVersion(userId, version),
    onMutate: async (version: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string | null>(queryKey);
      queryClient.setQueryData<string | null>(queryKey, version);
      return { previous };
    },
    onError: (_error, _version, context) => {
      if (context) queryClient.setQueryData<string | null>(queryKey, context.previous ?? null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export type WhatsNewState =
  /** Not known yet (loading, signed out or the request failed): show nothing. */
  | "unknown"
  /** The running version is newer than the one last seen: show the card once. */
  | "updated"
  | "seen";

/**
 * B1d: the What's new card shows once after the app version changes compared to
 * profiles.last_seen_version. On the first sign-in (null) the running version counts as seen, so a new
 * user is not greeted with a changelog. Dismissing the card or opening What's new stores the version.
 */
export function useWhatsNew(currentVersion: string = APP_VERSION) {
  const query = useLastSeenVersion();
  const { mutate } = useMarkVersionSeen();
  const lastSeen = query.data;

  let state: WhatsNewState = "unknown";
  if (query.isSuccess) {
    state = lastSeen && isNewerThanSeen(currentVersion, lastSeen) ? "updated" : "seen";
  }
  const firstRun = query.isSuccess && lastSeen === null;

  // First sign-in: record the running version once (not again after a failed save).
  const recorded = useRef(false);
  useEffect(() => {
    if (firstRun && !recorded.current) {
      recorded.current = true;
      mutate(currentVersion);
    }
  }, [firstRun, currentVersion, mutate]);

  const markSeen = useCallback(() => {
    if (state === "updated") mutate(currentVersion);
  }, [state, currentVersion, mutate]);

  return { state, lastSeen: lastSeen ?? null, isLoading: query.isPending, markSeen };
}
