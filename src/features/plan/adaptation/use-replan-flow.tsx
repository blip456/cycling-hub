import { useCallback, useEffect, useState } from "react";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { useReplan, type ReplanOutcome } from "./hooks";

const FOLLOW_UP_MS = 6000;

type Answer = ReplanOutcome | "failed" | null;

const MESSAGES: Record<Exclude<Answer, null | "updated">, [title: string, text: string]> = {
  unchanged: ["Plan already up to date", "Re-planned with the current engine. No session changed."],
  blocked: ["Plan not changed", "The plan needs an FTP and at least two riding days first."],
  "no-plan": ["No plan to re-plan", "Create a plan first."],
  failed: ["Re-plan failed", "Check your connection and try again."],
};

/**
 * "Re-plan now" with its answer as a status card at the bottom of the page (P12). A re-plan that changes
 * sessions is answered by the "Plan updated" card (with Undo), so this card only speaks when nothing changed
 * or when it did not work.
 */
export function useReplanFlow(): { replan: () => void; isPending: boolean } {
  const mutation = useReplan();
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

  const message = answer === null || answer === "updated" ? null : MESSAGES[answer];
  useStatusCard(
    "plan-replan",
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
