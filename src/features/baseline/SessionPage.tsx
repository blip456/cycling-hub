import { useState, type SyntheticEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { buttonClass } from "@/components/button-class";
import { EmptyState, FormAlert, TextField } from "@/components/ui";
import { isIsoDate, lthrSchema } from "@/features/athlete";
import { Checkbox } from "@/features/rides/list/controls";
import type { TestSession } from "./api";
import { loadChecked, saveChecked } from "./checklist-storage";
import { formatDate, formatRideStart } from "./format";
import {
  useActiveTestWeek,
  useBaseline,
  useSessionRide,
  useSetWeekStatus,
  useUpdateSession,
} from "./hooks";
import { valueOf } from "./model";
import { LoadError, Skeleton } from "./parts";
import { checklistFor, PROTOCOLS, stepsFor, type Protocol, type SessionKind } from "./protocols";

const card = "rounded-2xl bg-surface p-4";
const RESULT_POWER = { min: 50, max: 1500 } as const;

function unit(label: string) {
  return (
    <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
      {label}
    </span>
  );
}

function DateLine({ session }: { session: TestSession }) {
  const update = useUpdateSession();
  const [editing, setEditing] = useState(false);
  const status = session.completed_at ? "done" : session.scheduled_on ? "planned" : "not planned";
  if (editing) {
    return (
      <TextField
        label="Date"
        type="date"
        value={session.scheduled_on ?? ""}
        onChange={(e) => {
          update.mutate({
            id: session.id,
            patch: { scheduled_on: isIsoDate(e.target.value) ? e.target.value : null },
          });
        }}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <p className="text-[15px]">
        {session.scheduled_on ? formatDate(session.scheduled_on) : "No date chosen"}
      </p>
      <button
        type="button"
        onClick={() => {
          setEditing(true);
        }}
        className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-accent hover:bg-accent-soft"
      >
        Change date
      </button>
      <p className="text-[13px] text-muted">Status: {status}</p>
    </div>
  );
}

function Checklist({ session, items }: { session: TestSession; items: string[] }) {
  const [checked, setChecked] = useState(() => loadChecked(session.id));
  return (
    <section aria-labelledby="before-heading" className={`${card} lg:col-start-2 lg:row-start-1`}>
      <h2 id="before-heading" className="text-[17px] font-semibold">
        Before you start
      </h2>
      <ul className="mt-1">
        {items.map((item, i) => (
          <li key={item}>
            <Checkbox
              checked={checked.includes(i)}
              onChange={(on) => {
                const next = on ? [...checked, i] : checked.filter((c) => c !== i);
                setChecked(next);
                saveChecked(session.id, next);
              }}
            >
              {item}
            </Checkbox>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Steps({
  protocol,
  kind,
  ftp,
}: {
  protocol: Protocol;
  kind: SessionKind;
  ftp: number | null;
}) {
  const steps = stepsFor(protocol, kind, ftp);
  return (
    <section
      aria-labelledby="steps-heading"
      className={`${card} lg:col-start-1 lg:row-span-2 lg:row-start-1`}
    >
      <h2 id="steps-heading" className="text-[17px] font-semibold">
        Steps
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        {ftp === null
          ? "No FTP is set yet, so the steps use effort wording."
          : `Targets use your current FTP of ${String(ftp)} W.`}
      </p>
      <ol className="mt-2 divide-y divide-border">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 py-3">
            <span aria-hidden="true" className="w-5 shrink-0 text-[15px] font-semibold text-muted">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {step.title} · {step.duration}
              </p>
              <p className="text-[15px]">{step.target}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DoneToggle({ session, weekId }: { session: TestSession; weekId: string }) {
  const update = useUpdateSession();
  const setStatus = useSetWeekStatus();
  const done = session.completed_at !== null;
  return (
    <section className={`${card} lg:col-start-2 lg:row-start-2`} aria-labelledby="done-heading">
      <h2 id="done-heading" className="text-[17px] font-semibold">
        When you have ridden it
      </h2>
      <p className="mt-1 text-[15px]">
        This session has no result. Tick it off to see your progress.
      </p>
      <button
        type="button"
        onClick={() => {
          update.mutate({
            id: session.id,
            patch: { completed_at: done ? null : new Date().toISOString() },
          });
          if (!done) setStatus.mutate({ id: weekId, status: "in_progress" });
        }}
        className={buttonClass("secondary", "mt-3")}
      >
        {done ? "Mark as not done" : "Mark as done"}
      </button>
    </section>
  );
}

function ResultForm({
  session,
  protocol,
  weekId,
}: {
  session: TestSession;
  protocol: Protocol;
  weekId: string;
}) {
  const navigate = useNavigate();
  const update = useUpdateSession();
  const setStatus = useSetWeekStatus();
  const found = useSessionRide(session.scheduled_on, protocol);
  const [power, setPower] = useState(
    session.result_avg_power_w === null ? "" : String(session.result_avg_power_w),
  );
  const [hr, setHr] = useState("");
  const [rideId, setRideId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ power?: string; hr?: string; form?: string }>({});
  const info = PROTOCOLS[protocol];
  const ride = found.data;

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    const watts = Number(power.trim());
    if (power.trim() === "" || !Number.isInteger(watts)) {
      next.power = "Enter the power as a whole number of watts.";
    } else if (watts < RESULT_POWER.min || watts > RESULT_POWER.max) {
      next.power = `Power must be from ${String(RESULT_POWER.min)} to ${String(RESULT_POWER.max)} W.`;
    }
    let hrValue: number | null = null;
    if (protocol === "20min" && hr.trim() !== "") {
      const parsed = lthrSchema.safeParse(Number(hr.trim()));
      if (parsed.success) hrValue = parsed.data;
      else next.hr = parsed.error.issues[0]?.message ?? "Enter a valid heart rate.";
    }
    setErrors(next);
    if (next.power !== undefined || next.hr !== undefined) return;
    update.mutate(
      { id: session.id, patch: { result_avg_power_w: watts } },
      {
        onSuccess: () => {
          setStatus.mutate({ id: weekId, status: "in_progress" });
          const query = new URLSearchParams();
          if (hrValue !== null) query.set("hr", String(hrValue));
          if (rideId !== null) query.set("ride", rideId);
          const suffix = query.size > 0 ? `?${query.toString()}` : "";
          void navigate(`/baseline/test-week/${String(session.position)}/result${suffix}`);
        },
        onError: () => {
          setErrors({ form: "Couldn't save the result. Try again." });
        },
      },
    );
  };

  return (
    <section aria-labelledby="result-heading" className={`${card} lg:col-start-2 lg:row-start-2`}>
      <h2 id="result-heading" className="mb-4 text-[17px] font-semibold">
        Your result
      </h2>
      {errors.form ? <FormAlert>{errors.form}</FormAlert> : null}
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <TextField
          label={info.resultLabel}
          inputMode="numeric"
          autoComplete="off"
          value={power}
          error={errors.power}
          helper="Read it from your head unit, or use the ride below."
          trailing={unit("W")}
          onChange={(e) => {
            setPower(e.target.value);
            setRideId(null);
          }}
        />
        {protocol === "20min" ? (
          <TextField
            label="Average heart rate over the last 15 minutes (optional)"
            inputMode="numeric"
            autoComplete="off"
            value={hr}
            error={errors.hr}
            helper="Optional. Used for LTHR."
            trailing={unit("bpm")}
            onChange={(e) => {
              setHr(e.target.value);
            }}
          />
        ) : null}
        {ride && ride.bestW !== null ? (
          <div className="rounded-xl bg-subtle p-3">
            <h3 className="text-[15px] font-semibold">A ride was found on this day</h3>
            <p className="text-[13px] text-muted">
              {formatRideStart(ride.ride.start_local)} · {ride.ride.name} ·{" "}
              {protocol === "ramp" ? "best minute" : "best 20 minutes"}: {ride.bestW} W
            </p>
            <button
              type="button"
              onClick={() => {
                setPower(String(ride.bestW));
                if (protocol === "20min" && ride.lthr !== null) setHr(String(ride.lthr));
                setRideId(ride.ride.id);
              }}
              className={buttonClass("secondary", "mt-2")}
            >
              Use this ride
            </button>
          </div>
        ) : null}
        <div>
          <button type="submit" disabled={update.isPending} className={buttonClass("primary")}>
            Review result
          </button>
          <p className="mt-2 text-[13px] text-muted">Nothing is saved to the baseline yet.</p>
        </div>
      </form>
    </section>
  );
}

/** Z5: one session of the test week: date, checklist, steps with targets and, for the test, the result. */
export function SessionPage() {
  const { position } = useParams();
  const week = useActiveTestWeek();
  const { baseline } = useBaseline();

  if (week.isError) {
    return (
      <LoadError
        id="session-error"
        message="Couldn't load this session. Check your connection."
        onRetry={() => {
          void week.refetch();
        }}
      />
    );
  }
  if (week.isPending) return <Skeleton label="Loading the session" />;
  const session = week.data?.sessions.find((s) => String(s.position) === position);
  if (!week.data || !session) {
    return (
      <div className="flex max-w-[640px] flex-col items-start gap-4">
        <EmptyState>
          This session was not found. The test week may be finished or cancelled.
        </EmptyState>
        <Link to="/baseline/test-week" className={buttonClass("secondary")}>
          Back to the test week
        </Link>
      </div>
    );
  }
  const { protocol, sessions } = week.data;
  const plan = PROTOCOLS[protocol].sessions.find((s) => s.position === session.position);
  const kind = plan?.kind ?? "recovery";
  const ftp = baseline ? valueOf(baseline, "ftp") : null;
  return (
    <div className="max-w-[640px] lg:max-w-none">
      <h2 className="text-[22px] leading-7 font-semibold tracking-tight">
        {plan?.title ?? "Session"}
      </h2>
      <p className="text-[15px] text-muted">
        Session {session.position} of {sessions.length} · {PROTOCOLS[protocol].label}
      </p>
      <div className="mt-1 mb-4">
        <DateLine session={session} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Checklist session={session} items={checklistFor(kind)} />
        <Steps protocol={protocol} kind={kind} ftp={ftp} />
        {kind === "test" ? (
          <ResultForm session={session} protocol={protocol} weekId={week.data.week.id} />
        ) : (
          <DoneToggle session={session} weekId={week.data.week.id} />
        )}
      </div>
    </div>
  );
}
