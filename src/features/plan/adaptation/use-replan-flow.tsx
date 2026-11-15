import { useCallback, useEffect, useState } from "react";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { useRunPlan, type ReplanOutcome } from "./hooks";

const FOLLOW_UP_MS = 6000;

type Answer = ReplanOutcome | "failed" | null;

type Messages = Record<Exclude<Answer, null | "updated">, [title: string, text: string]>;

const MESSAGES: Messages = {
  unchanged: ["Plan already up to date", "Re-planned with the current engine. No session changed."],
  blocked: ["Plan not changed", "The plan needs an FTP and at least two riding days first."],
  "no-plan": ["No plan to re-plan", "Create a plan first."],
  failed: ["Re-plan failed", "Check your connection and try again."],
};

/** After saving training settings: the answer says what the settings did to the plan, also when nothing. */
const SETTINGS_MESSAGES: Messages = {
  unchanged: [
    "Plan not changed",
    "Your settings are saved. No session in your plan changes with them.",
  ],
  blocked: [
    "Settings saved",
    "The plan needs an FTP and at least two riding days before it can use them.",
  ],
  "no-plan": ["Settings saved", "You have no plan yet. They are used when you create one."],
  failed: [
    "Plan not updated",
    "Your settings are saved, but the plan could not be updated. Use Re-plan now in the plan menu to try again.",
  ],
};

/**
 * "Re-plan now" with its answer as a status card at the bottom of the page (P12). A re-plan that changes
 * sessions is answered by the "Plan updated" card (with Undo), so this card only speaks when nothing changed
 * or when it did not work.
 */
export function useReplanFlow(): { replan: () => void; isPending: boolean } {
  return usePlanRunFlow("replan");
}

/**
 * The same flow for the run after saving training settings (`mode` "settings"): the Profile section keeps
 * it mounted, so the answer stays on the page after the form closes.
 */
export function usePlanRunFlow(mode: "replan" | "settings"): {
  replan: () => void;
  isPending: boolean;
} {
  const mutation = useRunPlan(mode);
  const [answer, setAnswer] = useState<Answer>(null);
  const { mutate } = mutation;

  useEffect(() => {
    if (answer === null) return undefined;
    const timer = setTimeout(() => {
      setAnswer(null);
    }, FOLLOW_UP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [answer]);

  const replan = useCallback(() => {
    setAnswer(null);
    mutate(undefined, {
      onSuccess: (outcome) => {
        setAnswer(outcome === "updated" ? null : outcome);
      },
      onError: () => {
        setAnswer("failed");
      },
    });
  }, [mutate]);

  const table = mode === "settings" ? SETTINGS_MESSAGES : MESSAGES;
  const message = answer === null || answer === "updated" ? null : table[answer];
  useStatusCard(
    mode === "settings" ? "plan-settings-run" : "plan-replan",
    answer === "failed" ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    message
      ? {
          tone: answer === "failed" ? "error" : "info",
          message: (
            <>
              <strong className="font-semibold">{message[0]}</strong>
              <br />
              {message[1]}
            </>
          ),
          onDismiss: () => {
            setAnswer(null);
          },
        }
      : null,
  );

  return { replan, isPending: mutation.isPending };
}
