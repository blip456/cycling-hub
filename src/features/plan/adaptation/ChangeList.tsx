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
  level = 3,
}: {
  changes: readonly AdaptChange[];
  table: boolean;
  label: string;
  /** Heading level of each card on the phone: 3 under the page heading, 4 inside an h3 section. */
  level?: 3 | 4;
}) {
  if (changes.length === 0) {
    return <p className="text-body text-muted">No sessions changed.</p>;
  }
  if (table) {
    return (
      <div className="overflow-x-auto rounded-lg bg-surface px-4 py-1">
        <table className="w-full text-left text-body">
          <caption className="sr-only">{label}</caption>
          <thead className="text-caption text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Session
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Before
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Now
              </th>
              <th scope="col" className="py-2 pl-3 font-semibold">
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
      </div>
    );
  }
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {changes.map((change) => (
        <li
          key={`${change.date}-${change.change}`}
          className="rounded-lg bg-surface px-4 py-3 text-body"
        >
          <Heading className="font-semibold">{title(change)}</Heading>
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
