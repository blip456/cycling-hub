import type { AdaptChange } from "../adapt";
import { formatDay } from "../data";
import { changeKind, summaryText } from "./format";

function title(change: AdaptChange): string {
  return `${formatDay(change.date)}: ${changeKind(change)}`;
}

function before(change: AdaptChange): string {
  return change.before ? summaryText(change.before) : "No session";
}

function now(change: AdaptChange): string {
  return change.after ? summaryText(change.after) : "No session, removed";
}

/**
 * R4: the changed sessions with Before, Now and Why. Phone: one card per session with text rows. Desktop: a
 * table with real header cells. No colour coding: the labels do the work (4 of R4).
 */
export function ChangeList({
  changes,
  table,
  label,
}: {
  changes: readonly AdaptChange[];
  table: boolean;
  label: string;
}) {
  if (changes.length === 0) {
    return <p className="text-[15px] text-muted">No sessions changed.</p>;
  }
  if (table) {
    return (
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">{label}</caption>
        <thead className="text-[13px] text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Session
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Before
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Now
            </th>
            <th scope="col" className="py-2 pl-3 font-medium">
              Why
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr
              key={`${change.date}-${change.change}`}
              className="border-t border-border align-top"
            >
              <th scope="row" className="py-2.5 pr-3 font-semibold">
                {formatDay(change.date)}
              </th>
              <td className="px-3 py-2.5">{before(change)}</td>
              <td className="px-3 py-2.5">{now(change)}</td>
              <td className="py-2.5 pl-3">{change.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {changes.map((change) => (
        <li
          key={`${change.date}-${change.change}`}
          className="rounded-2xl bg-surface px-4 py-3 text-[15px]"
        >
          <h4 className="font-semibold">{title(change)}</h4>
          <dl className="mt-1.5 flex flex-col gap-1">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-muted">Before</dt>
              <dd className="min-w-0">{before(change)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-muted">Now</dt>
              <dd className="min-w-0">{now(change)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-muted">Why</dt>
              <dd className="min-w-0">{change.reason}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
