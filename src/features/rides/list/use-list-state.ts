import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { parseListState, writeListState, type ListState } from "./list-state";

/**
 * The list view from the URL query, and a setter that merges a change into it. Changes replace the
 * history entry, so Back leaves the list instead of stepping through every filter change, and opening a
 * ride and going back returns to the same view (backlog item 4).
 */
export function useListState(): [ListState, (patch: Partial<ListState>) => void] {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseListState(params), [params]);
  const update = useCallback(
    (patch: Partial<ListState>) => {
      setParams((prev) => writeListState({ ...parseListState(prev), ...patch }), {
        replace: true,
        preventScrollReset: true,
      });
    },
    [setParams],
  );
  return [state, update];
}
