import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { EmptyState } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import { useMediaQuery } from "@/lib/use-media-query";
import { fetchPlanChanges } from "../adaptation/api";
import type { PlanChange } from "../adaptation/changes";
import type { AdaptChange } from "../adapt";
import { formatDay, kindName, usePlan } from "../data";
import { GRID_QUERY, usePlanLoadErrorCard } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { changesKey } from "../manage/clear-plan-caches";

const LIMIT = 20;

/** "Threshold, 75 min, 3x12" or "no session". */
function side(value: AdaptChange["before"]): string {
  if (!value) return "no session";
  return `${kindName(value.kind)}, ${String(value.durationMin)} min${value.mainSet ? `, ${value.mainSet}` : ""}`;
}

function Update({ change }: { change: PlanChange }) {
  const day = brusselsDate(new Date(change.createdAt));
  return (
    <section aria-label={change.message} className="rounded-2xl bg-surface px-4 py-4">
      <h3 className="text-[17px] leading-6 font-semibold">{change.message}</h3>
      <p className="text-[13px] text-muted">
        {day ? formatDay(day) : ""}
        {change.undoneAt ? " · Undone" : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-[15px]">
        {change.payload.changes.map((c) => (
          <li key={`${c.date}-${c.change}`}>
            <span className="font-semibold">{formatDay(c.date)}</span>: {side(c.before)}
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> becomes </span>
            {side(c.after)}
            <span className="block text-[13px] text-muted">{c.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** R4: what moved and why, newest update first. Undo is on the "Plan updated" card right after an update. */
export function ChangesPage() {
  const plan = usePlan();
  const planId = plan.data?.id;
  const grid = useMediaQuery(GRID_QUERY);
  const changes = useQuery({
    queryKey: changesKey(planId ?? ""),
    queryFn: () => fetchPlanChanges(planId ?? "", LIMIT),
    enabled: planId !== undefined,
  });
  const failed = plan.isError || changes.isError;
  const retry = () => {
    void plan.refetch();
    void changes.refetch();
  };
  usePlanLoadErrorCard(failed, retry);

  let body: ReactNode;
  if (failed) body = <PlanLoadError retry={retry} />;
  else if (plan.isPending || (planId !== undefined && changes.isPending))
    body = <PlanSkeleton desktop={grid} />;
  else if (planId === undefined)
    body = (
      <div className="flex flex-col items-start gap-3">
        <EmptyState>There is no plan, so there are no updates.</EmptyState>
        <Link to="/plan/new" className={buttonClass("primary")}>
          Create my plan
        </Link>
      </div>
    );
  else if ((changes.data ?? []).length === 0)
    body = <EmptyState>Your plan has not been updated yet.</EmptyState>;
  else
    body = (
      <div className="flex flex-col gap-3">
        {(changes.data ?? []).map((change) => (
          <Update key={change.id} change={change} />
        ))}
      </div>
    );
  return (
    <section aria-labelledby="plan-changes" className="max-w-[640px]">
      <h2 id="plan-changes" className="mb-4 text-lg font-semibold tracking-tight">
        Plan changes
      </h2>
      {body}
    </section>
  );
}
