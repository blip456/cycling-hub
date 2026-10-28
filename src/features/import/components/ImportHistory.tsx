import { Link } from "react-router";
import type { ImportRecord } from "../api";
import { formatCounts, formatDateTime } from "../format";
import { ChevronRightIcon } from "../icons";

const detailPath = (record: ImportRecord) => `/import/history/${record.id}`;

function notImportedText(record: ImportRecord): string {
  return `Not imported. ${record.error_message ?? ""}`.trim();
}

/** C5: newest first. A list on the phone, a table with one column per outcome on desktop. */
export function ImportHistory({ records }: { records: ImportRecord[] }) {
  return (
    <>
      <ul className="overflow-hidden rounded-2xl bg-surface lg:hidden">
        {records.map((record) => (
          <li key={record.id} className="border-border not-first:border-t">
            <Link
              to={detailPath(record)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-(--surface-hover)"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold tabular-nums">
                  {formatDateTime(record.imported_at)}
                </span>
                <span className="truncate text-[13px] text-muted">{record.file_name}</span>
                {record.status === "imported" ? (
                  <span className="text-[13px] text-muted tabular-nums">
                    {formatCounts(record)}
                  </span>
                ) : (
                  <span className="text-[13px] text-danger">{notImportedText(record)}</span>
                )}
              </span>
              <ChevronRightIcon className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl bg-surface lg:block">
        <table className="w-full border-collapse text-[15px] tabular-nums">
          <caption className="sr-only">Import history, newest first</caption>
          <thead>
            <tr className="text-[13px] text-muted">
              <Th left>Date</Th>
              <Th left>File</Th>
              <Th>Activities</Th>
              <Th>New rides</Th>
              <Th>Updated</Th>
              <Th>Unchanged</Th>
              <Th>Not a ride</Th>
              <Th>Skipped</Th>
              <Th>Deleted earlier</Th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="border-border not-last:border-b hover:bg-(--surface-hover)"
              >
                <td className="h-11 py-2 pr-2 pl-4 whitespace-nowrap text-muted">
                  {formatDateTime(record.imported_at)}
                </td>
                <td className="max-w-[240px] px-2 py-2">
                  <Link
                    to={detailPath(record)}
                    className="block truncate font-semibold underline-offset-2 hover:underline"
                  >
                    {record.file_name}
                  </Link>
                </td>
                {record.status === "imported" ? (
                  <>
                    <Num value={record.activity_count} />
                    <Num value={record.new_count} />
                    <Num value={record.updated_count} />
                    <Num value={record.unchanged_count} />
                    <Num value={record.not_a_ride_count} />
                    <Num value={record.skipped_count} />
                    <Num value={record.deleted_earlier_count} last />
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2 text-right text-muted">—</td>
                    <td colSpan={6} className="py-2 pr-4 pl-2 text-danger">
                      {notImportedText(record)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children, left = false }: { children: string; left?: boolean }) {
  return (
    <th
      scope="col"
      className={
        "border-b border-border px-2 pt-3 pb-2.5 align-bottom font-semibold whitespace-nowrap first:pl-4 last:pr-4 " +
        (left ? "text-left" : "text-right")
      }
    >
      {children}
    </th>
  );
}

/** Zeros are muted (C5). */
function Num({ value, last = false }: { value: number; last?: boolean }) {
  return (
    <td
      className={
        "py-2 pl-2 text-right " + (last ? "pr-4 " : "pr-2 ") + (value === 0 ? "text-muted" : "")
      }
    >
      {value}
    </td>
  );
}

/** C1: the newest import, linking to the history. */
export function LastImportLink({ record }: { record: ImportRecord }) {
  return (
    <ul className="overflow-hidden rounded-2xl bg-surface">
      <li>
        <Link
          to="/import/history"
          className="flex min-h-13 items-center gap-3 px-4 py-2.5 hover:bg-(--surface-hover)"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span>Last import</span>
            <span className="text-[13px] text-muted tabular-nums">
              {formatDateTime(record.imported_at)} ·{" "}
              {record.status === "imported" ? formatCounts(record) : "Not imported"}
            </span>
          </span>
          <ChevronRightIcon className="shrink-0 text-muted" />
        </Link>
      </li>
    </ul>
  );
}
