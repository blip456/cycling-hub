import type { SVGProps } from "react";
import { CloseIcon } from "@/components/icons";
import type { WeightEntry } from "@/features/athlete";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { formatDay, formatKg } from "./format";

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    </svg>
  );
}

interface Props {
  /** Newest first. */
  entries: readonly WeightEntry[];
  editingDate: string | null;
  onEdit: (entry: WeightEntry) => void;
  onDelete: (entry: WeightEntry) => void;
}

const iconButton =
  "flex size-11 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text";
const textButton =
  "inline-flex min-h-11 items-center rounded-md px-2.5 text-[15px] font-semibold text-accent hover:bg-accent-soft";

/** The history, newest first: a list of rows on the phone, a table on desktop (W1a, W1ad). */
export function HistoryList(props: Props) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  return desktop ? <HistoryTable {...props} /> : <HistoryRows {...props} />;
}

function HistoryRows({ entries, editingDate, onEdit, onDelete }: Props) {
  return (
    <ul
      aria-label="Weights, newest first"
      className="divide-y divide-border rounded-2xl bg-surface"
    >
      {entries.map((entry) => {
        const day = formatDay(entry.date);
        return (
          <li
            key={entry.date}
            className={
              "flex items-center gap-1 py-2 pl-4 pr-2 " +
              (editingDate === entry.date ? "border-l-4 border-accent bg-accent-soft pl-3" : "")
            }
          >
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold [font-variant-numeric:tabular-nums]">
                {formatKg(entry.kg)} kg
              </p>
              <p className="truncate text-[13px] text-muted">
                {day}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Edit entry for ${day}`}
              className={iconButton}
              onClick={() => {
                onEdit(entry);
              }}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              aria-label={`Delete entry for ${day}`}
              className={iconButton}
              onClick={() => {
                onDelete(entry);
              }}
            >
              <CloseIcon width={18} height={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HistoryTable({ entries, editingDate, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full text-[15px]">
        <caption className="sr-only">Weights, newest first</caption>
        <thead className="text-left text-[13px] text-muted">
          <tr>
            <th scope="col" className="py-3 pl-4 pr-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-2 py-3 text-right font-medium">
              Weight (kg)
            </th>
            <th scope="col" className="px-2 py-3 font-medium">
              Note
            </th>
            <th scope="col" className="py-3 pl-2 pr-4 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const day = formatDay(entry.date);
            return (
              <tr
                key={entry.date}
                className={
                  "border-t border-border " +
                  (editingDate === entry.date
                    ? "bg-accent-soft shadow-[inset_4px_0_0_var(--accent)]"
                    : "")
                }
              >
                <td className="h-11 whitespace-nowrap py-1 pl-4 pr-2">{day}</td>
                <td className="px-2 py-1 text-right [font-variant-numeric:tabular-nums]">
                  {formatKg(entry.kg)}
                </td>
                <td className="px-2 py-1 text-muted">{entry.note ?? "—"}</td>
                <td className="whitespace-nowrap py-1 pl-2 pr-2 text-right">
                  <button
                    type="button"
                    aria-label={`Edit entry for ${day}`}
                    className={textButton}
                    onClick={() => {
                      onEdit(entry);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete entry for ${day}`}
                    className={textButton}
                    onClick={() => {
                      onDelete(entry);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
