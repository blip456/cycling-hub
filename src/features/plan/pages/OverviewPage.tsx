import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui";
import { diffDays, type IsoDate } from "@/features/athlete";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  formatDay,
  formatDuration,
  formatLoad,
  formatShortDate,
  phaseGroups,
  PHASE_TEXT,
  useActiveWeightGoal,
  useCurrentWeight,
  usePlanData,
  weekNumberOf,
  weekSpan,
  weekSummaries,
  type PhaseGroup,
  type StoredPlan,
  type WeekSummary,
} from "../data";
import { NoPlanState } from "../components/NoPlan";
import { GRID_QUERY, usePlanLoadErrorCard, useToday } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";

function eventText(date: IsoDate, today: IsoDate): string {
  const days = diffDays(today, date);
  const when =
    days === null || days < 0
      ? ""
      : days === 0
        ? ", today"
        : `, in ${String(days)} ${days === 1 ? "day" : "days"}`;
  return `Event: ${formatDay(date)}${when}`;
}

function WeekRow({ week, max, current }: { week: WeekSummary; max: number; current: boolean }) {
  return (
    <li>
      <Link
        to={`/plan?week=${String(week.number)}`}
        aria-current={current ? "true" : undefined}
        aria-label={`Week ${String(week.number)}, ${formatShortDate(week.startDate)}${current ? ", this week" : ""}, ${formatDuration(week.minutes)}, ${PHASE_TEXT[week.phase]}, load ${formatLoad(week.load)}${week.eventDate ? `, event ${formatDay(week.eventDate)}` : ""}`}
        className={
          "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-3.5 py-2 hover:bg-surface-hover " +
          (current ? "border-2 border-accent" : "border-2 border-transparent")
        }
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">
            W{week.number} · {formatShortDate(week.startDate)}
            {current ? " · This week" : ""}
          </span>
          <span className="block text-[13px] text-muted">
            {formatDuration(week.minutes)} · {PHASE_TEXT[week.phase]}
            {week.eventDate ? ` · Event ${formatDay(week.eventDate)}` : ""}
          </span>
        </span>
        <span className="flex items-center gap-2 text-right">
          <span aria-hidden="true" className="h-2.5 w-20 overflow-hidden rounded-full bg-track">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${String(max > 0 ? Math.round((week.load / max) * 100) : 0)}%` }}
            />
          </span>
          <span className="w-9 text-[15px] font-semibold [font-variant-numeric:tabular-nums]">
            {formatLoad(week.load)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function PhaseList({
  groups,
  max,
  current,
}: {
  groups: PhaseGroup[];
  max: number;
  current: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section
          key={`${group.phase}-${String(group.weeks[0]?.number)}`}
          aria-label={`${PHASE_TEXT[group.phase]}, ${weekSpan(group)}`}
        >
          <h3 className="mb-1.5 text-[15px] font-semibold">
            {PHASE_TEXT[group.phase]}{" "}
            <span className="font-normal text-muted">{weekSpan(group)}</span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.weeks.map((week) => (
              <WeekRow key={week.number} week={week} max={max} current={week.number === current} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** T4d: the weekly load as columns under the phase bands. Each column is a link to its week. */
function LoadChart({
  groups,
  max,
  current,
}: {
  groups: PhaseGroup[];
  max: number;
  current: number;
}) {
  return (
    <div>
      <div className="flex gap-1" aria-hidden="true">
        {groups.map((group) => (
          <span
            key={`${group.phase}-${String(group.weeks[0]?.number)}`}
            className="truncate rounded-md bg-subtle px-2 py-1 text-center text-[13px] font-semibold"
            style={{ flexGrow: group.weeks.length, flexBasis: 0 }}
          >
            {group.phase === "recovery" && group.weeks.length === 1
              ? "Rec."
              : PHASE_TEXT[group.phase]}
          </span>
        ))}
      </div>
      <ol className="mt-2 flex h-56 items-end gap-1">
        {groups.flatMap((group) =>
          group.weeks.map((week) => (
            <li key={week.number} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <Link
                to={`/plan?week=${String(week.number)}`}
                aria-current={week.number === current ? "true" : undefined}
                aria-label={`Week ${String(week.number)}, ${PHASE_TEXT[week.phase]}, load ${formatLoad(week.load)}${week.number === current ? ", this week" : ""}`}
                className="flex h-full flex-col justify-end rounded-md"
              >
                <span className="mb-1 text-center text-[13px] [font-variant-numeric:tabular-nums]">
                  {formatLoad(week.load)}
                </span>
                <span
                  aria-hidden="true"
                  className={
                    "block w-full rounded-t-md bg-accent " +
                    (week.number === current ? "outline-2 outline-offset-2 outline-text" : "")
                  }
                  style={{
                    height: `${String(max > 0 ? Math.max(4, Math.round((week.load / max) * 85)) : 4)}%`,
                  }}
                />
              </Link>
            </li>
          )),
        )}
      </ol>
      <ol className="mt-1 flex gap-1" aria-hidden="true">
        {groups.flatMap((group) =>
          group.weeks.map((week) => (
            <li key={week.number} className="min-w-0 flex-1 text-center text-[13px] text-muted">
              W{week.number}
              {week.number === current ? (
                <span className="block font-semibold text-text">This week</span>
              ) : null}
            </li>
          )),
        )}
      </ol>
    </div>
  );
}

function LoadTable({ weeks, id }: { weeks: WeekSummary[]; id: string }) {
  return (
    <div id={id} className="mt-2 overflow-x-auto">
      <table className="w-full text-[15px]">
        <caption className="sr-only">Planned hours and load for each week</caption>
        <thead className="text-left text-[13px] text-muted">
          <tr>
            <th scope="col" className="py-2 pr-2 font-medium">
              Week
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Dates
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Phase
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Hours
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">
              Load
            </th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.number} className="border-t border-border">
              <th scope="row" className="h-11 py-1 pr-2 text-left font-semibold">
                <Link to={`/plan?week=${String(week.number)}`} className="text-accent underline">
                  Week {week.number}
                </Link>
              </th>
              <td className="px-2 py-1">{formatShortDate(week.startDate)}</td>
              <td className="px-2 py-1">{PHASE_TEXT[week.phase]}</td>
              <td className="px-2 py-1 text-right [font-variant-numeric:tabular-nums]">
                {formatDuration(week.minutes)}
              </td>
              <td className="py-1 pl-2 text-right [font-variant-numeric:tabular-nums]">
                {formatLoad(week.load)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The weight card (T4 pin 3): only with weight loss as a purpose; no calories. */
function WeightCard({ plan, today }: { plan: StoredPlan; today: IsoDate }) {
  const weight = useCurrentWeight(today);
  const goal = useActiveWeightGoal();
  const kg = weight.weight;
  const capPercent = plan.intake?.weightRateCapPercent ?? 0.5;
  const cap = kg ? Math.round(((kg.kg * capPercent) / 100) * 10) / 10 : null;
  const target = goal.data ?? plan.intake?.weightGoal ?? null;
  const targetKg = target?.targetKg ?? null;
  const targetDate = target?.targetDate ?? null;
  const perWeek = kg?.perWeek ?? null;
  const pace =
    perWeek === null
      ? "There are not enough weigh-ins for a weekly trend yet."
      : Math.abs(perWeek) < 0.05
        ? "Your trend is flat."
        : `Your trend is ${perWeek < 0 ? "" : "up "}${Math.abs(perWeek).toFixed(1)} kg per week${perWeek < 0 && cap !== null ? (Math.abs(perWeek) <= cap ? `, inside the cap of ${cap.toFixed(1)} kg` : `, above the cap of ${cap.toFixed(1)} kg`) : ""}.`;
  return (
    <section aria-labelledby="plan-weight" className="rounded-2xl bg-surface px-4 py-4">
      <h3 id="plan-weight" className="text-[15px] font-semibold text-muted">
        Weight
      </h3>
      {weight.isPending ? (
        <p className="mt-1 text-[15px] text-muted">Loading your weight.</p>
      ) : weight.isError ? (
        <p className="mt-1 text-[15px] text-muted">Your weight could not be loaded.</p>
      ) : kg ? (
        <>
          <p className="mt-1 text-[20px] leading-7 font-semibold">{kg.kg.toFixed(1)} kg</p>
          <p className="text-[13px] text-muted">7-day average</p>
          <p className="mt-2 text-[15px]">
            {targetKg !== null && targetDate !== null
              ? `Target ${targetKg.toFixed(1)} kg by ${formatDay(targetDate)}. `
              : ""}
            {pace}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[15px] text-muted">
          Log your weight to see the trend next to your plan.
        </p>
      )}
      <Link
        to="/weight/trend"
        className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent underline"
      >
        See weight trend
      </Link>
    </section>
  );
}

/** T4: the overview with 12 weeks as phase groups, the weekly load, the event and (with weight loss) the weight card. */
export function OverviewPage() {
  const data = usePlanData();
  const today = useToday();
  const desktop = useMediaQuery(GRID_QUERY);
  const [table, setTable] = useState(false);
  const tableId = useId();
  usePlanLoadErrorCard(data.isError, data.refetch);

  if (data.isError) return <PlanLoadError retry={data.refetch} />;
  if (data.isPending) return <PlanSkeleton desktop={desktop} />;
  const { plan, sessions } = data;
  if (!plan) return <NoPlanState />;

  const weeks = weekSummaries(plan, sessions);
  const groups = phaseGroups(weeks);
  const max = Math.max(...weeks.map((w) => w.load), 0);
  const raw = weekNumberOf(plan, today);
  const current = raw >= 1 && raw <= plan.weeks ? raw : 0;
  const currentWeek = weeks[current - 1];
  const eventSession = sessions.find((s) => s.kind === "event");
  const showWeight = (plan.intake?.purposes ?? []).slice(0, 2).includes("weight-loss");

  return (
    <section aria-labelledby="plan-overview" className="flex flex-col gap-5">
      <div>
        <h2 id="plan-overview" className="text-xl font-semibold tracking-tight">
          {currentWeek
            ? `Week ${String(current)} of ${String(plan.weeks)} · ${PHASE_TEXT[currentWeek.phase]}`
            : today < plan.startDate
              ? `Starts ${formatDay(plan.startDate)}`
              : `${String(plan.weeks)} weeks`}
        </h2>
        {eventSession ? (
          <p className="text-[15px] text-muted">{eventText(eventSession.date, today)}</p>
        ) : null}
        <p className="text-[15px] text-muted">
          Built from your answers.{" "}
          <Link to="/plan/edit" className="font-semibold text-accent underline">
            Edit plan
          </Link>
        </p>
      </div>
      <div
        className={
          desktop ? "grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-6" : "flex flex-col gap-5"
        }
      >
        <div>
          {desktop ? (
            <>
              <LoadChart groups={groups} max={max} current={current} />
              <p className="mt-3 text-[13px] text-muted">
                Load per week. Recovery and taper weeks are lighter.
                {eventSession ? ` ${eventText(eventSession.date, today)}.` : ""}
              </p>
              <Button
                variant="ghost"
                className="mt-1 -ml-2"
                aria-expanded={table}
                aria-controls={tableId}
                onClick={() => {
                  setTable((t) => !t);
                }}
              >
                {table ? "Hide table" : "Show as table"}
              </Button>
              {table ? <LoadTable weeks={weeks} id={tableId} /> : null}
            </>
          ) : (
            <PhaseList groups={groups} max={max} current={current} />
          )}
        </div>
        {showWeight ? <WeightCard plan={plan} today={today} /> : null}
      </div>
    </section>
  );
}
