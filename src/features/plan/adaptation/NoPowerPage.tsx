import { useMemo } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { useRides } from "@/features/rides/hooks";
import { useMediaQuery } from "@/lib/use-media-query";
import { noPowerWarning, NO_POWER_MIN_SESSIONS } from "../adapt";
import { GRID_QUERY, usePlanLoadErrorCard, useToday } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { formatDay, usePlanData } from "../data";
import { toAdaptRide, toStoredSessions } from "./stored";

export const NO_POWER_PATH = "/plan/no-power";

const FIXES = [
  "Ride with a power meter or a smart trainer. Power targets in the plan need one.",
  "Import rides that include power. Use Import for rides recorded elsewhere.",
  "No power meter? The plan still works. Heart rate targets are shown for every session.",
] as const;

/** R7b: which sessions of the last 4 weeks have no power data, and how to get it. */
export function NoPowerPage() {
  const data = usePlanData();
  const rides = useRides();
  const today = useToday();
  const desktop = useMediaQuery(GRID_QUERY);
  const failed = data.isError || rides.isError;
  const retry = () => {
    data.refetch();
    void rides.refetch();
  };
  usePlanLoadErrorCard(failed, retry);

  const intake = data.plan?.intake ?? null;
  const warning = useMemo(() => {
    if (!intake || !rides.data) return null;
    return noPowerWarning(
      toStoredSessions(data.sessions, intake),
      rides.data.map(toAdaptRide),
      today,
    );
  }, [intake, data.sessions, rides.data, today]);

  if (failed) return <PlanLoadError retry={retry} />;
  if (data.isPending || rides.isPending) return <PlanSkeleton desktop={false} />;

  const sessions = warning?.sessions ?? [];
  return (
    <section aria-labelledby="no-power-title" className="flex flex-col gap-5">
      <h2 id="no-power-title" className="sr-only">
        No power data
      </h2>
      <div className={desktop ? "grid grid-cols-2 items-start gap-8" : "flex flex-col gap-5"}>
        <section aria-labelledby="no-power-list">
          <h3 id="no-power-list" className="text-[17px] font-semibold">
            Sessions without power data
          </h3>
          {sessions.length === 0 ? (
            <p className="mt-1 text-[15px] text-muted">
              {`Fewer than ${String(NO_POWER_MIN_SESSIONS)} sessions in the last 4 weeks are missing power data, so there is nothing to fix.`}
            </p>
          ) : (
            <>
              <p className="mt-1 text-[15px] text-muted">
                Last 4 weeks, {sessions.length} sessions.
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-xl bg-surface px-3.5 py-2 text-[15px]"
                  >
                    <span className="font-medium">
                      {formatDay(s.date)} · {s.title}
                    </span>
                    <span className="text-[13px] text-muted">no power channel</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section aria-labelledby="no-power-fix">
          <h3 id="no-power-fix" className="text-[17px] font-semibold">
            How to get power data
          </h3>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-[15px]">
            {FIXES.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ol>
          <Link to="/import" className={`${buttonClass("primary")} mt-4`}>
            Go to Import
          </Link>
        </section>
      </div>
    </section>
  );
}
