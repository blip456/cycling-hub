import type { SortDir, SortKey } from "./list-state";

function Arrow({ dir, className }: { dir: SortDir; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      aria-hidden="true"
      focusable={false}
      className={`shrink-0 ${className}`}
    >
      <path
        d={dir === "desc" ? "M12 5v14m-6-6 6 6 6-6" : "M12 19V5m-6 6 6-6 6 6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A sortable column header (DESIGN.md, sortable table): a button inside the th, aria-sort on the sorted
 * th only. The arrow shows on the sorted column, and on hover in muted; its space is always kept.
 * Metric columns: arrow on the unit line, left of the unit. Date and Name: arrow after the label.
 */
export function SortHeader({
  sortKey,
  label,
  unit,
  current,
  dir,
  onSort,
  className = "",
}: {
  sortKey: SortKey;
  label: string;
  unit?: string;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const sorted = current === sortKey;
  const arrowDir: SortDir = sorted ? dir : sortKey === "name" ? "asc" : "desc";
  const arrow = (
    <Arrow
      dir={arrowDir}
      className={sorted ? "text-text" : "text-muted opacity-0 group-hover:opacity-100"}
    />
  );
  const numeric = unit !== undefined;
  return (
    <th
      scope="col"
      aria-sort={sorted ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-1 pt-2 pb-1 align-bottom font-normal ${className}`}
    >
      <button
        type="button"
        onClick={() => {
          onSort(sortKey);
        }}
        className={
          "group flex min-h-11 w-full flex-col justify-end rounded-[8px] px-2 py-1 text-[13px] leading-[18px] transition-colors duration-(--dur-fast) hover:bg-fill " +
          (numeric ? "items-end text-right " : "items-start text-left ") +
          (sorted ? "font-semibold text-text" : "font-semibold text-muted")
        }
      >
        {numeric ? (
          <>
            <span className="whitespace-nowrap">{label}</span>
            <span className="flex items-center gap-0.5 font-normal whitespace-nowrap">
              {arrow}
              {unit}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 whitespace-nowrap">
            {label}
            {arrow}
          </span>
        )}
      </button>
    </th>
  );
}
