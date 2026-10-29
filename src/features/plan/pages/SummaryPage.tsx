import { SummaryScreen } from "../summary/SummaryScreen";

/**
 * R11: summary of a session, a week or a month to copy into an AI chat. The address picks the subject:
 * `/plan/summary?type=session&id=<planned session id>`, `?type=week&date=YYYY-MM-DD` (any day of the week)
 * or `?type=month&date=YYYY-MM-DD`. Without parameters it is this week.
 */
export function SummaryPage() {
  return <SummaryScreen />;
}
