import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { EmptyState } from "@/components/ui";
import { ImportHistory } from "@/features/import/components/ImportHistory";
import { formatImportCount } from "@/features/import/format";
import { useImportHistory } from "@/features/import/hooks";
import { UploadIcon } from "@/features/import/icons";

/** C5: past imports, newest first, including files that were not imported (P16, P33). */
export function ImportHistoryPage() {
  const history = useImportHistory();

  useStatusCard(
    "import-history-error",
    STATUS_PRIORITY.error,
    history.isError
      ? {
          tone: "error",
          message: "The import history could not be loaded.",
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void history.refetch();
              }}
            >
              Try again
            </button>
          ),
        }
      : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted tabular-nums">
          {history.data ? formatImportCount(history.data.length) : " "}
        </p>
        <Link to="/import" className={buttonClass("primary")}>
          <UploadIcon />
          Import rides
        </Link>
      </div>

      {history.isPending ? (
        <p role="status" className="text-muted">
          Loading…
        </p>
      ) : history.data?.length ? (
        <ImportHistory records={history.data} />
      ) : history.data ? (
        <EmptyState>No imports yet.</EmptyState>
      ) : null}
    </div>
  );
}
