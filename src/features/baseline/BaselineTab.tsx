import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { heartRateZones, powerZones } from "@/features/athlete";
import { formatDate, formatShortDate } from "./format";
import { useActiveTestWeek, useBaseline, useHasPowerRides, useHeartRateScan } from "./hooks";
import {
  isEmptyBaseline,
  sourceLabel,
  valueOf,
  type CurrentBaseline,
  type CurrentValue,
} from "./model";
import { LoadError, Skeleton, ZoneBar } from "./parts";
import { PROTOCOLS } from "./protocols";
import type { TestWeekWithSessions } from "./api";

const card = "rounded-2xl bg-surface";

function Meta({ current }: { current: CurrentValue }) {
  return (
    <p className="text-[13px] text-muted">
      {current.source ? `${sourceLabel(current.source)} · effective ` : "Effective "}
      {formatDate(current.effectiveDate)}
    </p>
  );
}

function Metric({
  label,
  current,
  unit,
  children,
}: {
  label: string;
  current: CurrentValue | null;
  unit: "W" | "bpm";
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5 not-first:border-t not-first:border-border lg:rounded-2xl lg:bg-surface lg:not-first:border-t-0">
      <p className="text-[13px] leading-[18px] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl leading-[30px] font-semibold tracking-[-0.015em] tabular-nums">
        {current ? (
          <>
            {current.value}
            <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>
          </>
        ) : (
          <span className="text-muted">
            <span aria-hidden="true">—</span>
            <span className="ml-1 text-[15px] font-medium">{unit}</span>
          </span>
        )}
      </p>
      {current ? <Meta current={current} /> : <p className="text-[13px] text-muted">Not set</p>}
      {children}
    </div>
  );
}

function nextSession(data: TestWeekWithSessions) {
  const open = data.sessions.filter((s) => s.completed_at === null);
  return [...open].sort(
    (a, b) =>
      (a.scheduled_on ?? "9999").localeCompare(b.scheduled_on ?? "9999") || a.position - b.position,
  )[0];
}

function TestWeekCard() {
  const week = useActiveTestWeek();
  const data = week.data;
  const next = data ? nextSession(data) : undefined;
  const plan = data
    ? PROTOCOLS[data.protocol].sessions.find((s) => s.position === next?.position)
    : undefined;
  return (
    <section aria-labelledby="test-week-heading" className={`${card} p-4`}>
      <h2 id="test-week-heading" className="text-[17px] font-semibold">
        Guided FTP test week
      </h2>
      {data && next && plan ? (
        <>
          <p className="mt-1 text-[15px]">
            Next: {plan.title}
            {next.scheduled_on ? `, ${formatShortDate(next.scheduled_on)}` : ", no date chosen yet"}
            .
          </p>
          <Link
            to={`/baseline/test-week/${String(next.position)}`}
            className={buttonClass("secondary", "mt-3")}
          >
            Open the session
          </Link>
        </>
      ) : data ? (
        <>
          <p className="mt-1 text-[15px]">All sessions of this week are done.</p>
          <Link to="/baseline/test-week" className={buttonClass("secondary", "mt-3")}>
            Open the test week
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px]">
            {week.isPending
              ? "Checking for a test week."
              : "Not planned. Pick a protocol and choose a date for each session."}
          </p>
          <Link to="/baseline/test-week" className={buttonClass("secondary", "mt-3")}>
            Plan a test week
          </Link>
        </>
      )}
    </section>
  );
}

function ZonesPreview({ baseline }: { baseline: CurrentBaseline }) {
  const power = powerZones(valueOf(baseline, "ftp"));
  if (!power) return null;
  const hr = heartRateZones({ lthr: valueOf(baseline, "lthr"), maxHr: valueOf(baseline, "maxHr") });
  const hrText = hr
    ? `; heart rate zones from ${hr.reference === "lthr" ? "LTHR" : "max HR"} ${String(
        hr.reference === "lthr" ? valueOf(baseline, "lthr") : valueOf(baseline, "maxHr"),
      )} bpm`
    : "";
  return (
    <section aria-labelledby="preview-heading" className={`${card} hidden p-4 lg:block`}>
      <h2 id="preview-heading" className="text-[17px] font-semibold">
        Zones from this baseline
      </h2>
      <p className="mt-1 mb-3 text-[15px]">
        Coggan power zones from FTP {valueOf(baseline, "ftp")} W{hrText}.
      </p>
      <ZoneBar zones={power} label="Power zones 1 to 7" />
      <Link to="/baseline/zones" className={buttonClass("ghost", "mt-2 -ml-5")}>
        See zones
      </Link>
    </section>
  );
}

