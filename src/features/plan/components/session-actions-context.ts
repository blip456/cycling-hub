import { createContext, useContext } from "react";
import type { PlanActions, PlanSession } from "../data";

export type SessionActionsValue = {
  actions: PlanActions;
  askMove: (session: PlanSession) => void;
  askSkip: (session: PlanSession) => void;
};

export const SessionActionsContext = createContext<SessionActionsValue | null>(null);

export function useSessionActions(): SessionActionsValue {
  const value = useContext(SessionActionsContext);
  if (!value) throw new Error("Session actions need a <SessionActionsProvider>");
  return value;
}

/** Whether a session can be marked, moved or skipped: only one that is still open. */
export function canAct(session: PlanSession): boolean {
  return session.kind !== "event" && (session.status === "planned" || session.status === "missed");
}
