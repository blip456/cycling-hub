import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";

// owned by the plan adaptation stream: fill in the "Plan updated" card (R3, P71): the message, See changes
// (/plan/changes) and Undo. Mounted in the app shell, so it shows on every page. Takes no data yet.

/** The "Plan updated" status card slot. Renders no markup; the card is shown through the status registry. */
export function PlanUpdatedCard() {
  useStatusCard("plan-updated", STATUS_PRIORITY.planUpdated, null);
  return null;
}
