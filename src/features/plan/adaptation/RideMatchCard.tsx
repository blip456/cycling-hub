import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import type { Ride } from "@/features/rides/api";
import { useToday } from "../components/page-hooks";
import { ChoiceRow } from "../components/parts";
import { useUpdateSessions, usePlanData, formatDay, type PlanSession } from "../data";
import {
  candidates,
  isLeftOut,
  manualMatch,
  matchFacts,
  matchReason,
  PICK_WINDOW_DAYS,
  sessionOfRide,
  type PickRide,
} from "./matching";
import { rideDate } from "./stored";

const NONE = "none";

function pickRide(ride: Ride): PickRide {
  return {
    id: ride.id,
    date: rideDate(ride.start_local),
    movingMinutes: ride.moving_time_s / 60,
    commute: ride.commute,
  };
}

/** R6b: the picker. Radio rows of the sessions within two days, the current match preselected, and "No session". */
function Picker({
  ride,
  sessions,
  current,
  saving,
  onSave,
  onClose,
}: {
  ride: PickRide;
  sessions: readonly PlanSession[];
  current: PlanSession | null;
  saving: boolean;
  onSave: (target: PlanSession | null) => void;
  onClose: () => void;
}) {
  const options = useMemo(() => candidates(ride, sessions), [ride, sessions]);
  const [chosen, setChosen] = useState<string>(current?.id ?? NONE);
  const helperId = useId();
  return (
    <ConfirmDialog
      open
      title="Fix the match"
      onClose={onClose}
      actions={
        <>
          <Button
            disabled={saving}
            onClick={() => {
              onSave(options.find((o) => o.session.id === chosen)?.session ?? null);
            }}
          >
            Save
          </Button>
          <Button variant="secondary" data-autofocus="" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <fieldset aria-describedby={helperId}>
        <legend className="mb-1 text-[13px] font-semibold text-text">
          Which session does this ride count for?
        </legend>
        {options.map((o, i) => (
          <ChoiceRow
            type="radio"
            key={o.session.id}
            name="ride-session"
            value={o.session.id}
            checked={chosen === o.session.id}
            focusFirst={i === 0}
            onChange={() => {
              setChosen(o.session.id);
            }}
            note={o.note}
          >
            {o.label}
          </ChoiceRow>
        ))}
        <ChoiceRow
          type="radio"
          name="ride-session"
          value={NONE}
          checked={chosen === NONE}
          onChange={() => {
            setChosen(NONE);
          }}
        >
          No session, this is an extra ride
        </ChoiceRow>
        <p id={helperId} className="mt-1 text-[13px]">
          Only sessions within {PICK_WINDOW_DAYS} days of the ride are listed. Choosing another
          session removes the old match.
        </p>
      </fieldset>
    </ConfirmDialog>
  );
}

type Message = { tone: "success" | "error"; text: string } | null;

/**
 * R6: the "Counts as" card on the ride detail page: which planned session this ride counts for, how it was
 * matched, and Change (R6b). A change is saved as a locked manual match and the plan is evaluated again.
 * Without a plan the card is not shown.
 */
export function RideMatchCard({ ride }: { ride: Ride }) {
  const data = usePlanData();
  const today = useToday();
  const save = useUpdateSessions();
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const pick = useMemo(() => pickRide(ride), [ride]);

  useEffect(() => {
    if (message?.tone !== "success") return undefined;
    const timer = setTimeout(() => {
      setMessage(null);
    }, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  const retryTarget = useRef<PlanSession | null>(null);
  const run = async (target: PlanSession | null) => {
    retryTarget.current = target;
    setPicking(false);
    try {
      await save.mutateAsync(manualMatch(pick, target, data.sessions, today));
      setMessage({
        tone: "success",
        text: target
          ? `Ride counts for ${target.title}, ${formatDay(target.date)}.`
          : "Ride no longer counts for a session.",
      });
    } catch {
      setMessage({ tone: "error", text: "Could not save the match. Nothing was changed." });
    }
    document.getElementById("ride-change")?.focus();
  };

  useStatusCard(
    "ride-match",
    message?.tone === "error" ? STATUS_PRIORITY.error : STATUS_PRIORITY.flash,
    message
      ? {
          tone: message.tone,
          message: message.text,
          ...(message.tone === "error"
            ? {
                action: (
                  <button
                    type="button"
                    className={statusActionClass}
                    onClick={() => {
                      void run(retryTarget.current);
                    }}
                  >
                    Try again
                  </button>
                ),
              }
            : {}),
          onDismiss: () => {
            setMessage(null);
          },
        }
      : null,
  );

  if (data.isPending || data.isError || !data.plan) return null;
  const session = sessionOfRide(ride.id, data.sessions);

  return (
    <section aria-labelledby="ride-counts-as" className="rounded-2xl bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <h3 id="ride-counts-as" className="text-[13px] leading-[18px] text-muted">
          Counts as
        </h3>
        <Button
          id="ride-change"
          variant="secondary"
          aria-label="Change the session this ride counts for"
          onClick={() => {
            setPicking(true);
          }}
        >
          Change
        </Button>
      </div>
      {session ? (
        <>
          <p className="mt-0.5 text-[17px] font-semibold">
            {session.title}, {formatDay(session.date)}
          </p>
          <p className="mt-0.5 text-[15px]">{matchFacts(pick, session)}</p>
          <p className="mt-0.5 text-[13px] text-muted">{matchReason(pick, session)}</p>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-[17px] font-semibold">No session</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {isLeftOut(pick)
              ? "Commutes and rides under 20 minutes do not count for a session unless you pick one."
              : "This ride fits no planned session. It counts as an extra ride."}
          </p>
        </>
      )}
      {picking ? (
        <Picker
          ride={pick}
          sessions={data.sessions}
          current={session}
          saving={save.isPending}
          onSave={(target) => {
            void run(target);
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      ) : null}
    </section>
  );
}
