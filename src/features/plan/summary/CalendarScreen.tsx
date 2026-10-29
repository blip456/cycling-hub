import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { buttonClass } from "@/components/button-class";
import { PageLoading } from "@/components/PageLoading";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { Button, EmptyState, TextField } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import { useProfile } from "@/features/profile/hooks";
import { RadioGroup } from "@/features/profile/RadioGroup";
import { downloadFile } from "@/features/rides/export/download";
import {
  buildIcs,
  countIcsEvents,
  ICS_MIME_TYPE,
  icsFilename,
  icsFingerprint,
  isIcsOutOfDate,
  isStartTime,
  type IcsEvent,
  type IcsOptions,
  type IcsScope,
  type IcsSessionInput,
} from "../export";
import { dayLabel } from "../export/format";
import { sessionFromRow } from "./adapt";
import { fetchPlanChanges } from "./api";
import { summaryKeys, usePlanSessions } from "./hooks";
import { loadIcsDownload, saveIcsDownload, type StoredIcsDownload } from "./storage";
import { Switch } from "./Switch";

/** The event day of the plan has a fixed id, so it keeps its calendar entry when the plan is rebuilt. */
const EVENT_ID = "event";

const SCOPE_OPTIONS = [
  { value: "todo", label: "Sessions still to do" },
  { value: "all", label: "The whole plan" },
] as const;

const TIMING_OPTIONS = [
  { value: "all-day", label: "All-day events" },
  { value: "timed", label: "At a set time" },
] as const;

/** "26 sessions and the event", "1 session", "no sessions". */
function countText(counts: { sessions: number; event: boolean }): string {
  const sessions =
    counts.sessions === 0
      ? "no sessions"
      : `${counts.sessions} ${counts.sessions === 1 ? "session" : "sessions"}`;
  if (!counts.event) return sessions;
  return counts.sessions === 0 ? "the event" : `${sessions} and the event`;
}

/**
 * R10a: the ICS download. Choose which sessions, all-day or at a set start time and whether the steps go
 * in the description; the file is made in the browser. The options and a fingerprint of the file are kept
 * in this browser at download time, so the page can say when the plan changed since (R10a note 4).
 */
