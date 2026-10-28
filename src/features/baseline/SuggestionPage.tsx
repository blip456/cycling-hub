import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { FormAlert } from "@/components/ui";
import { baselineSchema, brusselsDate, isIsoDate } from "@/features/athlete";
import { formatDayMonthYear, formatHoursMinutes, formatKm, formatRideStart } from "./format";
import { baselineKeys, useBaseline, useAddBaseline, useFtpScan, type FtpScan } from "./hooks";
import { savedMessage, valueOf } from "./model";
import { EffectiveFrom } from "./parts";
import type { LoadProgress } from "./stream-source";

const card = "rounded-2xl bg-surface p-4";

/** Z10: reading the ride files, with a number (34 of 118) and a way out. */
function Reading({ progress, onCancel }: { progress: LoadProgress | null; onCancel: () => void }) {
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  return (
    <section aria-labelledby="reading-heading" className="max-w-[640px]">
      <h2 id="reading-heading" className="text-xl font-semibold tracking-tight">
        Reading your rides…
      </h2>
      <p role="status" className="mt-2 text-[15px]">
        {total > 0
          ? `${String(done)} of ${String(total)} rides with power data. `
          : "Looking for your rides with power data. "}
        The ride files are read on this device. This can take a moment.
      </p>
      <div
        role="progressbar"
        aria-label="Reading ride files"
        aria-valuemin={0}
        aria-valuemax={total || 1}
        aria-valuenow={total > 0 ? done : undefined}
        className="mt-4 h-2 overflow-hidden rounded-full bg-track"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none"
          style={{ width: total > 0 ? `${String(Math.round((done / total) * 100))}%` : "0%" }}
        />
      </div>
      <button type="button" onClick={onCancel} className={buttonClass("secondary", "mt-5")}>
        Cancel
      </button>
    </section>
  );
}

/** Z10: the files could not be read at all. The baseline was not changed; the manual route stays. */
function ReadFailed({ onRetry }: { onRetry: () => void }) {
  useStatusCard("suggestion-error", STATUS_PRIORITY.error, {
    tone: "error",
    message: "Could not read the rides. Nothing was changed.",
    action: (
      <button type="button" className={statusActionClass} onClick={onRetry}>
        Try again
      </button>
    ),
  });
  return (
    <section aria-labelledby="failed-heading" className="max-w-[640px]">
      <h2 id="failed-heading" className="text-xl font-semibold tracking-tight">
        We could not finish reading your rides
      </h2>
      <p className="mt-1 text-[15px]">Your baseline was not changed.</p>
      <h3 className="mt-4 text-[15px] font-semibold">What happened</h3>
      <p className="mt-1 text-[15px]">
        The ride files could not be downloaded. Check your connection and try again.
      </p>
      <div className="mt-5 flex flex-col gap-2 lg:flex-row">
        <button type="button" onClick={onRetry} className={buttonClass("primary")}>
          Try again
        </button>
        <Link to="/baseline/values" className={buttonClass("secondary")}>
          Enter a value instead
        </Link>
      </div>
    </section>
  );
}

function NoSuggestion({ scan }: { scan: FtpScan }) {
  return (
    <section aria-labelledby="none-heading" className="max-w-[640px]">
      <h2 id="none-heading" className="text-xl font-semibold tracking-tight">
        {scan.looked === 0 ? "No rides with power data yet" : "No FTP to suggest"}
      </h2>
      <p className="mt-2 text-[15px] leading-[22px]">
        {scan.looked === 0
          ? "None of your rides has power data, so the app cannot suggest an FTP. You can still set your baseline by hand."
          : `The app looked at ${String(scan.looked)} rides with power data and found none with 20 minutes in a row of power. Check that the ride files were imported, or set your baseline by hand.`}
      </p>
      {scan.failed > 0 ? (
        <p className="mt-2 text-[15px]">{String(scan.failed)} ride files could not be read.</p>
      ) : null}
      <div className="mt-5 flex flex-col gap-2 lg:flex-row">
        <Link to="/baseline/values" className={buttonClass("primary")}>
          Enter values by hand
        </Link>
        <Link to="/baseline/test-week" className={buttonClass("secondary")}>
          Plan a guided test week
        </Link>
      </div>
    </section>
  );
}

