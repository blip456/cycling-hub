import { Link, useParams } from "react-router";
import { Button } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  formatDay,
  formatDuration,
  formatLoad,
  PHASE_TEXT,
  placeOf,
  STATUS_TEXT,
  usePlanSession,
} from "../data";
import { MissedSession } from "../adaptation/MissedSession";
import { SessionReasons } from "../adaptation/ReasonCards";
import { NoPlanState } from "../components/NoPlan";
import { GRID_QUERY, usePlanLoadErrorCard } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { Segmented } from "../components/Segmented";
import { canAct, useSessionActions } from "../components/session-actions-context";
import { StepList } from "../components/StepList";

const PLACE_HELP =
  "Indoor: hold the watts; heart rate runs higher indoors, so go by watts first. Outdoor: pick a road where you can hold the work steps; use heart rate as a back-up.";

/** T7: where the session is ridden, a two-segment choice with radio semantics. Starts on what the plan chose (P62). */
function PlaceChoice({
  value,
  onChange,
}: {
  value: "indoor" | "outdoor" | null;
  onChange: (indoor: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-caption font-semibold">Where do you ride it?</p>
      <Segmented
        label="Where do you ride it?"
        options={[
          { value: "indoor", label: "Indoor" },
          { value: "outdoor", label: "Outdoor" },
        ]}
        value={value}
        onChange={(place) => {
          onChange(place === "indoor");
        }}
        className="sm:max-w-xs"
      />
      <p className="mt-1.5 max-w-[60ch] text-caption text-muted">{PLACE_HELP}</p>
    </div>
  );
}

/** T7 and T8: the session detail at /plan/session/:id, with mark done, move and skip. */
export function SessionPage() {
  const { id } = useParams();
  const data = usePlanSession(id);
  const { actions, askMove, askSkip } = useSessionActions();
  const desktop = useMediaQuery(GRID_QUERY);
  usePlanLoadErrorCard(data.isError, data.refetch);

  if (data.isError) return <PlanLoadError retry={data.refetch} />;
  if (data.isPending) return <PlanSkeleton desktop={false} />;
  const { plan, session } = data;
  if (!plan) return <NoPlanState />;
  if (!session)
    return (
      <section
        aria-labelledby="plan-session-gone"
        className="max-w-[560px] rounded-lg bg-surface p-4"
      >
        <h2 id="plan-session-gone" className="text-body-lg font-semibold">
          This session is no longer in your plan
        </h2>
        <p className="mt-1 mb-3 text-body text-muted">
          It may have been replaced when the plan changed.
        </p>
        <Link to="/plan" className={buttonClass("secondary")}>
          Back to the week
        </Link>
      </section>
    );

  const environment = plan.intake?.environment ?? "both";
  const place = placeOf(session, environment);
  const open = canAct(session);
  const event = session.kind === "event";

  const missed = session.status === "missed" && !event;
  const buttons =
    open && !missed ? (
      <div className="flex flex-col gap-3">
        <Button
          block
          onClick={() => {
            actions.markDone(session);
          }}
        >
          Mark as done
        </Button>
        <Button
          block
          variant="secondary"
          onClick={() => {
            askMove(session);
          }}
        >
          Move to another day
        </Button>
        <Button
          block
          variant="secondary"
          onClick={() => {
            askSkip(session);
          }}
        >
          Skip
        </Button>
      </div>
    ) : null;

  return (
    <article
      aria-labelledby="plan-session-title"
      className={desktop ? "grid grid-cols-[minmax(0,1fr)_15rem] items-start gap-8" : ""}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <header>
          <h2 id="plan-session-title" className="text-heading [overflow-wrap:anywhere]">
            {session.title}
          </h2>
          <p className="mt-1 text-body text-muted">
            {formatDay(session.date)} · Week {session.week} · {PHASE_TEXT[session.phase]}
          </p>
          <p className="text-body text-muted">
            {formatDuration(session.durationMin)}
            {event ? " expected" : ` · Load ${formatLoad(session.load)}`} ·{" "}
            {STATUS_TEXT[session.status]}
            {session.movedFrom ? ` · Moved from ${formatDay(session.movedFrom)}` : ""}
          </p>
        </header>

        {missed ? <MissedSession session={session} /> : null}

        {!event && environment === "both" && open ? (
          <PlaceChoice
            value={place}
            onChange={(indoor) => {
              actions.setIndoor(session, indoor);
            }}
          />
        ) : null}
        {!event && !(environment === "both" && open) && place ? (
          <p className="text-body">
            <span className="text-muted">Ride it: </span>
            <span className="font-semibold">{place === "indoor" ? "Indoor" : "Outdoor"}</span>
          </p>
        ) : null}

        <section aria-labelledby="plan-session-why">
          <h3 id="plan-session-why" className="mb-1 text-body-lg font-semibold">
            Why this session
          </h3>
          <SessionReasons session={session} plan={plan} />
        </section>

        {!event ? (
          <section aria-labelledby="plan-session-steps">
            <h3 id="plan-session-steps" className="mb-2 text-body-lg font-semibold">
              Steps
            </h3>
            <StepList steps={session.steps} totalMinutes={session.durationMin} />
          </section>
        ) : null}

        {session.strengthNote ? (
          <section
            aria-labelledby="plan-session-strength"
            className="rounded-lg bg-surface px-4 py-3"
          >
            <h3 id="plan-session-strength" className="text-body font-semibold">
              Strength note
            </h3>
            <p className="mt-1 text-body">{session.strengthNote}</p>
          </section>
        ) : null}

        {!desktop ? buttons : null}
      </div>
      {desktop ? <div>{buttons}</div> : null}
    </article>
  );
}
