import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeEntry, upsertEntry, type WeightEntry } from "@/features/athlete";
import { useAuth } from "@/lib/auth/auth-context";
import {
  deleteWeightEntry,
  fetchReminderSettings,
  fetchWeightEntries,
  saveWeightEntry,
} from "./api";

export const weightKeys = {
  all: ["weight"] as const,
  entries: () => [...weightKeys.all, "entries"] as const,
  reminder: (userId: string) => [...weightKeys.all, "reminder", userId] as const,
};

/** All weigh-ins, oldest first. Shared by the Log tab, the Trend tab and the reminder card. */
export function useWeightEntries() {
  return useQuery({ queryKey: weightKeys.entries(), queryFn: fetchWeightEntries });
}

/** The profile's reminder day and switch. */
export function useReminderSettings() {
  const userId = useAuth().session?.user.id ?? "";
  return useQuery({
    queryKey: weightKeys.reminder(userId),
    queryFn: () => fetchReminderSettings(userId),
    enabled: userId !== "",
  });
}

/**
 * Saves an entry. `replaces` is the date of the entry being edited when its date was changed: that
 * entry moves, so it is removed after the new one is saved.
 */
export function useSaveWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entry,
      replaces,
    }: {
      entry: WeightEntry;
      replaces?: string | undefined;
    }) => {
      await saveWeightEntry(entry);
      if (replaces && replaces !== entry.date) await deleteWeightEntry(replaces);
    },
    onSuccess: (_data, { entry, replaces }) => {
      queryClient.setQueryData<WeightEntry[]>(weightKeys.entries(), (entries) => {
        const base =
          replaces && replaces !== entry.date
            ? removeEntry(entries ?? [], replaces)
            : (entries ?? []);
        return upsertEntry(base, entry);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weightKeys.entries() }),
  });
}

/** Deletes an entry; the row leaves the list at once and comes back if the delete fails. */
export function useDeleteWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWeightEntry,
    onMutate: async (date: string) => {
      await queryClient.cancelQueries({ queryKey: weightKeys.entries() });
      const previous = queryClient.getQueryData<WeightEntry[]>(weightKeys.entries());
      queryClient.setQueryData<WeightEntry[]>(weightKeys.entries(), (entries) =>
        removeEntry(entries ?? [], date),
      );
      return { previous };
    },
    onError: (_error, _date, context) => {
      if (context?.previous) queryClient.setQueryData(weightKeys.entries(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weightKeys.entries() }),
  });
}
