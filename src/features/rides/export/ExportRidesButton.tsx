import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { ConfirmDialog } from "../detail/ConfirmDialog";
import { DownloadIcon } from "../detail/icons";
import { exportRides, type ExportFormat } from "./export-rides";

const SUCCESS_MS = 6000;

/**
 * Export rides (P37): a secondary button that asks for the format, then downloads every visible ride
 * as CSV (for spreadsheets) or JSON (the extension's format, re-importable). The result shows as a
 * status card (P12, P31). Placed by the ride list in its header area.
 */
export function ExportRidesButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ format: ExportFormat; count: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mutation = useMutation({
    mutationFn: (format: ExportFormat) => exportRides(format),
    onMutate: () => {
      setDone(null);
    },
    onSuccess: (count, format) => {
      setDone({ format, count });
    },
  });

  // The success card goes away by itself after a few seconds.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      setDone(null);
    }, SUCCESS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [done]);

  const failedFormat = mutation.isError ? mutation.variables : undefined;
  useStatusCard(
    "rides-export",
    failedFormat ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    failedFormat
      ? {
          tone: "error",
          message: "Couldn't export your rides. Check your connection.",
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                mutation.mutate(failedFormat);
              }}
            >
              Try again
            </button>
          ),
          onDismiss: () => {
            mutation.reset();
          },
        }
      : done
        ? {
            tone: done.count > 0 ? "success" : "info",
            message:
              done.count === 0
                ? "No rides to export yet."
                : `Exported ${done.count} ${done.count === 1 ? "ride" : "rides"} as ${done.format.toUpperCase()}.`,
            onDismiss: () => {
              setDone(null);
            },
          }
        : null,
  );

  const choose = (format: ExportFormat) => {
    setOpen(false);
    mutation.mutate(format);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass("secondary", className)}
        aria-haspopup="dialog"
        disabled={mutation.isPending}
        onClick={() => {
          setOpen(true);
        }}
      >
        <DownloadIcon />
        {mutation.isPending ? "Exporting…" : "Export"}
      </button>
      <ConfirmDialog
        open={open}
        title="Export rides"
        onClose={() => {
          setOpen(false);
          buttonRef.current?.focus();
        }}
        actions={
          <>
            <button
              type="button"
              data-autofocus
              className={buttonClass("primary", "w-full")}
              onClick={() => {
                choose("csv");
              }}
            >
              Download CSV
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "w-full")}
              onClick={() => {
                choose("json");
              }}
            >
              Download JSON
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "w-full")}
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </>
        }
      >
        All your rides, not the ones you deleted. CSV opens in a spreadsheet; JSON keeps the
        original activities and can be imported again.
      </ConfirmDialog>
    </>
  );
}
