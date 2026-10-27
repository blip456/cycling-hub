import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { formatDateTime } from "@/features/import/format";
import { useImportHistory } from "@/features/import/hooks";
import { UploadIcon } from "@/features/import/icons";
import { groupRides, totals, type GroupBy } from "@/features/rides/format";
import { useRides } from "@/features/rides/hooks";
import { Checkbox, GroupBySwitch } from "@/features/rides/list/controls";
import { FilterBar } from "@/features/rides/list/FilterBar";
import {
  CLEARED_FILTERS,
  DEFAULT_STATE,
  hasFilters,
  nextSort,
  type ListState,
  type SortKey,
} from "@/features/rides/list/list-state";
import { NoMatches, RidesEmpty, RidesSkeleton } from "@/features/rides/list/ListStates";
import { RideCard } from "@/features/rides/list/RideCard";
import { RideGroupHeader } from "@/features/rides/list/RideGroupHeader";
import { RidesTable } from "@/features/rides/list/RidesTable";
import {
  earlierYears,
  filterRides,
  formatRideCount,
  formatTotalsLine,
  sortRides,
  todayInBrussels,
} from "@/features/rides/list/sort-filter";
import { useListState } from "@/features/rides/list/use-list-state";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

/** The search reaches the URL after a short pause in typing (DESIGN.md filter bar). */
const SEARCH_DELAY_MS = 250;

/**
 * B1a (phone) and X1 (desktop): all rides, newest first, by week or month with totals. Desktop adds
 * sorting and filters. The view lives in the URL query (backlog item 4).
 */
export function RidesPage() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const rides = useRides();
  const history = useImportHistory();
  const [state, update] = useListState();
  const [searchText, setSearchText] = useState(state.q);
  const today = useMemo(() => todayInBrussels(), []);
  const currentYear = today.slice(0, 4);

  useEffect(() => {
    if (searchText === state.q) return;
    const timer = setTimeout(() => {
      update({ q: searchText });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [searchText, state.q, update]);

  useStatusCard(
    "rides-error",
    STATUS_PRIORITY.error,
    rides.isError
      ? {
          tone: "error",
          message: "Couldn’t load your rides. Check your connection.",
          action: (
            <button
              type="button"
              className={statusActionClass}
              onClick={() => {
                void rides.refetch();
              }}
            >
              Try again
            </button>
          ),
        }
      : null,
  );

  // The phone has Week / Month and Hide commutes only (B1a); sort and filters are desktop-only.
  const view: ListState = useMemo(
    () =>
      isDesktop ? state : { ...DEFAULT_STATE, view: state.view, hideCommutes: state.hideCommutes },
    [isDesktop, state],
  );

  const all = rides.data;
  const filtered = useMemo(() => (all ? filterRides(all, view, today) : []), [all, view, today]);
  const sorted = useMemo(
    () => sortRides(filtered, view.sort, view.dir),
    [filtered, view.sort, view.dir],
  );
  const groups = useMemo(
    () => (view.sort === "date" ? groupRides(sorted, view.view) : null),
    [sorted, view.sort, view.view],
  );
  const shownTotals = useMemo(() => totals(sorted), [sorted]);
  const years = useMemo(() => (all ? earlierYears(all, today) : []), [all, today]);

  const setView = useCallback(
    (value: GroupBy) => {
      update({ view: value });
    },
    [update],
  );
  const setHideCommutes = useCallback(
    (hideCommutes: boolean) => {
      update({ hideCommutes });
    },
    [update],
  );
  const onSort = useCallback(
    (key: SortKey) => {
      update(nextSort(state, key));
    },
    [state, update],
  );
  const clearFilters = useCallback(() => {
    setSearchText("");
    update(CLEARED_FILTERS);
  }, [update]);

  const hasRides = !!all && all.length > 0;
  const lastImport = history.data?.find((record) => record.status === "imported");

  let content;
  if (rides.isPending) {
    content = <RidesSkeleton desktop={isDesktop} />;
  } else if (!all) {
    content = (
      <p className="pt-12 text-center text-[13px] text-muted">
        Your rides appear here once they load.
      </p>
    );
  } else if (!hasRides) {
    content = <RidesEmpty />;
  } else if (sorted.length === 0) {
    content = <NoMatches onClear={clearFilters} />;
  } else if (isDesktop) {
    content = (
      <RidesTable
        rides={sorted}
        groups={groups}
        by={view.view}
        sort={view.sort}
        dir={view.dir}
        onSort={onSort}
        currentYear={currentYear}
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-6">
        {(groups ?? []).map((group) => (
          <section key={group.key} aria-labelledby={`rides-${group.key}`}>
            <RideGroupHeader
              id={`rides-${group.key}`}
              group={group}
              by={view.view}
              currentYear={currentYear}
            />
            <div className="flex flex-col gap-2.5">
              {group.rides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const showControls = rides.isPending || hasRides || (rides.isError && !all);

  if (isDesktop) {
    const showCountLine = hasFilters(state) || state.sort !== "date";
    return (
      <div>
        {/* Sits beside the page title of the app shell (X1): count line under it, actions right. */}
        <div className="-mt-14 mb-6 flex items-start justify-between gap-4">
          <p className="min-h-[18px] pt-9 text-[13px] leading-[18px] text-muted tabular-nums">
            {hasRides
              ? formatRideCount(all.length) +
                (lastImport ? ` · last import ${formatDateTime(lastImport.imported_at)}` : "")
              : null}
          </p>
          <div className="flex items-center gap-3">
            {hasRides && state.sort === "date" ? (
              <GroupBySwitch value={state.view} onChange={setView} />
            ) : null}
            {hasRides ? (
              <Link to="/import" className={buttonClass("primary")}>
                <UploadIcon />
                Import rides
              </Link>
            ) : null}
          </div>
        </div>
        {showControls ? (
          <div className="mb-4">
            <FilterBar
              state={state}
              searchText={searchText}
              onSearchText={setSearchText}
              years={years}
              filtered={hasFilters(state)}
              onChange={update}
              onClear={clearFilters}
            />
          </div>
        ) : null}
        <p
          aria-live="polite"
          className="mb-2 min-h-[18px] px-0.5 empty:mb-0 empty:min-h-0 text-[13px] leading-[18px] text-muted tabular-nums"
        >
          {hasRides && showCountLine && sorted.length > 0 ? formatTotalsLine(shownTotals) : ""}
        </p>
        {content}
      </div>
    );
  }

  return (
    <div>
      {showControls ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <GroupBySwitch value={state.view} onChange={setView} />
          <Checkbox checked={state.hideCommutes} onChange={setHideCommutes}>
            Hide commutes
          </Checkbox>
        </div>
      ) : null}
      {/* Announces what is left when Hide commutes changes the list. */}
      <p className="sr-only" aria-live="polite">
        {state.hideCommutes && hasRides && sorted.length > 0 ? formatTotalsLine(shownTotals) : ""}
      </p>
      {content}
    </div>
  );
}
