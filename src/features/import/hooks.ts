import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchImport, fetchImportHistory, importActivities, logNotImported } from "./api";

export const importKeys = {
  all: ["imports"] as const,
  history: () => [...importKeys.all, "history"] as const,
  detail: (id: string) => [...importKeys.all, "detail", id] as const,
};

export function useImportHistory() {
  return useQuery({ queryKey: importKeys.history(), queryFn: fetchImportHistory });
}

export function useImportRecord(id: string) {
  return useQuery({ queryKey: importKeys.detail(id), queryFn: () => fetchImport(id) });
}

/** Saves a checked file. Refreshes the history afterwards. */
export function useImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importActivities,
    onSettled: () => queryClient.invalidateQueries({ queryKey: importKeys.all }),
  });
}

/** Logs a file that is not a valid export as "Not imported" (P33). */
export function useLogNotImportedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logNotImported,
    onSettled: () => queryClient.invalidateQueries({ queryKey: importKeys.all }),
  });
}