function Overview({ baseline }: { baseline: CurrentBaseline }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-4 lg:max-w-none">
      <div className="grid gap-4 lg:grid-cols-4">
        <section aria-labelledby="ftp-heading" className={`${card} px-4 py-4 lg:p-0`}>
          <div className="lg:px-4 lg:py-3.5">
            <h2 id="ftp-heading" className="text-[13px] leading-[18px] text-muted">
              Functional threshold power (FTP)
            </h2>
            <p className="mt-0.5 text-[44px] leading-[46px] font-semibold tracking-[-0.025em] text-m-power tabular-nums lg:text-[32px] lg:leading-[38px]">
              {baseline.ftp ? (
                <>
                  {baseline.ftp.value}
                  <span className="ml-1 text-xl font-medium tracking-normal text-muted">W</span>
                </>
              ) : (
                <span className="text-muted">
                  <span aria-hidden="true">—</span>
                  <span className="ml-1 text-xl font-medium">W</span>
                </span>
              )}
            </p>
            {baseline.ftp ? (
              <Meta current={baseline.ftp} />
            ) : (
              <p className="text-[13px] text-muted">Not set</p>
            )}
            {baseline.ftp?.sourceActivityId ? (
              <Link
                to={`/rides/${baseline.ftp.sourceActivityId}`}
                className="-ml-3 inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-accent hover:bg-accent-soft"
              >
                Open the source ride
              </Link>
            ) : null}
            {baseline.ftp ? (
              <Link
                to="/baseline/zones"
                className="-ml-3 inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-accent hover:bg-accent-soft lg:hidden"
              >
                See zones
              </Link>
            ) : null}
          </div>
        </section>
        <section aria-labelledby="hr-heading" className={`${card} lg:contents`}>
          <h2 id="hr-heading" className="px-4 pt-3.5 text-[17px] font-semibold lg:sr-only">
            Heart rate
          </h2>
          <Metric label="Max heart rate" current={baseline.maxHr} unit="bpm" />
          <Metric label="Lactate threshold HR (LTHR)" current={baseline.lthr} unit="bpm" />
          <Metric label="Resting heart rate" current={baseline.restingHr} unit="bpm" />
        </section>
      </div>
      <div className="flex">
        <Link to="/baseline/update" className={buttonClass("primary", "w-full lg:w-auto")}>
          Update baseline
        </Link>
      </div>
      <TestWeekCard />
      <ZonesPreview baseline={baseline} />
    </div>
  );
}

function HighestHeartRate() {
  const scan = useHeartRateScan(true);
  const found = scan.data?.suggestion;
  if (!found) return null;
  return (
    <section aria-labelledby="hr-found-heading" className={`${card} p-4`}>
      <h2 id="hr-found-heading" className="text-[17px] font-semibold">
        Heart rate was found in your rides
      </h2>
      <p className="mt-1 text-[15px]">
        Highest value: {found.bpm} bpm
        {scan.data?.ride ? `, ${formatDate(scan.data.ride.start_local.slice(0, 10))}` : ""}.
      </p>
      <Link
        to="/baseline/values"
        state={{
          maxHr: found.bpm,
          rideId: found.rideId,
        }}
        className={buttonClass("secondary", "mt-3")}
      >
        Use as max heart rate
      </Link>
    </section>
  );
}

/** Z9: nothing saved yet. The manual route comes first when no ride has power data. */
function EmptyBaseline({ hasPower }: { hasPower: boolean }) {
  return (
    <div className="flex max-w-[640px] flex-col gap-4 lg:max-w-none">
      {hasPower ? (
        <section className={`${card} p-5`}>
          <h2 className="text-xl font-semibold tracking-tight">No baseline yet</h2>
          <p className="mt-2 text-[15px] leading-[22px]">
            Your rides have power data, so the app can suggest an FTP from your best 20 minutes. You
            can also type your values or do a guided test week.
          </p>
          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <Link to="/baseline/suggestion" className={buttonClass("primary")}>
              Suggest from my rides
            </Link>
            <Link to="/baseline/values" className={buttonClass("secondary")}>
              Enter values by hand
            </Link>
            <Link to="/baseline/test-week" className={buttonClass("secondary")}>
              Plan a guided test week
            </Link>
          </div>
        </section>
      ) : (
        <section className={`${card} p-5`}>
          <h2 className="text-xl font-semibold tracking-tight">No power data yet</h2>
          <p className="mt-2 text-[15px] leading-[22px]">
            None of your rides has power data, so the app cannot suggest an FTP. Most older rides
            were recorded without a power meter. You can still set your baseline by hand.
          </p>
          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <Link to="/baseline/values" className={buttonClass("primary")}>
              Enter values by hand
            </Link>
            <Link to="/baseline/test-week" className={buttonClass("secondary")}>
              Plan a guided test week
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-muted">
            The test week works without power data in the app: you type the result from your head
            unit.
          </p>
        </section>
      )}
      {hasPower ? null : <HighestHeartRate />}
      {hasPower ? null : (
        <Link to="/import" className={buttonClass("ghost", "self-start")}>
          Import rides
        </Link>
      )}
    </div>
  );
}

/** Z1, Z9: the Baseline tab. */
export function BaselineTab() {
  const { baseline, isPending, isError, refetch } = useBaseline();
  const power = useHasPowerRides();

  if (isError) {
    return (
      <LoadError
        id="baseline-error"
        message="Couldn't load your baseline. Check your connection."
        onRetry={refetch}
      />
    );
  }
  if (isPending || !baseline || power.isPending) return <Skeleton label="Loading your baseline" />;
  if (isEmptyBaseline(baseline)) return <EmptyBaseline hasPower={power.data === true} />;
  return <Overview baseline={baseline} />;
}
