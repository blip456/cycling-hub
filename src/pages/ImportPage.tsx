import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import type { ImportRecord } from "@/features/import/api";
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
  type FileRejection,
  type ParseResult,
} from "@/features/import/parse";
import { useFileDrop } from "@/features/import/use-file-drop";

type FileInfo = { fileName: string; fileSize: number };

type Phase =
  | { kind: "idle" }
  | ({ kind: "working"; progress: ProgressStep } & FileInfo)
  | { kind: "done"; record: ImportRecord }
  | ({ kind: "rejected"; rejection: FileRejection } & FileInfo);

type Notice = { text: string; retry?: File };

async function readAndParse(file: File): Promise<ParseResult> {
  const tooLarge = rejectTooLarge(file.size);
  if (tooLarge) return { ok: false, ...tooLarge };
  try {
    return parseExport(await file.text());
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

      setPhase({
        kind: "working",
        ...info,
        progress: { step: "saving", total: result.total, skipped: result.skipped.length },
      });
      try {
        const record = await importMutation.mutateAsync({
          fileName: file.name,
          activities: result.activities,
          skipped: result.skipped,
        });
        setPhase({ kind: "done", record });
      } catch {
        setPhase({ kind: "idle" });
        setNotice({ text: "The import failed and nothing was changed.", retry: file });
      }
    } finally {
      busy.current = false;
    }
  };

  const onFile = (file: File) => {
    void handleFile(file);
  };

  const dragging = useFileDrop(phase.kind !== "working", onFile);

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
