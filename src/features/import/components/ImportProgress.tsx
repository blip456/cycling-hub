import { formatActivityCount, formatFileSize } from "../format";
import { CheckIcon, FileIcon } from "../icons";

export type ProgressStep =
  | { step: "checking" }
  | { step: "saving"; total: number; skipped: number }
  | { step: "streams"; total: number; skipped: number; done: number; uploads: number | null }
  | { step: "logging" };

/**
 * C2: checking the file, then saving it in one database call. The save is a single transaction, so
 * there is no partial progress to report: the bar is indeterminate. Files with per-second data (export
 * v2, T12) then save it ride by ride: "Saving ride data: 12 of 180", with a determinate bar.
 */
export function ImportProgress({
  fileName,
  fileSize,
  progress,
}: {
  fileName: string;
  fileSize: number;
  progress: ProgressStep;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-fill text-accent">
            <FileIcon />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="truncate font-semibold">{fileName}</b>
            <span className="text-[13px] text-muted tabular-nums">{formatFileSize(fileSize)}</span>
          </span>
        </div>

        {progress.step === "saving" || progress.step === "streams" ? (
          <>
            <div className="flex items-start gap-3 text-positive">
              <CheckIcon className="mt-0.5 shrink-0" />
              <span className="flex flex-col">
                <span className="text-text">File checked</span>
                <span className="text-[13px] text-muted tabular-nums">
                  {formatActivityCount(progress.total)}
                  {progress.skipped ? ` · ${progress.skipped} will be skipped` : ""}
                </span>
              </span>
            </div>
            {progress.step === "saving" ? (
              <ProgressBar label="Saving rides" />
            ) : (
              <>
                <div className="flex items-start gap-3 text-positive">
                  <CheckIcon className="mt-0.5 shrink-0" />
                  <span className="text-text">Rides saved</span>
                </div>
                <ProgressBar
                  label="Saving ride data"
                  {...(progress.uploads === null
                    ? {}
                    : { value: progress.done, max: progress.uploads })}
                />
              </>
            )}
          </>
        ) : (
          <ProgressBar label={progress.step === "checking" ? "Checking the file" : "Saving"} />
        )}
      </div>
      <p className="px-0.5 text-[13px] text-muted">
        Keep this screen open until the import is finished.
      </p>
    </div>
  );
}

/** Indeterminate without `value`; with `value` and `max` it shows "label: value of max". */
function ProgressBar({ label, value, max }: { label: string; value?: number; max?: number }) {
  const determinate = value !== undefined && max !== undefined && max > 0;
  const text = determinate ? `${label}: ${value} of ${max}` : label;
  return (
    <div className="flex flex-col gap-2">
      {/* The step is announced as it changes (polite, so it does not interrupt). */}
      <span aria-live="polite" className="tabular-nums">
        {text}
      </span>
      <div
        role="progressbar"
        aria-label={label}
        {...(determinate
          ? { "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": value }
          : {})}
        className="h-2 overflow-hidden rounded-full bg-(--track)"
      >
        {determinate ? (
          <div
            // A new element, so the width does not animate down from the indeterminate bar.
            key="determinate"
            className="h-full rounded-full bg-accent motion-safe:transition-[width]"
            style={{ width: `${Math.round((value / max) * 100)}%` }}
          />
        ) : (
          <div className="h-full w-full rounded-full bg-accent motion-safe:animate-pulse" />
        )}
      </div>
    </div>
  );
}
