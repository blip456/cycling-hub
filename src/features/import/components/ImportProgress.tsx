import { formatActivityCount, formatFileSize } from "../format";
import { CheckIcon, FileIcon } from "../icons";

export type ProgressStep =
  { step: "checking" } | { step: "saving"; total: number; skipped: number } | { step: "logging" };

/**
 * C2: checking the file, then saving it in one database call. The save is a single transaction, so
 * there is no partial progress to report: the bar is indeterminate.
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
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fill text-accent">
            <FileIcon />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="truncate font-semibold">{fileName}</b>
            <span className="text-[13px] text-muted tabular-nums">{formatFileSize(fileSize)}</span>
          </span>
        </div>

        {progress.step === "saving" ? (
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
            <ProgressBar label="Saving rides" />
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

function ProgressBar({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span>{label}</span>
      <div
        role="progressbar"
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-(--track)"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-accent" />
      </div>
    </div>
  );
}
