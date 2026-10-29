import { useEffect, useState } from "react";
import { Button, EmptyState } from "@/components/ui";
import { useMediaQuery } from "@/lib/use-media-query";
import { ChangeList } from "../adaptation/ChangeList";
import { formatUpdated } from "../adaptation/format";
import { undoableChange, usePlanChanges } from "../adaptation/hooks";
import { useSeenUpdate } from "../adaptation/seen";
import { useUndoFlow } from "../adaptation/use-undo-flow";
import type { PlanChange } from "../adaptation/changes";
import { GRID_QUERY, usePlanLoadErrorCard } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { NoPlanState } from "../components/NoPlan";
import { usePlan } from "../data";

function Header({ change }: { change: PlanChange }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5 text-[15px]">
      <p className="font-semibold">Updated {formatUpdated(change.createdAt)}</p>
      <p className="mt-0.5">{change.message}</p>
      {change.undoneAt ? (
        <p className="mt-0.5 text-muted">Undone {formatUpdated(change.undoneAt)}.</p>
      ) : null}
    </div>
  );
}

/** R4: what moved and why, with Undo all and a short log of earlier updates (the last 10). */
export function ChangesPage() {
  const plan = usePlan();
  const changes = usePlanChanges();
  const desktop = useMediaQuery(GRID_QUERY);
  const { markSeen } = useSeenUpdate();
  const { undo, isPending } = useUndoFlow("plan-changes-undo");
  const [open, setOpen] = useState<string | null>(null);
  const failed = plan.isError || changes.isError;
  const retry = () => {
    void plan.refetch();
    void changes.refetch();
  };
  usePlanLoadErrorCard(failed, retry);

  const latest = changes.data?.[0];
  useEffect(() => {
    if (latest) markSeen(latest.id);
  }, [latest, markSeen]);

  if (failed) return <PlanLoadError retry={retry} />;
  if (plan.isPending || (plan.data && changes.isPending)) return <PlanSkeleton desktop={false} />;
  if (!plan.data) return <NoPlanState />;

  const earlier = (changes.data ?? []).slice(1);
  const canUndo = undoableChange(changes.data, plan.data.fingerprint);

  return (
    <section aria-labelledby="plan-changes" className="flex max-w-4xl flex-col gap-4">
      <h2 id="plan-changes" className="sr-only">
        Plan changes
      </h2>
      {!latest ? (
        <EmptyState>
          No plan updates yet. When a missed session, a ride or a new FTP changes your plan, you see
          here what moved and why.
        </EmptyState>
      ) : (
        <>
          <Header change={latest} />
          <ChangeList
            changes={latest.payload.changes}
            table={desktop}
            label={`Sessions changed on ${formatUpdated(latest.createdAt)}`}
          />
          {canUndo?.payload.undo ? (
            <div>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  undo(canUndo);
                }}
              >
                Undo all
              </Button>
              <p className="mt-1.5 max-w-[60ch] text-[13px] text-muted">
                {canUndo.payload.undo.description}
              </p>
            </div>
          ) : null}
        </>
      )}
      {earlier.length > 0 ? (
        <section aria-labelledby="plan-earlier">
          <h3 id="plan-earlier" className="mb-1.5 text-[17px] font-semibold">
            Earlier updates ({earlier.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {earlier.map((change) => {
              const expanded = open === change.id;
              return (
                <li key={change.id} className="rounded-2xl bg-surface">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`earlier-${change.id}`}
                    className="flex min-h-11 w-full flex-col items-start rounded-2xl px-4 py-2.5 text-left text-[15px] hover:bg-surface-hover"
                    onClick={() => {
                      setOpen(expanded ? null : change.id);
                    }}
                  >
                    <span className="font-semibold">{formatUpdated(change.createdAt)}</span>
                    <span className="text-muted">
                      {change.message}
                      {change.undoneAt ? " Undone." : ""}
                    </span>
                  </button>
                  {expanded ? (
                    <div id={`earlier-${change.id}`} className="px-3 pb-3">
                      <ChangeList
                        changes={change.payload.changes}
                        table={desktop}
                        label={`Sessions changed on ${formatUpdated(change.createdAt)}`}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
