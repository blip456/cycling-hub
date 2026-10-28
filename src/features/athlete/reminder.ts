import { addDays, isIsoDate, WEEKDAYS, weekdayIndex, type IsoDate, type Weekday } from "./dates";

/**
 * Weekly weight reminder (P46): an in-app status card, shown from the reminder day until a weight is logged (nothing in the last 7 days).
 * Pure; `today` is a Brussels calendar date (`brusselsDate()`), so midnight and daylight saving changes
 * (29 Mar and 25 Oct 2026) cannot move a day.
 */

/** Input of `shouldShowWeightReminder`. */
export type ReminderInput = {
  /** Weigh-in dates; other fields are not needed. Invalid and future dates are ignored. */
  entries: readonly { date: IsoDate }[];
  /** Today as a Brussels date. */
  today: IsoDate;
  /** Day of the week the reminder is due, from Settings (database number via `weekdayFromDb`). */
  reminderDay: Weekday;
  /** The Settings switch. */
  enabled: boolean;
  /** The date the PO dismissed the card, if any; it stays hidden for that day only. */
  dismissedOn?: IsoDate | null | undefined;
};

/**
 * True when all of these hold, otherwise false (also for any invalid input, never throws):
 * 1. the reminder is enabled;
 * 2. the reminder day has passed, this week or an earlier one. The card does not wait for the same week:
 *    once it is due it keeps showing until a weight is logged. Because the previous occurrence of any
 *    weekday is at most 7 days back, this always holds for a valid day; the check only rejects an invalid
 *    `reminderDay`. The day setting therefore marks when the weekly card is first due, and rule 3 decides
 *    how long it stays away after a weigh-in;
 * 3. no weigh-in is dated within the last 7 days, today and the 6 days before it (an entry dated today
 *    counts; one dated in the future does not);
 * 4. the card was not dismissed today ("Not now" hides it until tomorrow).
 */
export function shouldShowWeightReminder(input: ReminderInput): boolean {
  const { entries, today, reminderDay, enabled, dismissedOn } = input;
  if (!enabled || !isIsoDate(today)) return false;
  if (!WEEKDAYS.includes(reminderDay) || weekdayIndex(today) === null) return false;
  if (dismissedOn === today) return false;
  const windowStart = addDays(today, -6);
  if (windowStart === null) return false;
  return !entries.some((e) => isIsoDate(e.date) && e.date >= windowStart && e.date <= today);
}
