/** Words for the adaptation screens. Pure. */
import type { SessionChange } from "../engine";
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
