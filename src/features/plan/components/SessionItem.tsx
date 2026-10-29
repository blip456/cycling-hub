import { Link } from "react-router";
import type { Intake } from "../engine";
import {
  formatDay,
  sessionFactParts,
  sessionFacts,
  STATUS_TEXT,
  type DayCell,
  type PlanSession,
} from "../data";
import { ActionsMenu } from "./SessionActions";
import { sessionAriaLabel } from "./session-label";

const STATUS_MARK: Record<PlanSession["status"], string> = {
  planned: "",
  done: "✓ ",
  missed: "! ",
  skipped: "– ",
};

/** The status as text (never colour alone): "✓ Done", "– Skipped", "Planned". */
export function StatusText({ status }: { status: PlanSession["status"] }) {
  return (
    <span className="text-[13px] font-medium text-muted">
      <span aria-hidden="true">{STATUS_MARK[status]}</span>
      {STATUS_TEXT[status]}
    </span>
  );
}

/** One session as a row (phone) or a card (desktop week grid): the whole body opens the session (T7), the menu acts (T8a). */
export function SessionItem({
  session,
  environment,
  isToday,
  layout = "row",
}: {
  session: PlanSession;
  environment: Intake["environment"];
  isToday: boolean;
  layout?: "row" | "card";
}) {
  const card = layout === "card";
  return (
    <div
      className={
        "rounded-xl bg-surface hover:bg-surface-hover " +
        (card ? "flex flex-col" : "flex items-start")
      }
    >
      <Link
        to={`/plan/session/${session.id}`}
        aria-label={sessionAriaLabel(session, environment, isToday)}
        className="flex min-h-14 min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-3.5 py-2.5"
      >
        <span className="text-[15px] leading-5 font-semibold [overflow-wrap:anywhere]">
          {session.title}
        </span>
        {card ? (
          sessionFactParts(session, environment).map((part) => (
            <span key={part} className="text-[13px] text-muted">
              {part}
            </span>
          ))
        ) : (
          <span className="text-[13px] text-muted">{sessionFacts(session, environment)}</span>
        )}
        <StatusText status={session.status} />
      </Link>
      <div className={card ? "flex justify-end px-1 pb-1" : ""}>
        <ActionsMenu session={session} />
      </div>
    </div>
  );
}

/** A day of the week list (T5 phone): the day, a Today marker, then its sessions or "Rest day". */
export function DayRow({
  cell,
  environment,
}: {
  cell: DayCell;
  environment: Intake["environment"];
}) {
  const [weekday = "", ...date] = formatDay(cell.date).split(" ");
  return (
    <li
      className={
        "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-2xl p-2 " +
        (cell.isToday ? "border-2 border-accent bg-accent-soft" : "border-2 border-transparent")
      }
    >
      <div className="pt-2.5 pl-1.5 text-[15px]">
        <p className="font-semibold">{weekday}</p>
        <p className="text-[13px] text-muted">{date.join(" ")}</p>
        {cell.isToday ? <p className="text-[13px] font-semibold">Today</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {cell.sessions.length === 0 ? (
          <p className="pt-2.5 text-[15px] text-muted">
            {cell.trainingDay ? "Rest day" : "Rest day (not one of your training days)"}
          </p>
        ) : (
          cell.sessions.map((s) => (
            <SessionItem key={s.id} session={s} environment={environment} isToday={cell.isToday} />
          ))
        )}
      </div>
    </li>
  );
}

/** A day column of the desktop week grid (T5d). */
export function DayColumn({
  cell,
  environment,
}: {
  cell: DayCell;
  environment: Intake["environment"];
}) {
  const [weekday = "", ...date] = formatDay(cell.date).split(" ");
  return (
    <li
      className={
        "flex min-w-0 flex-col gap-2 rounded-2xl p-2 " +
        (cell.isToday ? "border-2 border-accent bg-accent-soft" : "border-2 border-transparent")
      }
    >
      <div className="px-1.5 pt-1">
        <p className="text-[15px] font-semibold">
          {weekday} <span className="font-normal text-muted">{date.join(" ")}</span>
        </p>
        {cell.isToday ? <p className="text-[13px] font-semibold">Today</p> : null}
      </div>
      {cell.sessions.length === 0 ? (
        <p className="px-1.5 text-[14px] text-muted">Rest day</p>
      ) : (
        cell.sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            environment={environment}
            isToday={cell.isToday}
            layout="card"
          />
        ))
      )}
    </li>
  );
}
