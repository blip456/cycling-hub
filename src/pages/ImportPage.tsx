import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import {
  fetchStreamsState,
  markStreamsSaved,
  uploadRideStreams,
  type ImportRecord,
} from "@/features/import/api";
import { FilePicker } from "@/features/import/components/FilePicker";
import { ACCEPT, takeFile } from "@/features/import/file-input";
import { LastImportLink } from "@/features/import/components/ImportHistory";
import { ImportProgress, type ProgressStep } from "@/features/import/components/ImportProgress";
import { ImportRejected } from "@/features/import/components/ImportRejected";
import { ImportSummary } from "@/features/import/components/ImportSummary";
import { formatFileSize } from "@/features/import/format";
import {
  useImportHistory,
  useImportMutation,
  useLogNotImportedMutation,
} from "@/features/import/hooks";
import { CopyIcon } from "@/features/import/icons";
import {
  parseExport,
  rejectTooLarge,
  type ActivityStreams,
  type FileRejection,
  type ParseResult,
} from "@/features/import/parse";
import { isRideSportType } from "@/features/import/sport-types";
import { gzipText } from "@/features/import/streams";
import { saveRideStreams, type StreamsDeps } from "@/features/import/streams-upload";
import { useFileDrop } from "@/features/import/use-file-drop";

type FileInfo = { fileName: string; fileSize: number };

/** What happened to the per-second ride data of the imported file (T12). */
type StreamsOutcome = {
  /** Rides whose ride data is stored (uploaded now or already the same). */
  saved: number;
  /** Rides whose streams did not match the contract (the ride itself was imported). */
  dropped: number;
  /** Still in memory, so "Try again" can upload them without importing the file again. */
  failed: ActivityStreams[];
  retrying: boolean;
  dismissed: boolean;
};

type Phase =
  | { kind: "idle" }
  | ({ kind: "working"; progress: ProgressStep } & FileInfo)
  | { kind: "done"; record: ImportRecord; streams: StreamsOutcome | null }
  | ({ kind: "rejected"; rejection: FileRejection } & FileInfo);

type Notice = { text: string; retry?: File };

const streamsDeps: StreamsDeps = {
  fetchState: fetchStreamsState,
  upload: uploadRideStreams,
  markSaved: markStreamsSaved,
  gzip: (text) => gzipText(text),
};

/** Lets the browser paint the current step before a long synchronous task (parsing a big file). */
const nextPaint = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const rides = (n: number) => `${n} ${n === 1 ? "ride" : "rides"}`;

function streamsNote(outcome: StreamsOutcome | null): string | null {
  if (!outcome) return null;
  const parts = [];
  if (outcome.retrying) parts.push("Saving ride data…");
  else if (outcome.saved > 0) parts.push(`Ride data saved for ${rides(outcome.saved)}.`);
  if (outcome.dropped > 0) {
    parts.push(`${rides(outcome.dropped)} had unreadable ride data.`);
  }
  return parts.length ? parts.join(" ") : null;
}

async function readAndParse(file: File): Promise<ParseResult> {
  const tooLarge = rejectTooLarge(file.size);
  if (tooLarge) return { ok: false, ...tooLarge };
  try {
    const text = await file.text();
    await nextPaint();
    return parseExport(text);
  } catch (error) {
    return {
      ok: false,
      message: "This file could not be read.",
      detail: error instanceof Error ? error.message : null,
    };
  }
}

