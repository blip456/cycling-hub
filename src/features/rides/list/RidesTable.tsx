import { memo } from "react";
import { Link } from "react-router";
import type { Ride } from "../api";
import { formatRideDate, type GroupBy, type RideGroup } from "../format";
import type { SortDir, SortKey } from "./list-state";
import { dateLineTags, METRICS, MISSING } from "./metrics";
import { formatTotalsLine, groupTitle } from "./sort-filter";
import { SortHeader } from "./SortHeader";

const COLUMNS = 2 + METRICS.length;

const SORT_LABEL: Record<SortKey, string> = {
  date: "date",
  name: "name",
  distance: "distance",
  time: "moving time",
  speed: "average speed",
  power: "average power",
  hr: "average heart rate",
  elevation: "elevation",
};

function captionFor(sort: SortKey, dir: SortDir): string {
  if (sort === "date") return `Rides, ${dir === "desc" ? "newest" : "oldest"} first`;
  if (sort === "name") return `Rides by name, ${dir === "asc" ? "A to Z" : "Z to A"}`;
  return `Rides by ${SORT_LABEL[sort]}, ${dir === "desc" ? "highest" : "lowest"} first`;
}

/** One ride (X1). The name links to the ride and covers the row, so the whole row opens it. */
const RideRow = memo(function RideRow({ ride }: { ride: Ride }) {
  const date = [formatRideDate(ride.start_local), ...dateLineTags(ride, { withRoad: false })].join(
    " · ",
  );
  return (
    <tr
      className={
        "relative border-t border-border transition-colors duration-(--dur-fast) hover:bg-surface-hover " +
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-accent"
      }
    >
      <td className="h-11 py-2 pr-2 pl-4 whitespace-nowrap text-muted">{date}</td>
      <td className="max-w-0 px-2 py-2">
        <Link
          to={`/rides/${ride.id}`}
          className="block truncate font-semibold outline-none after:absolute after:inset-0 after:content-['']"
        >
          {ride.name}
        </Link>
      </td>
      {METRICS.map((metric, i) => {
        const value = metric.format(ride);
        return (
          <td
            key={metric.key}
            className={
              "py-2 text-right whitespace-nowrap " +
              (i === METRICS.length - 1 ? "pr-4 pl-2 " : "px-3 ") +
              (value === MISSING ? "text-muted" : metric.color)
            }
          >
            {value}
          </td>
        );
      })}
    </tr>
  );
});

function GroupRow({
  group,
  by,
  currentYear,
}: {
  group: RideGroup;
  by: GroupBy;
  currentYear: string;
}) {
  const { title, detail } = groupTitle(group, by, currentYear);
  return (
    <tr className="border-t border-border bg-fill">
      <th
        scope="colgroup"
        colSpan={COLUMNS}
        className="h-9 px-4 text-left text-[13px] font-semibold"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span>
            {title}
            {detail ? <span className="font-normal"> · {detail}</span> : null}
          </span>
          <span className="text-muted">{formatTotalsLine(group.totals)}</span>
        </span>
      </th>
    </tr>
  );
}

/**
 * X1: the dense desktop table. Sorted by date it shows week or month rows with totals; sorted by any
 * other column it is one flat list (DESIGN.md, sortable table).
 */
export function RidesTable({
  rides,
  groups,
  by,
  sort,
  dir,
  onSort,
  currentYear,
}: {
  rides: readonly Ride[];
  /** Week or month groups when sorted by date; null for a flat list. */
  groups: readonly RideGroup[] | null;
  by: GroupBy;
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  currentYear: string;
}) {
  const header = { current: sort, dir, onSort };
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[680px] border-collapse text-[15px] tabular-nums">
        <caption className="sr-only">{captionFor(sort, dir)}</caption>
        <colgroup>
          <col />
          <col className="w-[30%]" />
        </colgroup>
        <thead>
          <tr>
            <SortHeader sortKey="date" label="Date" className="pl-2" {...header} />
            <SortHeader sortKey="name" label="Name" {...header} />
            {METRICS.map((metric, i) => (
              <SortHeader
                key={metric.key}
                sortKey={metric.key}
                label={metric.short}
                unit={metric.unit}
                className={i === METRICS.length - 1 ? "pr-2" : ""}
                {...header}
              />
            ))}
          </tr>
        </thead>
        {groups ? (
          groups.map((group) => (
            <tbody key={group.key}>
              <GroupRow group={group} by={by} currentYear={currentYear} />
              {group.rides.map((ride) => (
                <RideRow key={ride.id} ride={ride} />
              ))}
            </tbody>
          ))
        ) : (
          <tbody>
            {rides.map((ride) => (
              <RideRow key={ride.id} ride={ride} />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
