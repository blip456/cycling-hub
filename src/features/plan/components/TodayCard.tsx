import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { Button } from "@/components/ui";
import { addDays } from "@/features/athlete";
import {
  formatDay,
  formatDuration,
  formatLoad,
  mainSetLine,
  nextSession,
  PHASE_TEXT,
  sessionFacts,
  todayCard,
  usePlanData,
  weekNumberOf,
  type PlanSession,
} from "../data";
import { useToday } from "./page-hooks";
import { ActionsMenu } from "./SessionActions";
import { canAct, useSessionActions } from "./session-actions-context";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <article aria-label="Today's session" className="mb-5 rounded-2xl bg-surface px-4 py-4 lg:px-5">
      <h2 className="text-[15px] font-semibold text-muted">{title}</h2>
      {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      {children}
    </article>
  );
}

function OpenCard({ session, more }: { session: PlanSession; more: number }) {
  const { plan } = usePlanData();
  const { actions } = useSessionActions();
  const environment = plan?.intake?.environment ?? "both";
  const line = mainSetLine(session);
  return (
    <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <p className="text-[20px] leading-7 font-semibold [overflow-wrap:anywhere]">
          {session.title}
        </p>
        <p className="text-[15px] text-muted">{sessionFacts(session, environment)}</p>
        {line ? <p className="mt-1 text-[15px]">{line}</p> : null}
        {more > 0 ? (
          <p className="mt-1 text-[15px]">
            <Link
              to={`/plan?week=${String(session.week)}`}
              className="font-semibold text-accent underline"
            >
              and {more === 1 ? "one more" : `${String(more)} more`} today
            </Link>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link to={`/plan/session/${session.id}`} className={buttonClass("primary")}>
          Open session
        </Link>
        {canAct(session) ? (
          <Button
            variant="secondary"
            onClick={() => {
              actions.markDone(session);
            }}
          >
            Mark as done
          </Button>
        ) : null}
        <ActionsMenu session={session} />
      </div>
    </div>
  );
}

/** T6: today's session on top of the Plan page. A card of the page, not a toast, so it has no timeout. */
export function TodayCard() {
  const { plan, sessions } = usePlanData();
  const today = useToday();
  if (!plan) return null;
  const card = todayCard(plan, sessions, today);
  const heading = `Today · ${formatDay(today)}`;

  if (card.kind === "before")
    return (
      <Card title={heading}>
        <p className="mt-1 text-[17px] font-semibold">
          Your plan starts {formatDay(card.startDate)}
        </p>
        <p className="text-[15px] text-muted">Nothing is planned before then.</p>
      </Card>
    );

  if (card.kind === "after")
    return (
      <Card title={heading}>
        <p className="mt-1 text-[17px] font-semibold">Your plan has ended</p>
        <p className="mb-3 text-[15px] text-muted">
          The last day was {formatDay(addDays(plan.startDate, plan.weeks * 7 - 1) ?? today)}.
        </p>
        <Link to="/plan/new" className={buttonClass("secondary")}>
          Create a new plan
        </Link>
      </Card>
    );

  if (card.kind === "rest") {
    const next = card.next ?? nextSession(sessions, today);
    return (
      <Card title={heading}>
        <p className="mt-1 text-[20px] leading-7 font-semibold">Rest day</p>
        <p className="text-[15px] text-muted">
          {next
            ? `Nothing planned. Next: ${formatDay(next.date)}, ${next.title}, ${formatDuration(next.durationMin)}.`
            : "Nothing planned."}
        </p>
      </Card>
    );
  }

  if (card.kind === "done")
    return (
      <Card title={heading}>
        <p className="mt-1 text-[20px] leading-7 font-semibold">
          <span aria-hidden="true">✓ </span>Done: {card.session.title}
        </p>
        <p className="mb-3 text-[15px] text-muted">
          Marked as done. {formatDuration(card.session.durationMin)}, load{" "}
          {formatLoad(card.session.load)}.
        </p>
        <Link to={`/plan/session/${card.session.id}`} className={buttonClass("secondary")}>
          Open session
        </Link>
      </Card>
    );

  const week = weekNumberOf(plan, today);
  const phase = PHASE_TEXT[card.session.phase];
  return (
    <Card title={heading} subtitle={`Week ${String(week)} · ${phase}`}>
      <OpenCard session={card.session} more={card.more} />
    </Card>
  );
}
