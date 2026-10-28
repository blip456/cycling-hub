import type { GroupBy, RideGroup } from "../format";
import { formatTotalsLine, groupTitle } from "./sort-filter";

/** Week or month header on the phone (B1a): title left, totals right (P11). */
export function RideGroupHeader({
  id,
  group,
  by,
  currentYear,
}: {
  id: string;
  group: RideGroup;
  by: GroupBy;
  currentYear: string;
}) {
  const { title, detail } = groupTitle(group, by, currentYear);
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-0.5">
      <h2 id={id} className="text-[15px] font-semibold">
        {detail ? `${title} · ${detail}` : title}
      </h2>
      <p className="text-[13px] text-muted tabular-nums">{formatTotalsLine(group.totals)}</p>
    </div>
  );
}
