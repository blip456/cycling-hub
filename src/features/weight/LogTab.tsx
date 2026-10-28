import { useState } from "react";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui";
import type { WeightEntry } from "@/features/athlete";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { HistoryList } from "./HistoryList";
import { useDeleteWeight, useWeightEntries } from "./hooks";
import { useLoadErrorCard, useWeightCards } from "./use-weight-cards";
import { WeightForm } from "./WeightForm";

/** The Log tab: the log form, the history with edit and delete, and the Undo card (W1a, W1b, W5). */
export function LogTab() {
  const query = useWeightEntries();
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const remove = useDeleteWeight();
  const cards = useWeightCards();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  useLoadErrorCard(query.isError, () => void query.refetch());

  function onDelete(entry: WeightEntry) {
    cards.hide();
    if (editing?.date === entry.date) setEditing(null);
    remove.mutate(entry.date, {
      onSuccess: () => {
        cards.showDeleted(entry);
      },
      onError: () => {
        cards.showDeleteFailed(entry);
      },
    });
  }

  const newestFirst = query.data ? [...query.data].reverse() : [];

  return (
    <div className="grid gap-8 min-[960px]:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] min-[960px]:items-start">
      <div className="max-w-[400px]">
        <WeightForm
          key={editing?.date ?? "new"}
          entries={query.data}
          editing={editing}
          onDone={() => {
            setEditing(null);
          }}
        />
      </div>
      <section aria-labelledby="weight-history">
        <h2 id="weight-history" className="mb-3 text-xl font-semibold tracking-tight">
          History
        </h2>
        {query.isPending ? <PageLoading /> : null}
        {query.isError ? (
          <div className="rounded-2xl bg-surface px-5 py-6">
            <p className="text-[15px]">Your weights could not be loaded.</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                void query.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {query.isSuccess && newestFirst.length === 0 ? (
          <div className="rounded-2xl bg-surface px-5 py-8 text-center">
            <p className="text-[17px] font-semibold">No weights yet</p>
            <p className="mt-1 text-[15px] text-muted">
              Log your first weight {desktop ? "on the left" : "above"}. The trend appears after two
              entries.
            </p>
          </div>
        ) : null}
        {query.isSuccess && newestFirst.length > 0 ? (
          <HistoryList
            entries={newestFirst}
            editingDate={editing?.date ?? null}
            onEdit={setEditing}
            onDelete={onDelete}
          />
        ) : null}
      </section>
    </div>
  );
}
