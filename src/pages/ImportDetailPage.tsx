import { Link, useParams } from "react-router";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { EmptyState } from "@/components/ui";
import { ImportRejected } from "@/features/import/components/ImportRejected";
import { ImportSummary } from "@/features/import/components/ImportSummary";
import { formatDateTime } from "@/features/import/format";
import { useImportRecord } from "@/features/import/hooks";

/** A past import from the history (C5 → C3 or C4). */
export function ImportDetailPage() {
  const { id = "" } = useParams();
  const query = useImportRecord(id);
  const record = query.data;

  useStatusCard(
    "import-detail-error",
    STATUS_PRIORITY.error,
    query.isError
      ? {
          tone: "error",
          message: "This import could not be loaded.",
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

  const backToHistory = (
    <Link to="/import/history" className={buttonClass("secondary")}>
      Import history
    </Link>
  );

  if (query.isPending) {
    return (
      <p role="status" className="text-muted">
        Loading…
      </p>
    );
  }
  if (query.isError) {
    return backToHistory;
  }
  if (!record) {
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyState>This import was not found.</EmptyState>
        {backToHistory}
      </div>
    );
  }
  if (record.status === "not_imported") {
    return (
      <ImportRejected
        fileName={record.file_name}
        message={record.error_message ?? ""}
        caption={formatDateTime(record.imported_at)}
      >
        <Link to="/import" className={buttonClass("primary")}>
          Import a file
        </Link>
        {backToHistory}
      </ImportRejected>
    );
  }
  return <ImportSummary record={record} secondaryAction={backToHistory} showHistoryLink={false} />;
}
