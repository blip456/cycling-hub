import { addDays, isIsoDate, WEEKDAYS, weekdayIndex, type IsoDate, type Weekday } from "./dates";

/**
 * Weekly weight reminder (P46): an in-app status card, shown when the PO has not weighed in for 7 days.
 * Pure; `today` is a Brussels calendar date (`brusselsDate()`), so midnight and daylight saving changes
 * (29 Mar and 25 Oct 2026) cannot move a day.
 */

/** Input of `shouldShowWeightReminder`. */
export type ReminderInput = {
  /** Weigh-in dates; other fields are not needed. Invalid and future dates are ignored. */
  entries: readonly { date: IsoDate }[];
  /** Today as a Brussels date. */
  today: IsoDate;
  /** Day of the week the reminder starts, from Settings. */
  reminderDay: Weekday;
  /** The Settings switch. */
  enabled: boolean;
  /** The date the PO dismissed the card, if any; it stays hidden for that day only. */
  dismissedOn?: IsoDate | null | undefined;
};

/**
 * True when all of these hold, otherwise false (also for any invalid input, never throws):
 * 1. the reminder is enabled;
 * 2. today is on or after the reminder day in the current week (the week runs Monday to Sunday, so with
 *    Wednesday set, Wed to Sun qualify and Mon and Tue do not);
 * 3. no weigh-in is dated within the last 7 days, today and the 6 days before it (an entry dated today
 *    counts; one dated in the future does not);
 * 4. the card was not dismissed today.
 */
export function shouldShowWeightReminder(input: ReminderInput): boolean {
  const { entries, today, reminderDay, enabled, dismissedOn } = input;
  if (!enabled || !isIsoDate(today)) return false;
  const reminderIndex = WEEKDAYS.indexOf(reminderDay);
  const todayIndex = weekdayIndex(today);
  if (reminderIndex === -1 || todayIndex === null || todayIndex < reminderIndex) return false;
  if (dismissedOn === today) return false;
  const windowStart = addDays(today, -6);
  if (windowStart === null) return false;
  return !entries.some((e) => isIsoDate(e.date) && e.date >= windowStart && e.date <= today);
}
