import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";

// owned by weight stream: fill in the data and the card (W3, P52). The slot itself is already mounted once
// in AppShell, so no shell file needs to change.

/**
 * The weight reminder slot (P12, P31, P52). Mounted in the app shell, so the card shows on every page: at
 * the bottom of the page on the phone and at the bottom of the side menu on desktop, with the same
 * priority rules as every status card (it goes before "What's new", W-PO4). It takes no data yet and
 * never shows a card: pass a spec to `useStatusCard` once the weight data and the rule in
 * `shouldShowWeightReminder` (src/features/athlete/reminder.ts) are wired.
 */
export function WeightReminder() {
  useStatusCard("weight-reminder", STATUS_PRIORITY.weightReminder, null);
  return null;
}
