import { useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { brusselsDate, heartRateZones, powerZones } from "@/features/athlete";
import { FtpChart, type FtpPoint } from "./FtpChart";
import { formatDate } from "./format";
import { useBaselineEntries } from "./hooks";
import { historyRows, sourceLabel, zoneSummary, type HistoryRow } from "./model";
import { LoadError, Skeleton, ZoneBar } from "./parts";

function setValues(row: HistoryRow): string {
  const parts: string[] = [];
  if (row.ftp_w !== null) parts.push(`FTP ${String(row.ftp_w)} W`);
  if (row.max_hr !== null) parts.push(`max HR ${String(row.max_hr)} bpm`);
  if (row.lthr !== null) parts.push(`LTHR ${String(row.lthr)} bpm`);
  if (row.resting_hr !== null) parts.push(`resting HR ${String(row.resting_hr)} bpm`);
  return parts.join(" · ");
}

function RowZones({ row }: { row: HistoryRow }) {
  const power = powerZones(row.ftpInForce);
  const hr = heartRateZones({ lthr: row.lthrInForce, maxHr: row.maxHrInForce });
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
      {power ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">
            Power zones at {row.ftpInForce} W (ranges in W)
          </p>
          <ZoneBar zones={power} label="Power zones 1 to 7" />
          <p className="mt-1.5 text-[13px]">{zoneSummary(power)}</p>
        </div>
      ) : (
        <p className="text-[13px] text-muted">No FTP was set yet, so there are no power zones.</p>
      )}
      {hr ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">
            Heart rate zones from{" "}
            {hr.reference === "lthr"
              ? `LTHR ${String(row.lthrInForce)}`
              : `max HR ${String(row.maxHrInForce)}`}{" "}
            bpm (ranges in bpm)
          </p>
          <ZoneBar zones={hr.zones} label="Heart rate zones 1 to 5" />
          <p className="mt-1.5 text-[13px]">{zoneSummary(hr.zones)}</p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: HistoryRow }) {
  const [open, setOpen] = useState(false);
  const panelId = `history-${row.id}`;
  return (
    <li className="relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:border-t not-first:before:border-border">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">
              {formatDate(row.effective_date)} · {setValues(row)}
            </span>
            <span className="block text-[13px] text-muted">
              {sourceLabel(row.source)}
              {row.note ? ` · ${row.note}` : ""}
            </span>
            {row.current ? <span className="block text-[13px] font-semibold">Current</span> : null}
          </span>
          <span aria-hidden="true" className="shrink-0 text-muted">
            {open ? "▴" : "▾"}
          </span>
          <span className="sr-only">{open ? "Hide zones" : "Show zones"}</span>
        </button>
      </h3>
      {open ? (
        <div id={panelId}>
          <RowZones row={row} />
        </div>
      ) : (
        <div id={panelId} hidden />
      )}
    </li>
  );
}

/** Z8: the baseline history, newest first, read-only (a correction is a new row), and FTP over time. */
export function HistoryTab() {
  const entries = useBaselineEntries();

  if (entries.isError) {
    return (
      <LoadError
        id="history-error"
        message="Couldn't load your history. Check your connection."
        onRetry={() => {
          void entries.refetch();
        }}
      />
    );
  }
  if (entries.isPending) return <Skeleton label="Loading your history" />;
  if (entries.data.length === 0) {
    return (
      <div className="flex max-w-[640px] flex-col items-start gap-4">
        <p className="w-full rounded-2xl bg-surface px-5 py-8 text-center text-[15px] text-muted">
          No baseline has been saved yet. Set your baseline to start the history.
        </p>
        <Link to="/baseline/values" className={buttonClass("primary")}>
          Enter values
        </Link>
      </div>
    );
  }
  const rows = historyRows(entries.data);
  const points: FtpPoint[] = rows.flatMap((r) =>
    r.ftp_w === null ? [] : [{ date: r.effective_date, ftp: r.ftp_w }],
  );
  const today = brusselsDate() ?? new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="rounded-2xl bg-surface p-4">
        {points.length > 0 ? (
          <FtpChart points={points} today={today} />
        ) : (
          <p className="text-[15px] text-muted">
            No FTP has been saved yet, so there is nothing to draw.
          </p>
        )}
      </div>
      <section aria-labelledby="past-heading">
        <h2 id="past-heading" className="mb-2 text-[17px] font-semibold">
          Past baselines
        </h2>
        <ul className="rounded-2xl bg-surface">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          Nothing is overwritten. A new baseline adds a row.
        </p>
      </section>
    </div>
  );
}
