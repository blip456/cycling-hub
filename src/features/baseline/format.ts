import type { IsoDate } from "@/features/athlete";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatParts(date: IsoDate): Record<string, string> {
  return Object.fromEntries(
    parts.formatToParts(new Date(`${date}T00:00:00Z`)).map((p) => [p.type, p.value]),
  );
}

/** "Sun 11 Oct 2026" for a calendar date (YYYY-MM-DD), shown as stored (no time zone maths). */
export function formatDate(date: IsoDate): string {
  const p = formatParts(date);
  return `${p["weekday"]} ${p["day"]} ${p["month"]} ${p["year"]}`;
}

/** "Sat 31 Oct", for a session in a list. */
export function formatShortDate(date: IsoDate): string {
  const p = formatParts(date);
  return `${p["weekday"]} ${p["day"]} ${p["month"]}`;
}

/** "4 May 2026", for the span of a search. */
export function formatDayMonthYear(date: IsoDate): string {
  const p = formatParts(date);
  return `${p["day"]} ${p["month"]} ${p["year"]}`;
}

/** "Sun 25 Oct 2026 · 08:30" from a ride's `start_local` (Brussels wall-clock time). */
export function formatRideStart(startLocal: string): string {
  return `${formatDate(startLocal.slice(0, 10))} · ${startLocal.slice(11, 16)}`;
}

/** "2:05" (h:mm). */
export function formatHoursMinutes(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  return `${String(Math.floor(totalMinutes / 60))}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

/** "64.2" (km, one decimal). */
export function formatKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}
