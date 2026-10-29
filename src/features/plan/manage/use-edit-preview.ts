import { useQuery } from "@tanstack/react-query";
import type { IsoDate } from "@/features/athlete";
import type { Warning } from "../engine";
import type { EditSave } from "../data/edit";
import { planKeys } from "../data/hooks";
import { usePlanRunner } from "./runner";

export type EditPreview =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; changed: number; warnings: Warning[] };

/**
 * What saving the edit would do to the sessions, asked from the runner without writing anything. The same
 * evaluation the save runs, so the number on the summary is the number of sessions the save changes.
 */
export function useEditPreview(save: EditSave | null, today: IsoDate): EditPreview {
  const runner = usePlanRunner();
  const intake = save?.input.intake;
  const query = useQuery({
    queryKey: [...planKeys.all, "edit-preview", today, JSON.stringify(intake ?? null)],
    queryFn: async () => {
      if (!intake) throw new Error("No answers");
      const result = await runner.preview(today, intake);
      if (result.status !== "done") throw new Error(result.status);
      return result;
    },
    enabled: intake !== undefined,
    retry: false,
    gcTime: 0,
  });
  if (query.isError) return { status: "error" };
  if (!query.data) return { status: "loading" };
  return { status: "ready", changed: query.data.changed, warnings: query.data.warnings };
}
