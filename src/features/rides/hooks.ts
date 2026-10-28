import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { importKeys } from "@/features/import/hooks";
import { deleteRide, fetchRide, fetchRides, restoreRide, type Ride } from "./api";

export const rideKeys = {
  all: ["rides"] as const,
  list: () => [...rideKeys.all, "list"] as const,
  detail: (id: string) => [...rideKeys.all, "detail", id] as const,
};

export function useRides() {
  return useQuery({ queryKey: rideKeys.list(), queryFn: fetchRides });
}

export function useRide(id: string) {
  return useQuery({ queryKey: rideKeys.detail(id), queryFn: () => fetchRide(id) });
}

/** Deletes a ride; it leaves the list at once and comes back if the delete fails. */
export function useDeleteRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRide,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: rideKeys.list() });
      const previous = queryClient.getQueryData<Ride[]>(rideKeys.list());
      queryClient.setQueryData<Ride[]>(rideKeys.list(), (rides) =>
        rides?.filter((ride) => ride.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(rideKeys.list(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: rideKeys.all }),
  });
}

/** Undo of a delete. Also refreshes the import data (a restored ride is no longer "Deleted earlier"). */
export function useRestoreRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreRide,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: rideKeys.all });
      await queryClient.invalidateQueries({ queryKey: importKeys.all });
    },
  });
}
