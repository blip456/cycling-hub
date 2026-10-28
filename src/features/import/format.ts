import type { ImportRecord } from "./api";

const TIME_ZONE = "Europe/Brussels"; // P6

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "14 Oct 2026, 21:05" in Brussels time. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const localDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "3 May 2019" for a wall-clock `YYYY-MM-DDTHH:MM:SS` (already Brussels time, T5). */
export function formatLocalDate(local: string): string {
  return localDateFormat.format(new Date(`${local.slice(0, 19)}Z`));
}

/** "850 B", "251 kB", "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 new · 1 updated · 0 unchanged", plus the other outcomes when they are not zero (C5). */
export function formatCounts(record: ImportRecord): string {
  const parts = [
    `${record.new_count} new`,
    `${record.updated_count} updated`,
    `${record.unchanged_count} unchanged`,
  ];
  if (record.not_a_ride_count) parts.push(`${record.not_a_ride_count} not a ride`);
  if (record.skipped_count) parts.push(`${record.skipped_count} skipped`);
  if (record.deleted_earlier_count) parts.push(`${record.deleted_earlier_count} deleted earlier`);
  return parts.join(" · ");
}

export function formatActivityCount(n: number): string {
  return plural(n, "activity", "activities");
}

export function formatImportCount(n: number): string {
  return plural(n, "import", "imports");
}
