import { isIsoDate, type IsoDate } from "@/features/athlete";

const KEY = "cycling-hub:weight-reminder-dismissed-on";

/** The Brussels date on which "Not now" was pressed, or null (never, or storage is not available). */
export function readDismissedOn(): IsoDate | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return isIsoDate(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers "Not now" for that day only: the card is back tomorrow (W-PO1, P52). */
export function storeDismissedOn(date: IsoDate): void {
  try {
    window.localStorage.setItem(KEY, date);
  } catch {
    // Storage is blocked: the card is hidden for this visit only.
  }
}
