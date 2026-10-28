/** Today's date in Brussels (P6) as YYYY-MM-DD. */
export function brusselsDate(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "cycling-hub-rides-2026-10-27.csv". */
export function exportFileName(extension: "csv" | "json", now: Date = new Date()): string {
  return `cycling-hub-rides-${brusselsDate(now)}.${extension}`;
}

/** Saves `content` as a file through a temporary object URL and a download link. */
export function downloadFile(content: string, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
