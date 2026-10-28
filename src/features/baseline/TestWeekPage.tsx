import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { buttonClass } from "@/components/button-class";
import { FormAlert, TextField } from "@/components/ui";
import { brusselsDate, isIsoDate, type IsoDate } from "@/features/athlete";
import type { TestSession } from "./api";
import { formatShortDate } from "./format";
import { useActiveTestWeek, useCreateTestWeek, useSetWeekStatus, useUpdateSession } from "./hooks";
import { LoadError, Skeleton } from "./parts";
import { dateWarnings, PROTOCOLS, type Protocol } from "./protocols";

function todayDate(): IsoDate {
  return brusselsDate() ?? new Date().toISOString().slice(0, 10);
}

function warningsText(warnings: readonly string[] | undefined, fallback: string): string {
  return warnings && warnings.length > 0 ? `Check: ${warnings.join(" ")}` : fallback;
}

function ProtocolChoice({
  value,
  onChange,
}: {
  value: Protocol;
  onChange: (value: Protocol) => void;
}) {
  const name = useId();
  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-[13px] font-semibold">Test protocol</legend>
      <div className="grid gap-2 lg:grid-cols-2">
        {(Object.keys(PROTOCOLS) as Protocol[]).map((key) => (
          <label
            key={key}
            className="flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 has-checked:shadow-[inset_0_0_0_2px_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => {
                onChange(key);
              }}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span className="text-[15px] font-semibold">
              {PROTOCOLS[key].label}
              <span className="block text-[13px] font-normal text-muted">
                {PROTOCOLS[key].description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Z4b before a week exists: choose the protocol and a date for each session, then save. */
function PlanWeek() {
  const navigate = useNavigate();
  const create = useCreateTestWeek();
  const [protocol, setProtocol] = useState<Protocol>("20min");
  const [dates, setDates] = useState<string[]>(["", "", ""]);
  const [failed, setFailed] = useState(false);
  const plan = PROTOCOLS[protocol];
  const chosen = plan.sessions.map((_, i) => (isIsoDate(dates[i]) ? (dates[i] ?? null) : null));
  const warnings = dateWarnings(plan.sessions, chosen, todayDate());

  const save = () => {
    setFailed(false);
    create.mutate(
      {
        protocol,
        sessions: plan.sessions.map((s, i) => ({
          position: s.position,
          kind: s.kind,
          scheduledOn: chosen[i] ?? null,
        })),
      },
      {
        onSuccess: () => {
          void navigate("/baseline/test-week", { replace: true });
        },
        onError: () => {
          setFailed(true);
        },
      },
    );
  };

  return (
    <div className="max-w-[640px] lg:max-w-none">
      <ProtocolChoice value={protocol} onChange={setProtocol} />
      <h2 className="text-[17px] font-semibold">Sessions</h2>
      <p className="mb-3 text-[15px]">You choose the day of each session. Do them in this order.</p>
      <ol className="flex flex-col gap-3">
        {plan.sessions.map((session, i) => (
          <li
            key={`${protocol}-${String(session.position)}`}
            className="grid gap-3 rounded-2xl bg-surface p-4 lg:grid-cols-[1fr_16rem] lg:items-start"
          >
            <div>
              <h3 className="text-[15px] font-semibold">
                {session.position} · {session.title}
              </h3>
              <p className="text-[15px]">
                {chosen[i] ? `Planned ${formatShortDate(chosen[i])}` : "Not planned"}
              </p>
              <p className="mt-1 text-[13px] text-muted">{session.summary}</p>
            </div>
            <TextField
              label={`Date for session ${String(session.position)}, ${session.title}`}
              type="date"
              value={dates[i] ?? ""}
              helper={warningsText(warnings[i], "Optional. You can choose or change it later.")}
              onChange={(e) => {
                setDates((previous) => previous.map((d, j) => (j === i ? e.target.value : d)));
              }}
            />
          </li>
        ))}
      </ol>
      {failed ? (
        <div className="mt-4">
          <FormAlert>Couldn&apos;t save the test week. Nothing was changed. Try again.</FormAlert>
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-2 lg:flex-row">
        <button
          type="button"
          onClick={save}
          disabled={create.isPending}
          className={buttonClass("primary")}
        >
          Save test week
        </button>
        <Link to="/baseline/update" className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

function statusText(session: TestSession): string {
  if (session.completed_at) return "Done";
  if (session.scheduled_on) return `Planned ${formatShortDate(session.scheduled_on)}`;
  return "Not planned";
}

/** Z4b after saving: the same list is the progress view of the week. Dates can still change. */
function ActiveWeek({
  protocol,
  sessions,
  weekId,
}: {
  protocol: Protocol;
  sessions: TestSession[];
  weekId: string;
}) {
  const update = useUpdateSession();
  const setStatus = useSetWeekStatus();
  const plan = PROTOCOLS[protocol];
  const rows = plan.sessions.map((p) => ({
    plan: p,
    session: sessions.find((s) => s.position === p.position),
  }));
  const warnings = dateWarnings(
    plan.sessions,
    rows.map((r) => r.session?.scheduled_on ?? null),
    todayDate(),
  );
  return (
    <div className="max-w-[640px] lg:max-w-none">
      <h2 className="text-[17px] font-semibold">{plan.label}</h2>
      <p className="mb-3 text-[15px]">
        You choose the day of each session. Do them in this order. Results are entered on the
        session.
      </p>
      {update.isError ? (
        <FormAlert>Couldn&apos;t save that date. It is back to what it was.</FormAlert>
      ) : null}
      <ol className="flex flex-col gap-3">
        {rows.map(({ plan: p, session }, i) =>
          session ? (
            <li
              key={session.id}
              className="grid gap-3 rounded-2xl bg-surface p-4 lg:grid-cols-[1fr_16rem_auto] lg:items-start"
            >
              <div>
                <h3 className="text-[15px] font-semibold">
                  {p.position} · {p.title}
                </h3>
                <p className="text-[15px]">{statusText(session)}</p>
                <p className="mt-1 text-[13px] text-muted">{p.summary}</p>
              </div>
              <TextField
                label={`Date for session ${String(p.position)}, ${p.title}`}
                type="date"
                value={session.scheduled_on ?? ""}
                helper={warningsText(warnings[i], "Optional. You can change it later.")}
                onChange={(e) => {
                  const value = e.target.value;
                  update.mutate({
                    id: session.id,
                    patch: { scheduled_on: isIsoDate(value) ? value : null },
                  });
                }}
              />
              <Link
                to={`/baseline/test-week/${String(p.position)}`}
                className={buttonClass("secondary", "lg:mt-6")}
              >
                Open
                <span className="sr-only">
                  {" "}
                  session {p.position}, {p.title}
                </span>
              </Link>
            </li>
          ) : null,
        )}
      </ol>
      <div className="mt-5">
        <button
          type="button"
          disabled={setStatus.isPending}
          onClick={() => {
            setStatus.mutate({ id: weekId, status: "cancelled" });
          }}
          className={buttonClass("ghost")}
        >
          Cancel this test week
        </button>
        <p className="mt-1 px-5 text-[13px] text-muted">
          Your baseline is not changed. You can plan a new week afterwards.
        </p>
      </div>
    </div>
  );
}

/** Z4b: the guided test week as a checklist page (P49). */
export function TestWeekPage() {
  const week = useActiveTestWeek();
  if (week.isError) {
    return (
      <LoadError
        id="test-week-error"
        message="Couldn't load your test week. Check your connection."
        onRetry={() => {
          void week.refetch();
        }}
      />
    );
  }
  if (week.isPending) return <Skeleton label="Loading your test week" />;
  if (week.data === null) return <PlanWeek />;
  return (
    <ActiveWeek
      protocol={week.data.protocol}
      sessions={week.data.sessions}
      weekId={week.data.week.id}
    />
  );
}
