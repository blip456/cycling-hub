import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchProfile, saveProfileSection, type Profile, type ProfilePatch } from "./api";
import { fetchReminderSettings, saveReminderSettings, type ReminderSettings } from "./reminder-api";

export const profileKeys = {
  all: ["profile"] as const,
  detail: (userId: string) => [...profileKeys.all, "detail", userId] as const,
  reminder: (userId: string) => [...profileKeys.all, "reminder", userId] as const,
};

function useUserId(): string {
  const { session } = useAuth();
  return session?.user.id ?? "";
}

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId !== "",
  });
}

function applyPatch(profile: Profile, patch: ProfilePatch): Profile {
  switch (patch.section) {
    case "about":
      return { ...profile, displayName: patch.displayName, birthYear: patch.birthYear };
    case "week":
      return { ...profile, availableDays: patch.availableDays };
    case "goal":
      return { ...profile, goal: patch.goal };
  }
}

/** Saves one profile section; the cache shows the saved values once the save succeeded. */
export function useSaveProfileSection() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => saveProfileSection(userId, patch),
    onSuccess: (_data, patch) => {
      queryClient.setQueryData<Profile>(profileKeys.detail(userId), (profile) =>
        profile ? applyPatch(profile, patch) : profile,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
  });
}

export function useReminderSettings() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.reminder(userId),
    queryFn: () => fetchReminderSettings(userId),
    enabled: userId !== "",
  });
}

/** Saves the reminder settings; the change shows at once and rolls back when the save fails. */
export function useSaveReminderSettings() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = profileKeys.reminder(userId);
  return useMutation({
    mutationFn: (settings: ReminderSettings) => saveReminderSettings(userId, settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReminderSettings>(key);
      queryClient.setQueryData<ReminderSettings>(key, settings);
      return { previous };
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["weight", "reminder", userId] });
      return queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