export function CalendarScreen() {
  const plan = usePlanSessions();
  const profile = useProfile();
  const planId = plan.data?.plan?.id ?? "";
  const changes = useQuery({
    queryKey: summaryKeys.changes(planId),
    queryFn: () => fetchPlanChanges(planId),
    enabled: planId !== "",
  });

  if (plan.isPending || profile.isPending) return <PageLoading />;
  if (plan.isError || profile.isError) {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>The calendar export could not be prepared.</EmptyState>
        <Button
          variant="secondary"
          onClick={() => {
            void plan.refetch();
            void profile.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (plan.data.plan === null) {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>There is no plan to add to your calendar yet.</EmptyState>
        <Link to="/plan/new" className={buttonClass("secondary")}>
          Make a plan
        </Link>
      </div>
    );
  }

  const ftp = plan.data.plan.ftp_w;
  const sessions = plan.data.sessions.flatMap((row) => sessionFromRow(row, ftp) ?? []);
  const event: IcsEvent | null =
    profile.data.eventName !== null && profile.data.eventDate !== null
      ? { id: EVENT_ID, name: profile.data.eventName, date: profile.data.eventDate }
      : null;
  const lastChange = [...(changes.data ?? [])].filter((c) => c.undone_at === null).pop();

  return (
    <CalendarForm
      sessions={sessions}
      event={event}
      lastChangeDate={lastChange ? brusselsDate(new Date(lastChange.created_at)) : null}
    />
  );
}

function CalendarForm({
  sessions,
  event,
  lastChangeDate,
}: {
  sessions: readonly IcsSessionInput[];
  event: IcsEvent | null;
  lastChangeDate: string | null;
}) {
  const [stored, setStored] = useState<StoredIcsDownload | null>(() => loadIcsDownload());
  const [scope, setScope] = useState<IcsScope>(stored?.scope ?? "todo");
  const [timed, setTimed] = useState(stored?.timing.mode === "timed");
  const [startTime, setStartTime] = useState(
    stored?.timing.mode === "timed" ? stored.timing.startTime : "",
  );
  const [includeSteps, setIncludeSteps] = useState(stored?.includeSteps ?? true);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const headingId = useId();
  const downloadHelperId = useId();

  const counts = countIcsEvents(sessions, { scope, event });
  const todoText = countText(countIcsEvents(sessions, { scope: "todo", event }));
  const allText = countText(countIcsEvents(sessions, { scope: "all", event }));
  const countLabel = countText(counts);
  const nothing = counts.sessions === 0 && !counts.event;

  const outOfDate = useMemo(() => {
    if (stored === null) return false;
    const options: IcsOptions = {
      now: new Date(0),
      scope: stored.scope,
      timing: stored.timing,
      includeSteps: stored.includeSteps,
      event,
    };
    return isIcsOutOfDate(stored.fingerprint, sessions, options);
  }, [stored, sessions, event]);

  useStatusCard(
    "plan-calendar-downloaded",
    STATUS_PRIORITY.flash,
    downloaded === null
      ? null
      : {
          tone: "success",
          message: (
            <>
              <span className="block font-semibold">Downloaded {icsFilename()}</span>
              <span className="block">Open the file in your calendar app to add {downloaded}.</span>
            </>
          ),
          onDismiss: () => {
            setDownloaded(null);
          },
        },
  );

  const download = () => {
    if (timed && !isStartTime(startTime)) {
      setTimeError("Enter the start time as hours and minutes (hh:mm).");
      return;
    }
    setTimeError(undefined);
    const now = new Date();
    const options: IcsOptions = {
      now,
      scope,
      timing: timed ? { mode: "timed", startTime } : { mode: "all-day" },
      includeSteps,
      event,
    };
    downloadFile(buildIcs(sessions, options), ICS_MIME_TYPE, icsFilename());
    const record: StoredIcsDownload = {
      fingerprint: icsFingerprint(sessions, options),
      scope,
      timing: options.timing,
      includeSteps,
      downloadedAt: now.toISOString(),
    };
    saveIcsDownload(record);
    setStored(record);
    setDownloaded(countLabel);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-[560px] flex-col gap-4 lg:grid lg:max-w-[1000px] lg:grid-cols-2 lg:items-start"
    >
      <div className="flex flex-col gap-5 rounded-2xl bg-surface p-4">
        <div>
          <h2 id={headingId} className="text-[17px] font-semibold">
            Add the plan to your calendar
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            Download a calendar file and open it in your calendar app.
          </p>
        </div>
        <RadioGroup
          legend="Which sessions"
          options={SCOPE_OPTIONS.map((o) => ({
            ...o,
            detail: o.value === "todo" ? todoText : allText,
          }))}
          value={scope}
          onChange={setScope}
        />
        <RadioGroup
          legend="Time of day"
          options={TIMING_OPTIONS}
          value={timed ? "timed" : "all-day"}
          onChange={(value) => {
            setTimed(value === "timed");
            setTimeError(undefined);
          }}
        />
        <TextField
          type="time"
          label="Start time"
          helper="Only used with a set time. Europe/Brussels. The length is the planned duration."
          error={timeError}
          value={startTime}
          disabled={!timed}
          onChange={(e) => {
            setStartTime(e.target.value);
          }}
        />
        <Switch
          label="Add steps and targets to the description"
          checked={includeSteps}
          onChange={setIncludeSteps}
          helper="Warm-up, intervals, watts and bpm go in the event notes."
        />
        <div>
          <Button
            className="w-full"
            disabled={nothing}
            aria-describedby={downloadHelperId}
            onClick={download}
          >
            Download calendar file
          </Button>
          <p id={downloadHelperId} className="mt-1.5 text-[13px] text-muted">
            {nothing
              ? "There is nothing to export for this choice."
              : `${icsFilename()}, ${countLabel}`}
          </p>
        </div>
      </div>

      {outOfDate ? (
        <div role="status" className="rounded-2xl bg-subtle p-4">
          <h3 className="text-[15px] font-semibold">Your calendar file is out of date</h3>
          <p className="mt-1 text-[15px]">
            {lastChangeDate
              ? `The plan changed on ${dayLabel(lastChangeDate)}.`
              : "The plan changed."}{" "}
            Download the file again to update your calendar.
          </p>
        </div>
      ) : null}
    </section>
  );
}
