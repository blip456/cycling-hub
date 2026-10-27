import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { EmptyState } from "@/components/ui";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import { dangerSolidButtonClass } from "@/features/rides/detail/danger-button";
import { RideDetail } from "@/features/rides/detail/RideDetail";
import { useRideDeletedCard } from "@/features/rides/detail/use-ride-deleted-card";
import { useDeleteRide, useRide } from "@/features/rides/hooks";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BackToRides() {
  return (
    <Link to="/rides" className={buttonClass("secondary")}>
      Back to rides
    </Link>
  );
}

function RideNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <EmptyState>This ride was not found. It may have been deleted.</EmptyState>
      <BackToRides />
    </div>
  );
}

function LoadedRideDetail({ id }: { id: string }) {
  const query = useRide(id);
  const ride = query.data;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const navigate = useNavigate();
  const deleteRide = useDeleteRide();
  const { showDeleted, showDeleteFailed } = useRideDeletedCard();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleting = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useStatusCard(
    "ride-detail-error",
    STATUS_PRIORITY.error,
    query.isError
      ? {
          tone: "error",
          message: "Couldn't load this ride. Check your connection.",
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void query.refetch();
              }}
            >
              Try again
            </button>
          ),
        }
      : null,
  );

  if (query.isPending) {
    return (
      <p role="status" className="text-muted">
        Loading…
      </p>
    );
  }
  if (query.isError) return <BackToRides />;
  if (!ride) return <RideNotFound />;

  const confirmDelete = () => {
    deleting.current = true;
    const target = { id: ride.id, name: ride.name };
    setConfirmOpen(false);
    // P15: removed at once (optimistic), with Undo in the status card; it comes back if the delete fails.
    showDeleted(target);
    deleteRide.mutateAsync(ride.id).catch(() => {
      showDeleteFailed(target);
    });
    void navigate("/rides");
  };

  return (
    <>
      <RideDetail
        ride={ride}
        desktop={desktop}
        onDelete={() => {
          triggerRef.current = document.activeElement as HTMLElement | null;
          setConfirmOpen(true);
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this ride?"
        onClose={() => {
          setConfirmOpen(false);
          if (!deleting.current) triggerRef.current?.focus();
        }}
        actions={
          <>
            <button
              type="button"
              className={`${dangerSolidButtonClass} w-full`}
              onClick={confirmDelete}
            >
              Delete ride
            </button>
            <button
              type="button"
              // The safe choice gets the focus when the dialog opens.
              data-autofocus
              className={buttonClass("secondary", "w-full")}
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              Cancel
            </button>
          </>
        }
      >
        {ride.name} is removed from your rides and skipped on later imports. You can undo this for a
        few seconds.
      </ConfirmDialog>
    </>
  );
}

/** B4: one ride (`/rides/:id`), with Delete ride (P15). */
export function RideDetailPage() {
  const { id = "" } = useParams();
  // An id that cannot be a ride is "not found" straight away (no request that would only fail).
  if (!UUID.test(id)) return <RideNotFound />;
  return <LoadedRideDetail key={id} id={id} />;
}
