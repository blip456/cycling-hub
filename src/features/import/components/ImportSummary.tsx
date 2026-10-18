import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import type { ImportRecord } from "../api";
import { formatActivityCount, formatDateTime } from "../format";
import { CheckIcon, ChevronRightIcon } from "../icons";
import { readStoredSkipped } from "../parse";
import { OutcomeGrid } from "./OutcomeGrid";
import { SkippedList } from "./SkippedList";

/**
 * C3: import summary. Used right after an import and for a past import from the history.
 * The heading takes focus when it appears, so screen readers announce the result.
 */
export function ImportSummary({
  record,
  secondaryAction,
  showHistoryLink = true,
}: {
  record: ImportRecord;
  /** "Import another file" after an import. */
  secondaryAction?: ReactNode;
  showHistoryLink?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto] lg:items-start lg:gap-x-6">
      <div className="flex items-start gap-2.5 lg:col-start-1 lg:row-start-1">
        <CheckIcon className="mt-1.5 shrink-0 text-positive" />
        <div className="min-w-0">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-[-0.015em] outline-none"
          >
            Import complete
          </h2>
          <p className="text-[13px] break-words text-muted">
            {record.file_name} · {formatActivityCount(record.activity_count)} ·{" "}
            {formatDateTime(record.imported_at)}
          </p>
        </div>
      </div>

      <div className="lg:col-span-2">
        <OutcomeGrid record={record} />
      </div>

      <div className="lg:col-span-2">
        <SkippedList skipped={readStoredSkipped(record.errors)} />
      </div>

      {showHistoryLink ? (
        <ul className="overflow-hidden rounded-2xl bg-surface lg:col-span-2 lg:mt-1 lg:max-w-[420px]">
          <li>
            <Link
              to="/import/history"
              className="flex min-h-13 items-center gap-3 px-4 hover:bg-(--surface-hover)"
            >
              <span className="flex-1">Import history</span>
              <ChevronRightIcon className="text-muted" />
            </Link>
          </li>
        </ul>
      ) : null}

      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:flex-row">
        <Link to="/rides" className={buttonClass("primary", "order-first lg:order-last")}>
          View rides
        </Link>
        {secondaryAction}
      </div>
    </div>
  );
}
