import { Link } from "react-router";
import type { IsoDate } from "@/features/athlete";
import { useToday } from "../components/page-hooks";
import {
  daysToEvent,
  formatDay,
  PHASE_TEXT,
  type PlanSession,
  type StoredPlan,
  type WeekSummary,
} from "../data";
import { sessionWeightLine, weekReason } from "./reasons";
import { useWeightFacts } from "./use-weight-facts";

/**
 * R9 and R8b: the "Why this week" card above a week. It only appears when the weight or the taper changed
 * the week; the weight lines name the numbers and then what the plan does.
 */
export function WeekReasonCard({
  plan,
  week,
  weeks,
  isCurrent,
}: {
  plan: StoredPlan;
  week: WeekSummary;
  weeks: readonly WeekSummary[];
  isCurrent: boolean;
}) {
  const today = useToday();
  const weight = useWeightFacts(today);
  const reason = weekReason({
    week,
    weeks,
    isCurrent,
    weight,
    purposes: plan.intake?.purposes ?? [],
  });
  if (!reason) return null;
  return (
    <section aria-labelledby="plan-why-week" className="mb-4 rounded-2xl bg-surface px-4 py-3.5">
      <h3 id="plan-why-week" className="text-[15px] font-semibold">
        Why this week
      </h3>
      <div className="mt-1 flex flex-col gap-1 text-[15px]">
        {reason.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}

/** R9b: the reasons of one session, in a fixed order, only those that apply (up to four). */
export function SessionReasons({ session, plan }: { session: PlanSession; plan: StoredPlan }) {
  const today = useToday();
  const weight = useWeightFacts(today);
  const weightLine = weight ? sessionWeightLine(weight, session.week) : null;
  const both = plan.intake?.environment === "both";
  const lines = [
    session.reason,
    weightLine,
    both && session.kind !== "event"
      ? "Where: indoor or outdoor, same targets (you ride both)."
      : null,
  ].filter((line): line is string => line !== null && line !== "");
  return (
    <ol className="flex max-w-[65ch] list-decimal flex-col gap-1 pl-5 text-[15px]">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ol>
  );
}

/**
 * R8: the event card on the overview: name, date, days to go and what the taper does. Change goes to the
 * Event section of the profile. Only when the plan has an event.
 */
export function EventCard({
  plan,
  sessions,
  weeks,
  today,
}: {
  plan: StoredPlan;
  sessions: readonly PlanSession[];
  weeks: readonly WeekSummary[];
  today: IsoDate;
}) {
  const eventSession = sessions.find((s) => s.kind === "event");
  const event = plan.intake?.event;
  if (!eventSession) return null;
  const days = daysToEvent(sessions, today);
  const taper = weeks.filter((w) => w.phase === "taper").map((w) => w.number);
  const first = taper[0];
  const last = taper[taper.length - 1];
  const taperName =
    first === undefined
      ? null
      : first === last
        ? `Week ${String(first)}`
        : `Weeks ${String(first)} to ${String(last)}`;
  return (
    <section aria-labelledby="plan-event" className="rounded-2xl bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 id="plan-event" className="text-[17px] font-semibold [overflow-wrap:anywhere]">
          {event?.name ?? "Event"}
        </h3>
        <Link
          to="/profile"
          className="inline-flex min-h-11 items-center font-semibold text-accent underline"
        >
          Change<span className="sr-only"> the event in your profile</span>
        </Link>
      </div>
      <p className="text-[15px]">
        {formatDay(eventSession.date)}
        {days === null || days < 0
          ? ""
          : days === 0
            ? " · today"
            : ` · ${String(days)} ${days === 1 ? "day" : "days"} to go`}
      </p>
      <p className="mt-2 text-[15px] text-muted">
        The plan is built backwards from this date.
        {taperName
          ? ` ${taperName} ${first === last ? "is" : "are"} the ${PHASE_TEXT.taper.toLowerCase()}: fewer and shorter sessions, a few short efforts to stay sharp.`
          : ""}
      </p>
    </section>
  );
}
