/** Texts for the export page. */
import type { Progress } from "./exporter";

export function timeLeft(seconds: number): string {
  if (seconds < 60) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"} left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursText = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0
    ? `about ${hoursText} left`
    : `about ${hoursText} ${rest} minute${rest === 1 ? "" : "s"} left`;
}

export function progressText(progress: Progress): string {
  if (progress.phase === "list") {
    return progress.total === null
      ? `Reading activities: ${progress.read}`
      : `Reading activities: ${progress.read} of ${progress.total}`;
  }
  if (progress.done >= progress.total) {
    return `Downloading ride details: ${progress.done} of ${progress.total}`;
  }
  return `Downloading ride details: ${progress.done} of ${progress.total}, ${timeLeft(progress.secondsLeft)}`;
}
