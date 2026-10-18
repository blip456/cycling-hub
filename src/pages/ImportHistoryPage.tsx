import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { StatusCard } from "@/components/StatusCard";
import { Button, EmptyState } from "@/components/ui";
import { ImportHistory } from "@/features/import/components/ImportHistory";
import { formatImportCount } from "@/features/import/format";
import { useImportHistory } from "@/features/import/hooks";
import { UploadIcon } from "@/features/import/icons";

/** C5: past imports, newest first, including files that were not imported (P16, P33). */
export function ImportHistoryPage() {
  const history = useImportHistory();

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

      {history.isError ? (
        <StatusCard
          action={
            <Button
              variant="ghost"
              onClick={() => {
                void history.refetch();
              }}
            >
              Try again
            </Button>
          }
        >
          The import history could not be loaded.
        </StatusCard>
      ) : null}
    </div>
  );
}
