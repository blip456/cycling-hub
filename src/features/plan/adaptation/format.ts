/** Words for the adaptation screens. Pure. */
import type { PlanSettings, SessionChange } from "../engine";
import type { UpdateEffect } from "../adapt";
import { formatDuration, kindName } from "../data";

const UPDATED = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Brussels",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Wed 28 Oct, 09:12" in Brussels time, 24 hours. */
export function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(UPDATED.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts["weekday"] ?? ""} ${parts["day"] ?? ""} ${parts["month"] ?? ""}, ${parts["hour"] ?? ""}:${parts["minute"] ?? ""}`;
}

type Summary = NonNullable<SessionChange["before"]>;

/** "Sweet spot 2 x 12 min, 65 min" or "Endurance, 60 min" for one side of a change. */
export function summaryText(summary: Summary): string {
  const set = summary.mainSet;
  const sprint = set?.endsWith("s") === true;
  const sets =
    set && summary.kind !== "openers"
      ? ` ${set.replace("s", "").replace("x", " x ")} ${sprint ? "s" : "min"}`
      : "";
  return `${kindName(summary.kind)}${sets}, ${formatDuration(summary.durationMin)}`;
}

/** The change as a short title: "Thu 29 Oct: Endurance 60 min" is built by the caller from the date. */
export function changeKind(change: SessionChange): string {
  const side = change.after ?? change.before;
  return side ? kindName(side.kind) : "";
}

function signed(value: number, unit: string): string {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${String(Math.abs(value))}${unit}`;
}

/** "+1 h 10 min" or "-25 min" for a difference in minutes; "no change" for zero. */
function minutesDelta(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return "no change";
  const abs = Math.abs(rounded);
  const text =
    abs >= 60
      ? `${String(Math.floor(abs / 60))} h${abs % 60 ? ` ${String(abs % 60)} min` : ""}`
      : `${String(abs)} min`;
  return `${rounded > 0 ? "+" : "-"}${text}`;
}

/**
 * One sentence on what an update does to the weeks it touched: riding time, load, hard sessions and VO2
 * minutes. "Only the targets changed" when the totals do not move.
 */
export function effectSentence(effect: UpdateEffect | undefined): string | null {
  if (!effect) return null;
  const { before, after } = effect.total;
  const parts: string[] = [];
  const minutes = Math.round(after.minutes - before.minutes);
  if (minutes !== 0) parts.push(`${minutesDelta(minutes)} riding`);
  const load = Math.round(after.load - before.load);
  if (load !== 0 && before.load > 0) {
    parts.push(`load ${signed(Math.round((load / before.load) * 100), " %")}`);
  }
  const hard = after.hard - before.hard;
  if (hard !== 0) parts.push(`${signed(hard, "")} hard session${Math.abs(hard) === 1 ? "" : "s"}`);
  const above = Math.round(after.aboveMinutes - before.aboveMinutes);
  if (above !== 0) parts.push(`${signed(above, "")} min above 105 % of FTP`);
  const weeks = effect.weeks.length === 1 ? "1 week" : `${String(effect.weeks.length)} weeks`;
  return parts.length === 0
    ? `In the ${weeks} that changed, hours, load and hard sessions stay the same; only the targets and the layout moved.`
    : `In the ${weeks} that changed: ${parts.join(", ")}.`;
}

/** The settings in effect as words, for the changes page: "Zone 2 at 70 % of FTP, balanced intensity". */
export function settingsSummary(settings: PlanSettings | undefined): string {
  if (!settings) return "";
  const parts: string[] = [];
  if (settings.zone2TargetPercent !== undefined) {
    parts.push(`Zone 2 at ${String(settings.zone2TargetPercent)} % of FTP`);
  }
  if (settings.intensityBalance && settings.intensityBalance !== "base") {
    parts.push(`${settings.intensityBalance === "high" ? "high" : "balanced"} intensity`);
  }
  if (settings.maxLongRideMin !== undefined) {
    parts.push(`long rides up to ${String(settings.maxLongRideMin)} min`);
  }
  if (settings.maxHoursPerWeek !== undefined) {
    parts.push(`up to ${String(settings.maxHoursPerWeek)} h a week`);
  }
  return parts.length === 0 ? "the defaults" : parts.join(", ");
}
