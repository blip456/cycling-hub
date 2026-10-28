import { addDays, isIsoDate, WEEKDAYS, weekdayIndex, type IsoDate, type Weekday } from "./dates";

/**
 * Weekly weight reminder (P46): an in-app status card, shown from the reminder day until a weight is logged on or after it.
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
 * 2. the reminder is due: the card is due from the most recent reminder day (today or up to 6 days back)
 *    and nothing is dated on or after that day. It keeps showing, also into the next week, until a weight
 *    is logged; a weight logged before the reminder day does not clear it, so the day setting decides when
 *    the weekly card appears;
 * 3. the card was not dismissed today ("Not now" hides it until tomorrow).
 * An entry dated in the future does not count.
 */
export function shouldShowWeightReminder(input: ReminderInput): boolean {
  const { entries, today, reminderDay, enabled, dismissedOn } = input;
  if (!enabled || !isIsoDate(today)) return false;
  const todayIndex = weekdayIndex(today);
  const dayIndex = WEEKDAYS.indexOf(reminderDay);
  if (todayIndex === null || dayIndex < 0) return false;
  if (dismissedOn === today) return false;
  const dueSince = addDays(today, -((todayIndex - dayIndex + 7) % 7));
  if (dueSince === null) return false;
  return !entries.some((e) => isIsoDate(e.date) && e.date >= dueSince && e.date <= today);
}
