import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";

// owned by the plan adaptation stream: fill in the "no power data" warning card (R7, P64): four or more
// sessions in the last 28 days without power data, with the way to fix it. Mounted in the app shell.
// Takes no data yet.

/** The "no power data" status card slot. Renders no markup; the card is shown through the status registry. */
export function NoPowerDataWarning() {
  useStatusCard("no-power-data", STATUS_PRIORITY.noPowerData, null);
  return null;
}
