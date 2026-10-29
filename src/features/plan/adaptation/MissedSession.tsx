import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import { useRides } from "@/features/rides/hooks";
import { useSessionActions } from "../components/session-actions-context";
import { useToday } from "../components/page-hooks";
import { ChoiceRow } from "../components/parts";
import {
  formatDay,
  formatDuration,
  usePlanData,
  useUpdateSessions,
  type PlanSession,
} from "../data";
import { diffDays } from "@/features/athlete";
import { usePlanChanges } from "./hooks";
import { manualMatch, PICK_WINDOW_DAYS, type PickRide } from "./matching";
import { rideDate } from "./stored";

const RULE =
  "A session is missed when its day is over and no ride matches it. It is checked when you open the app or import rides.";

/** R5 pin 2: what the app did about the miss, in order. Only what really happened is listed. */
function WhatTheAppDid({ session }: { session: PlanSession }) {
  const changes = usePlanChanges();
  const caused = (changes.data ?? []).some(
    (c) =>
      c.payload.reasons.includes("missed-session") && c.message.includes(formatDay(session.date)),
  );
  return (
    <section aria-labelledby="missed-did">
      <h3 id="missed-did" className="mb-1.5 text-[17px] font-semibold">
        What the app did
      </h3>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[15px]">
        <li>
          Kept the session in the plan as <strong className="font-semibold">Missed</strong>.
        </li>
        {caused ? (
          <>
            <li>Recalculated the rest of this week and the weeks after.</li>
            <li>Showed a Plan updated card with Undo.</li>
          </>
        ) : (
          <li>Checked the rest of your plan. Nothing else needed to change.</li>
        )}
      </ol>
      {caused ? (
        <Link to="/plan/changes" className={`${buttonClass("secondary")} mt-3`}>
          See what changed
        </Link>
      ) : null}
    </section>
  );
}

/** R5: pick the ride that counts for this session. Rides within two days of it, with their time. */
function RidePicker({ session, onClose }: { session: PlanSession; onClose: () => void }) {
  const rides = useRides();
  const data = usePlanData();
  const save = useUpdateSessions();
  const today = useToday();
  const [chosen, setChosen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const options = useMemo(
    () =>
      (rides.data ?? [])
        .map((ride): PickRide & { name: string } => ({
          id: ride.id,
          name: ride.name,
          date: rideDate(ride.start_local),
          movingMinutes: ride.moving_time_s / 60,
          commute: ride.commute,
        }))
        .filter((r) => Math.abs(diffDays(r.date, session.date) ?? 99) <= PICK_WINDOW_DAYS)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [rides.data, session.date],
  );
  const ride = options.find((o) => o.id === chosen) ?? null;

  const onSave = async () => {
    if (!ride) return;
    try {
      await save.mutateAsync(manualMatch(ride, session, data.sessions, today));
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <ConfirmDialog
      open
      title="Pick the ride that counts"
      onClose={onClose}
      actions={
        <>
          <Button aria-disabled={ride === null || save.isPending} onClick={() => void onSave()}>
            Save
          </Button>
          <Button variant="secondary" data-autofocus="" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {rides.isPending ? (
        <p role="status">Loading your rides.</p>
      ) : rides.isError ? (
        <p>Your rides could not be loaded. Close this and try again.</p>
      ) : options.length === 0 ? (
        <p>
          There is no ride within {PICK_WINDOW_DAYS} days of {formatDay(session.date)}. Import the
          ride first, or mark the session as done.
        </p>
      ) : (
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold text-text">
            Which ride counts for {session.title}, {formatDay(session.date)}?
          </legend>
          {options.map((o, i) => (
            <ChoiceRow
              type="radio"
              key={o.id}
              name="missed-ride"
              value={o.id}
              checked={chosen === o.id}
              focusFirst={i === 0}
              onChange={() => {
                setChosen(o.id);
              }}
              note={`${formatDay(o.date)}, ${formatDuration(o.movingMinutes)}`}
            >
              {o.name}
            </ChoiceRow>
          ))}
          <p className="mt-1 text-[13px]">
            If the ride counts for another session now, it moves here.
          </p>
        </fieldset>
      )}
      {failed ? (
        <p role="alert" className="mt-2 text-[14px] text-danger">
          Could not save the match. Nothing was changed.
        </p>
      ) : null}
    </ConfirmDialog>
  );
}

/**
 * R5: what the PO sees on a missed session: the rule, what the app did and the three ways to correct it
 * (pick the ride, mark as done, mark as skipped). Marking triggers a new recalculation through the data
 * layer; a done session without a ride is locked as the PO's word.
 */
export function MissedSession({ session }: { session: PlanSession }) {
  const { actions } = useSessionActions();
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[65ch] text-[15px] text-muted">{RULE}</p>
      <WhatTheAppDid session={session} />
      <section aria-labelledby="missed-different">
        <h3 id="missed-different" className="mb-2 text-[17px] font-semibold">
          Did it go differently?
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <Button
              block
              onClick={() => {
                setPicking(true);
              }}
            >
              Pick the ride that counts
            </Button>
            <p className="mt-1 text-[13px] text-muted">
              You rode, but the app matched it to another session or to none.
            </p>
          </div>
          <div>
            <Button
              block
              variant="secondary"
              onClick={() => {
                actions.markDone(session);
              }}
            >
              Mark as done
            </Button>
            <p className="mt-1 text-[13px] text-muted">
              You did it without a ride in the app, for example indoors without recording. It counts
              as done at the planned load.
            </p>
          </div>
          <div>
            <Button
              block
              variant="secondary"
              onClick={() => {
                actions.skip(session);
              }}
            >
              Mark as skipped
            </Button>
            <p className="mt-1 text-[13px] text-muted">
              You chose not to do it. It counts as not done and the plan adapts.
            </p>
          </div>
        </div>
      </section>
      {picking ? (
        <RidePicker
          session={session}
          onClose={() => {
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
