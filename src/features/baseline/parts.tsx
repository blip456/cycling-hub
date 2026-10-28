import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { TextField } from "@/components/ui";
import type { IsoDate, Zone } from "@/features/athlete";
import { formatDate } from "./format";
import { zoneBarWeights, zonePercentText, zoneRangeText, type ZoneModel } from "./model";

const pulse = "motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]";

/** Skeleton cards that keep the layout steady while data loads; screen readers hear `label`. */
export function Skeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={`flex max-w-[640px] flex-col gap-3 ${pulse}`}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}

/** A load error: one sentence in the page and an error card at the bottom with Try again (P12). */
export function LoadError({
  id,
  message,
  onRetry,
}: {
  id: string;
  message: string;
  onRetry: () => void;
}) {
  useStatusCard(id, STATUS_PRIORITY.error, {
    tone: "error",
    message,
    action: (
      <button type="button" className={statusActionClass} onClick={onRetry}>
        Try again
      </button>
    ),
  });
  return (
    <div className="flex max-w-[640px] flex-col items-start gap-3 rounded-2xl bg-surface px-5 py-6">
      <p className="text-[15px]">{message}</p>
      <button type="button" className={buttonClass("secondary")} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/** The back-to-the-page link used at the end of a sub-page. */
export function PlainLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={buttonClass("secondary")}>
      {children}
    </Link>
  );
}

/** Number and name on a swatch: the zone colour token, and the number as text on it (never colour alone). */
function Swatch({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-[15px] font-semibold text-on-accent"
      style={{ backgroundColor: `var(--zone-${String(index)})` }}
    >
      {index}
    </span>
  );
}

/** A bar of the zones: each segment as wide as its range and carrying its number as text. */
export function ZoneBar({ zones, label }: { zones: readonly Zone[]; label: string }) {
  const weights = zoneBarWeights(zones);
  return (
    <div role="img" aria-label={label} className="flex h-9 gap-0.5 overflow-hidden rounded-md">
      {zones.map((zone, i) => (
        <span
          key={zone.index}
          className="flex min-w-0 items-center justify-center text-[13px] font-semibold text-on-accent"
          style={{
            flexGrow: weights[i] ?? 1,
            flexBasis: 0,
            backgroundColor: `var(--zone-${String(zone.index)})`,
          }}
        >
          {zone.index}
        </span>
      ))}
    </div>
  );
}

/** One row per zone: swatch with the number, "Zone 3 · Tempo", the share of the reference and the range. */
export function ZoneRows({
  zones,
  model,
  unit,
}: {
  zones: readonly Zone[];
  model: ZoneModel;
  unit: "W" | "bpm";
}) {
  return (
    <ol className="rounded-2xl bg-surface">
      {zones.map((zone) => (
        <li
          key={zone.index}
          className="relative flex min-h-16 items-center gap-3 px-4 py-2 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:border-t not-first:before:border-border"
        >
          <Swatch index={zone.index} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              Zone {zone.index} · {zone.name}
            </p>
            <p className="text-[13px] text-muted">{zonePercentText(model, zone.index)}</p>
          </div>
          <p className="shrink-0 text-right text-[15px] font-semibold tabular-nums">
            {zoneRangeText(zone, unit)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Effective from": the date as text with a Change button that opens a date field (native, so the keyboard and
 * screen readers work). The date cannot be in the future; `error` is shown under the field.
 */
export function EffectiveFrom({
  value,
  onChange,
  max,
  helper,
  error,
}: {
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  max: IsoDate;
  helper: string;
  error?: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  if (editing || error) {
    return (
      <TextField
        label="Effective from"
        type="date"
        value={value}
        max={max}
        helper={helper}
        error={error}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold">Effective from</p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px]">{formatDate(value)}</p>
        <button
          type="button"
          aria-label="Change the effective date"
          onClick={() => {
            setEditing(true);
          }}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-accent hover:bg-accent-soft"
        >
          Change
        </button>
      </div>
      <p className="text-[13px] text-muted">{helper}</p>
    </div>
  );
}
