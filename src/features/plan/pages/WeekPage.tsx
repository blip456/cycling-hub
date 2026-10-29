import { useSearchParams } from "react-router";
import { Button } from "@/components/ui";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  formatDuration,
  formatLoad,
  PHASE_TEXT,
  usePlanData,
  weekDays,
  weekNumberOf,
  weekRange,
  weekSummaries,
} from "../data";
import { NoPlanState } from "../components/NoPlan";
import { GRID_QUERY, usePlanLoadErrorCard, useToday } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { DayColumn, DayRow } from "../components/SessionItem";

/** T5, T6, T9: the weekly view with today's card above it (PlanPage), the loading, error and empty states. */
export function WeekPage() {
  const data = usePlanData();
  const today = useToday();
  const grid = useMediaQuery(GRID_QUERY);
  const [params, setParams] = useSearchParams();
  usePlanLoadErrorCard(data.isError, data.refetch);

  if (data.isError) return <PlanLoadError retry={data.refetch} />;
  if (data.isPending) return <PlanSkeleton desktop={grid} />;
  const { plan, sessions } = data;
  if (!plan) return <NoPlanState />;

  const current = Math.min(Math.max(weekNumberOf(plan, today), 1), plan.weeks);
  const asked = Number(params.get("week"));
  const number = Number.isInteger(asked) && asked >= 1 && asked <= plan.weeks ? asked : current;
  const weeks = weekSummaries(plan, sessions);
  const week = weeks[number - 1];
  if (!week) return <PlanLoadError retry={data.refetch} />;

  const environment = plan.intake?.environment ?? "both";
  const days = weekDays(week.startDate, week.sessions, plan.intake?.availableDays ?? [], today);
  const count = week.sessions.filter((s) => s.kind !== "event").length;

  function go(next: number) {
    setParams(next === current ? {} : { week: String(next) });
  }

  return (
    <section aria-labelledby="plan-week">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Button
          variant="secondary"
          aria-label={`Go to week ${String(number - 1)}`}
          aria-disabled={number <= 1}
          onClick={() => {
            if (number > 1) go(number - 1);
          }}
        >
          <span aria-hidden="true">←</span>
          <span className={grid ? "" : "sr-only"}>Week {number - 1}</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <h2 id="plan-week" className="text-[17px] leading-6 font-semibold">
            Week {number} of {plan.weeks} · {PHASE_TEXT[week.phase]}
          </h2>
          <p className="text-[14px] text-muted">{weekRange(week.startDate)}</p>
        </div>
        <Button
          variant="secondary"
          aria-label={`Go to week ${String(number + 1)}`}
          aria-disabled={number >= plan.weeks}
          onClick={() => {
            if (number < plan.weeks) go(number + 1);
          }}
        >
          <span className={grid ? "" : "sr-only"}>Week {number + 1}</span>
          <span aria-hidden="true">→</span>
        </Button>
      </div>
      <p className="mb-3 text-center text-[15px] text-muted">
        {count} {count === 1 ? "session" : "sessions"} · {formatDuration(week.minutes)} · Load{" "}
        {formatLoad(week.load)}
      </p>
      <ol
        aria-label={`Days of week ${String(number)}`}
        className={grid ? "grid grid-cols-7 items-start gap-2" : "flex flex-col gap-1"}
      >
        {days.map((cell) =>
          grid ? (
            <DayColumn key={cell.date} cell={cell} environment={environment} />
          ) : (
            <DayRow key={cell.date} cell={cell} environment={environment} />
          ),
        )}
      </ol>
      {days.some((d) => d.sessions.some((s) => s.strengthNote !== null)) ? (
        <div className="mt-4 rounded-2xl bg-surface px-4 py-3">
          <h3 className="text-[15px] font-semibold">Strength notes</h3>
          <ul className="mt-1 flex flex-col gap-1 text-[14px] text-muted">
            {days.flatMap((d) =>
              d.sessions
                .filter((s) => s.strengthNote !== null)
                .map((s) => (
                  <li key={s.id}>
                    <span className="font-medium text-text">
                      {d.weekday.slice(0, 1).toUpperCase() + d.weekday.slice(1)}:
                    </span>{" "}
                    {s.strengthNote}
                  </li>
                )),
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
