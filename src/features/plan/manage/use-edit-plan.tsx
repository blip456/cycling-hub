import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  useStatusCard,
  type StatusRegistry,
} from "@/components/status/status-context";
import type { IsoDate } from "@/features/athlete";
import { goalKeys } from "@/features/weight/goal-hooks";
import { useAuth } from "@/lib/auth/auth-context";
import type { RunResult } from "../adaptation/runner";
import { saveWeightGoal, savePlanProfile } from "../data/api";
import type { EditSave } from "../data/edit";
import { planKeys } from "../data/hooks";
import { summaryKeys } from "../summary/hooks";
import { usePlanRunner } from "./runner";
import { showPlanUpdate } from "./update-store";

const NOTHING_ID = "plan-edit-nothing";
const NOTHING_MS = 8000;
let nothingTimer: ReturnType<typeof setTimeout> | undefined;

function flash(registry: StatusRegistry, id: string, spec: Parameters<StatusRegistry["set"]>[2]) {
  registry.set(id, STATUS_PRIORITY.flash, spec);
}

/** How a save ended: the answers could not be saved, the plan could not be updated, or it is done. */
type Outcome =
  { kind: "not-saved" } | { kind: "not-updated" } | { kind: "no-plan" } | { kind: "done" };

/**
 * Saving an edit (P81): the answers go to the profile and the weight goal like the intake saves them, then the
 * plan is re-evaluated with the edited answers by the runner, so only sessions that have not happened yet change.
 * A change shows the "Plan updated" card with See changes and Undo; no change says "Nothing changed". When the
 * answers cannot be saved nothing was changed; when only the update fails the answers are saved and Try again
 * runs the update again.
 */
export function useEditPlan() {
  const registry = useContext(StatusRegistryContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const runner = usePlanRunner();
  const userId = useAuth().session?.user.id ?? "";
  const [failed, setFailed] = useState<{
    kind: "not-saved" | "not-updated";
    retry: () => void;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      save,
      today,
      skipSave,
    }: {
      save: EditSave;
      today: IsoDate;
      skipSave: boolean;
    }): Promise<{ outcome: Outcome; result: RunResult | null }> => {
      if (!skipSave) {
        try {
          await savePlanProfile(userId, save.profilePatch);
        } catch {
          return { outcome: { kind: "not-saved" }, result: null };
        }
        if (save.goal !== undefined) {
          try {
            await saveWeightGoal(save.goal);
          } catch {
            // Without transactions the profile is put back by hand, so "not saved" means nothing changed.
            await savePlanProfile(userId, save.restore.profilePatch).catch(() => undefined);
            return { outcome: { kind: "not-saved" }, result: null };
          }
        }
      }
      const result = await runner.run(today, { edit: save.input.intake });
      if (result.status === "no-plan") return { outcome: { kind: "no-plan" }, result };
      if (result.status === "failed" || result.outcome === "blocked")
        return { outcome: { kind: "not-updated" }, result };
      return { outcome: { kind: "done" }, result };
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: goalKeys.active() }),
      ]),
  });

  function save(edit: EditSave, today: IsoDate, skipSave = false): void {
    setFailed(null);
    mutation.mutate(
      { save: edit, today, skipSave },
      {
        onSuccess: ({ outcome, result }) => {
          if (outcome.kind === "not-saved") {
            setFailed({
              kind: "not-saved",
              retry: () => {
                save(edit, today);
              },
            });
            return;
          }
          if (outcome.kind === "not-updated") {
            // The answers are saved; running the update again is enough.
            setFailed({
              kind: "not-updated",
              retry: () => {
                save(edit, today, true);
              },
            });
            return;
          }
          if (outcome.kind === "no-plan") {
            void navigate("/plan", { replace: true });
            return;
          }
          const change = result?.status === "done" ? result.change : null;
          if (change) {
            showPlanUpdate({ change, restore: edit.restore });
          } else if (registry) {
            flash(registry, NOTHING_ID, {
              tone: "success",
              message: (
                <>
                  <strong className="font-semibold">Nothing changed</strong>
                  <br />
                  Your answers are saved. No session needed a change.
                </>
              ),
              onDismiss: () => {
                flash(registry, NOTHING_ID, null);
              },
            });
            if (nothingTimer !== undefined) clearTimeout(nothingTimer);
            nothingTimer = setTimeout(() => {
              nothingTimer = undefined;
              flash(registry, NOTHING_ID, null);
            }, NOTHING_MS);
          }
          void navigate("/plan");
        },
        onError: () => {
          setFailed({
            kind: "not-updated",
            retry: () => {
              save(edit, today, true);
            },
          });
        },
      },
    );
  }

  useStatusCard(
    "plan-edit-failed",
    STATUS_PRIORITY.error,
    failed
      ? {
          tone: "error",
          message:
            failed.kind === "not-saved" ? (
              <>
                <strong className="font-semibold">Changes not saved</strong>
                <br />
                Nothing was changed and your answers are kept. Try again.
              </>
            ) : (
              <>
                <strong className="font-semibold">Plan not updated</strong>
                <br />
                Your answers are saved, but the plan could not be recalculated. Try again.
              </>
            ),
          action: (
            <button type="button" className={statusActionClass} onClick={failed.retry}>
              Try again
            </button>
          ),
          onDismiss: () => {
            setFailed(null);
          },
        }
      : null,
  );

  return { save, isPending: mutation.isPending };
}
