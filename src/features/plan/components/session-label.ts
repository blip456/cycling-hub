import type { Intake } from "../engine";
import {
  formatDay,
  formatLoad,
  placeOf,
  spokenDuration,
  STATUS_TEXT,
  weekdayName,
  type PlanSession,
} from "../data";

/** "Wednesday 28 October, today, Threshold 3 by 12 minutes, 1 hour 15, load 82, indoor, planned". */
export function sessionAriaLabel(
  session: PlanSession,
  environment: Intake["environment"],
  today: boolean,
): string {
  const place = placeOf(session, environment);
  return [
    `${weekdayName(session.date)} ${formatDay(session.date).split(" ").slice(1).join(" ")}`,
    today ? "today" : null,
    session.title,
    spokenDuration(session.durationMin),
    session.kind === "event" ? null : `load ${formatLoad(session.load)}`,
    place,
    STATUS_TEXT[session.status].toLowerCase(),
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}