function errorDetails(info: FileInfo, rejection: FileRejection): string {
  return [
    "Cycling Hub import",
    `File: ${info.fileName} (${formatFileSize(info.fileSize)})`,
    "Result: not imported, nothing was changed",
    `Reason: ${rejection.message}`,
    rejection.detail ? `Detail: ${rejection.detail}` : null,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** C1–C4 and X2: choose or drop an export file, check it, save it, show the outcome. */
export function ImportPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const busy = useRef(false);
  const anotherFileInput = useRef<HTMLInputElement>(null);
  const history = useImportHistory();
  const importMutation = useImportMutation();
  const logMutation = useLogNotImportedMutation();

  const handleFile = async (file: File) => {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    const info: FileInfo = { fileName: file.name, fileSize: file.size };
    try {
      setPhase({ kind: "working", ...info, progress: { step: "checking" } });
      const result = await readAndParse(file);

      if (!result.ok) {
        // P33: the attempt goes into the history; nothing else changes.
        setPhase({ kind: "working", ...info, progress: { step: "logging" } });
        const rejection: FileRejection = { message: result.message, detail: result.detail };
        try {
          await logMutation.mutateAsync({ fileName: file.name, reason: result.message });
        } catch {
          // The history row is best effort; the file was not imported either way.
        }
        setPhase({ kind: "rejected", ...info, rejection });
        return;
      }

      const counts = { total: result.total, skipped: result.skipped.length };
      setPhase({ kind: "working", ...info, progress: { step: "saving", ...counts } });
      let record: ImportRecord;
      try {
        record = await importMutation.mutateAsync({
          fileName: file.name,
          activities: result.activities,
          skipped: result.skipped,
        });
      } catch {
        setPhase({ kind: "idle" });
        setNotice({ text: "The import failed and nothing was changed.", retry: file });
        return;
      }

      // The file is saved; now the ride data of its rides (T12). Failures never undo the import.
      const rideIds = new Set(
        result.activities.filter((a) => isRideSportType(a.sport_type)).map((a) => a.strava_id),
      );
      const rideStreams = result.streams.filter((s) => rideIds.has(s.stravaId));
      const dropped = result.droppedStreams.filter((d) => rideIds.has(d.stravaId)).length;
      let streams: StreamsOutcome | null = null;
      if (rideStreams.length > 0 || dropped > 0) {
        const saved = await saveRideStreams(rideStreams, streamsDeps, ({ done, total }) => {
          setPhase({
            kind: "working",
            ...info,
            progress: { step: "streams", ...counts, done, uploads: total },
          });
        });
        streams = { ...saved, dropped, retrying: false, dismissed: false };
      }
      setPhase({ kind: "done", record, streams });
    } finally {
      busy.current = false;
    }
  };

  const onFile = (file: File) => {
    void handleFile(file);
  };

  const dragging = useFileDrop(phase.kind !== "working", onFile);

  /** Uploads only the ride data that failed, from the file still in memory. */
  const retryStreams = async () => {
    if (phase.kind !== "done" || !phase.streams || phase.streams.retrying) return;
    const { record } = phase;
    const before = phase.streams;
    const update = (streams: StreamsOutcome) => {
      setPhase((current) =>
        current.kind === "done" && current.record.id === record.id
          ? { ...current, streams }
          : current,
      );
    };
    update({ ...before, retrying: true });
    const result = await saveRideStreams(before.failed, streamsDeps);
    update({
      ...before,
      saved: before.saved + result.saved,
      failed: result.failed,
      retrying: false,
      dismissed: false,
    });
  };

  const copyDetails = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ text: "Error details copied." });
    } catch {
      setNotice({ text: "Copying is not available in this browser." });
    }
  };

  let content;
  if (dragging || phase.kind === "idle") {
    const last = history.data?.[0];
    content = (
      <div className="flex max-w-3xl flex-col gap-4">
        <FilePicker dragging={dragging} onFile={onFile} />
        {last ? <LastImportLink record={last} /> : null}
        <p className="px-0.5 text-[13px] text-muted">
          Rides you already imported are updated, never duplicated.
        </p>
      </div>
    );
  } else if (phase.kind === "working") {
    content = (
      <div className="max-w-3xl">
        <ImportProgress
          fileName={phase.fileName}
          fileSize={phase.fileSize}
          progress={phase.progress}
        />
      </div>
    );
  } else if (phase.kind === "done") {
    content = (
      <ImportSummary
        record={phase.record}
        note={streamsNote(phase.streams)}
        secondaryAction={
          <Button
            variant="secondary"
            onClick={() => {
              setPhase({ kind: "idle" });
            }}
          >
            Import another file
          </Button>
        }
      />
    );
  } else {
    content = (
      <ImportRejected fileName={phase.fileName} message={phase.rejection.message}>
        <Button
          onClick={() => {
            anotherFileInput.current?.click();
          }}
        >
          Choose another file
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void copyDetails(errorDetails(phase, phase.rejection));
          }}
        >
          <CopyIcon />
          Copy error details
        </Button>
      </ImportRejected>
    );
  }

  // Save failures and copy confirmations are status cards (P12; in the side menu on desktop, P31).
  useStatusCard(
    "import-notice",
    notice?.retry ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    notice
      ? {
          tone: notice.retry ? "error" : "info",
          message: notice.text,
          onDismiss: () => {
            setNotice(null);
          },
          ...(notice.retry
            ? {
                action: (
                  <button
                    type="button"
                    className={statusActionClass}
                    onClick={() => {
                      if (notice.retry) onFile(notice.retry);
                    }}
                  >
                    Try again
                  </button>
                ),
              }
            : {}),
        }
      : null,
  );

  // Ride data that could not be saved: the import itself is done (T12).
  const failedStreams =
    phase.kind === "done" && phase.streams && !phase.streams.retrying && !phase.streams.dismissed
      ? phase.streams.failed.length
      : 0;
  useStatusCard(
    "import-streams",
    STATUS_PRIORITY.error,
    failedStreams > 0
      ? {
          tone: "error",
          message: `Ride data for ${rides(failedStreams)} could not be saved.`,
          onDismiss: () => {
            setPhase((current) =>
              current.kind === "done" && current.streams
                ? { ...current, streams: { ...current.streams, dismissed: true } }
                : current,
            );
          },
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void retryStreams();
              }}
            >
              Try again
            </button>
          ),
        }
      : null,
  );

  return (
    <>
      {content}
      <input
        ref={anotherFileInput}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label="Choose another file"
        onChange={(event) => {
          const file = takeFile(event);
          if (file) onFile(file);
        }}
      />
    </>
  );
}
