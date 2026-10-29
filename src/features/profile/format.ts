import { diffDays, type IsoDate } from "@/features/athlete";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "Sat 12 Dec 2026"; the input text when it is not a date. */
export function formatLongDate(date: IsoDate): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const value = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAY[value.getUTCDay()] ?? ""} ${value.getUTCDate()} ${MONTH[value.getUTCMonth()] ?? ""} ${value.getUTCFullYear()}`;
}

/** The countdown as text (R1: no progress ring): "45 days from today.", "Tomorrow.", "Today.", "The date has passed.". */
export function countdownText(today: IsoDate, date: IsoDate): string {
  const days = diffDays(today, date);
  if (days === null) return "";
  if (days < 0) return "The date has passed.";
  if (days === 0) return "Today.";
  if (days === 1) return "Tomorrow.";
  return `${days} days from today.`;
}

/** Hours with a half hour as a decimal: "6 h", "6.5 h". */
export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}