function Suggestion({ scan, onRetry }: { scan: FtpScan; onRetry: () => void }) {
  const estimate = scan.estimate;
  const ride = scan.ride;
  const navigate = useNavigate();
  const { baseline } = useBaseline();
  const add = useAddBaseline();
  const today = brusselsDate() ?? new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  if (!estimate) return null;

  const current = baseline ? valueOf(baseline, "ftp") : null;
  const comparison =
    baseline === undefined
      ? ""
      : current === null
        ? "No FTP is set yet."
        : estimate.ftp === current
          ? `Current FTP is ${String(current)} W, the same.`
          : `Current FTP is ${String(current)} W, so this is ${String(Math.abs(estimate.ftp - current))} W ${estimate.ftp > current ? "higher" : "lower"}.`;
  const dateError = !isIsoDate(date)
    ? "Enter a valid date."
    : date > today
      ? "The date cannot be in the future."
      : undefined;

  const confirm = () => {
    setError(null);
    const parsed = baselineSchema.safeParse({ ftp: estimate.ftp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "This value can't be saved.");
      return;
    }
    if (dateError) return;
    const note = ride
      ? `Best 20 minutes ${String(estimate.avg20MinW)} W, ride "${ride.name.slice(0, 80)}" of ${formatDayMonthYear(ride.start_local.slice(0, 10))}`
      : `Best 20 minutes ${String(estimate.avg20MinW)} W`;
    add.mutate(
      {
        effectiveDate: date,
        ftp: parsed.data.ftp,
        maxHr: null,
        restingHr: null,
        lthr: null,
        source: "stream_estimate",
        sourceActivityId: estimate.rideId,
        note,
      },
      {
        onSuccess: () => {
          void navigate("/baseline", { state: { flash: savedMessage(parsed.data) } });
        },
        onError: () => {
          setError("Couldn't save your baseline. Nothing was changed. Try again.");
        },
      },
    );
  };

  const span =
    scan.from && scan.to
      ? `, ${formatDayMonthYear(scan.from)} to ${formatDayMonthYear(scan.to)}`
      : "";
  const read = scan.looked - scan.failed;

  return (
    <div className="grid max-w-[640px] gap-4 lg:max-w-none lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <section aria-labelledby="suggested-heading" className={card}>
          <h2 id="suggested-heading" className="text-[13px] text-muted">
            Suggested FTP
          </h2>
          <p className="mt-0.5 text-[44px] leading-[46px] font-semibold tracking-[-0.025em] text-m-power tabular-nums">
            {estimate.ftp}
            <span className="ml-1 text-xl font-medium tracking-normal text-muted">W</span>
          </p>
          <p className="mt-2 text-[15px] font-semibold">This is an estimate, not a test result.</p>
          <p className="mt-1 text-[15px]">
            A best 20 minutes is only a good FTP when the ride was a hard, even effort. {comparison}
          </p>
          <dl className="mt-3 divide-y divide-border text-[15px]">
            <div className="flex justify-between gap-3 py-2">
              <dt>Best 20-minute power</dt>
              <dd className="font-semibold tabular-nums">{estimate.avg20MinW} W</dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt>Multiplied by</dt>
              <dd className="font-semibold tabular-nums">95 %</dd>
            </div>
            <div className="flex justify-between gap-3 py-2">
              <dt>Suggested FTP</dt>
              <dd className="font-semibold tabular-nums">{estimate.ftp} W</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="scope-heading" className={card}>
          <h2 id="scope-heading" className="sr-only">
            What was searched
          </h2>
          <p className="text-[15px]">
            {scan.failed > 0
              ? `Based on ${String(read)} of ${String(scan.looked)} rides with power data${span}. ${String(scan.failed)} could not be read.`
              : `Looked at ${String(scan.looked)} rides with power data${span}.`}
          </p>
          {scan.failed > 0 ? (
            <button type="button" onClick={onRetry} className={buttonClass("secondary", "mt-3")}>
              Try again
            </button>
          ) : null}
        </section>
      </div>
      <div className="flex flex-col gap-4">
        {ride ? (
          <section aria-labelledby="source-heading" className={card}>
            <h2 id="source-heading" className="text-[15px] font-semibold">
              Found in this ride
            </h2>
            <p className="mt-1 text-[15px]">{formatRideStart(ride.start_local)}</p>
            <p className="text-[15px] text-muted">
              {ride.name} · {formatKm(ride.distance_m)} km ·{" "}
              {formatHoursMinutes(ride.moving_time_s)}
            </p>
            <Link
              to={`/rides/${ride.id}`}
              aria-label={`Open ride ${ride.name}`}
              className={buttonClass("secondary", "mt-3")}
            >
              Open ride
            </Link>
          </section>
        ) : null}
        <section className={card}>
          <EffectiveFrom
            value={date}
            onChange={setDate}
            max={today}
            helper="Defaults to today."
            error={dateError}
          />
        </section>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="flex flex-col gap-2 lg:flex-row">
          <button
            type="button"
            disabled={add.isPending}
            onClick={confirm}
            className={buttonClass("primary")}
          >
            Use {estimate.ftp} W as my FTP
          </button>
          <Link to="/baseline/values" className={buttonClass("secondary")}>
            Enter a value instead
          </Link>
        </div>
        <p className="text-[13px] text-muted">
          Nothing changes until you press “Use {estimate.ftp} W as my FTP”.
        </p>
      </div>
    </div>
  );
}

/** Z2, Z10: the FTP suggestion from your rides, with its loading and error states. */
export function SuggestionPage() {
  const scan = useFtpScan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cancel = () => {
    void queryClient.cancelQueries({ queryKey: baselineKeys.ftpScan() });
    void navigate("/baseline/update");
  };
  const retry = () => {
    void scan.refetch();
  };

  if (scan.isError && !scan.isFetching) return <ReadFailed onRetry={retry} />;
  if (scan.data === undefined || scan.isFetching)
    return <Reading progress={scan.progress} onCancel={cancel} />;
  if (scan.data.estimate === null) return <NoSuggestion scan={scan.data} />;
  return <Suggestion scan={scan.data} onRetry={retry} />;
}
