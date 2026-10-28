import type { ReactNode } from "react";
import { Link } from "react-router";
import { BackIcon } from "@/components/icons";
import type { Ride } from "../api";
import { formatDistanceKm, rideTags } from "../format";
import {
  detailDateLine,
  detailMetrics,
  stravaActivityUrl,
  type DetailMetric,
  type MetricColor,
} from "./detail-format";
import { dangerButtonClass } from "./danger-button";
import { ExternalIcon, TrashIcon } from "./icons";
import { RouteDrawing } from "./RouteDrawing";

const COLOR: Record<Exclude<MetricColor, null>, string> = {
  time: "text-m-time",
  speed: "text-m-speed",
  power: "text-m-power",
  hr: "text-m-hr",
  elev: "text-m-elev",
};

function Stat({ metric }: { metric: DetailMetric }) {
  const color = metric.missing ? "text-muted" : metric.color ? COLOR[metric.color] : "text-text";
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5">
      <dt className="text-[13px] leading-[18px] text-muted">{metric.label}</dt>
      <dd
        className={`mt-0.5 text-2xl leading-[30px] font-semibold tracking-[-0.015em] whitespace-nowrap tabular-nums ${color}`}
      >
        {metric.missing ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Not in the export</span>
          </>
        ) : (
          metric.value
        )}
        <span aria-hidden={metric.missing} className="ml-[3px] text-[15px] font-medium text-muted">
          {metric.unit}
        </span>
      </dd>
    </div>
  );
}

function Distance({ ride, labelled }: { ride: Ride; labelled: boolean }) {
  const value = (
    <span className="text-[44px] leading-[46px] font-semibold tracking-[-0.025em] text-m-dist tabular-nums">
      {formatDistanceKm(ride.distance_m)}
      <span className="ml-[3px] text-xl font-medium tracking-normal text-muted">km</span>
    </span>
  );
  if (!labelled) {
    return (
      <p>
        <span className="sr-only">Distance </span>
        {value}
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5">
      <p className="text-[13px] leading-[18px] text-muted">Distance</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

const row =
  "relative flex min-h-[52px] items-center gap-3 px-4 text-[15px] " +
  "not-first:before:absolute not-first:before:left-4 not-first:before:right-0 not-first:before:top-0 " +
  "not-first:before:border-t not-first:before:border-border";

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={row}>
      <dt className="shrink-0 grow">{label}</dt>
      <dd className="min-w-0 truncate text-right text-muted">{value}</dd>
    </div>
  );
}

function Details({ ride }: { ride: Ride }) {
  const [type] = rideTags(ride);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <dl>
        <InfoRow label="Type" value={`${type ?? ride.sport_type} ride`} />
        <InfoRow label="Commute" value={ride.commute ? "Yes" : "No"} />
        <InfoRow label="Indoor" value={ride.trainer ? "Yes" : "No"} />
      </dl>
      <a
        href={stravaActivityUrl(ride.strava_id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${row} hover:bg-surface-hover focus-visible:-outline-offset-2`}
      >
        <span className="grow">
          Open in Strava<span className="sr-only"> (opens in a new tab)</span>
        </span>
        <ExternalIcon className="text-muted" />
      </a>
    </div>
  );
}

function Metrics({ ride }: { ride: Ride }) {
  return (
    <dl className="grid grid-cols-2 gap-2.5">
      {detailMetrics(ride).map((metric) => (
        <Stat key={metric.label} metric={metric} />
      ))}
    </dl>
  );
}

function DeleteButton({ onDelete, block }: { onDelete: () => void; block: boolean }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className={`${dangerButtonClass} ${block ? "w-full" : "shrink-0"}`}
    >
      <TrashIcon />
      Delete ride
    </button>
  );
}

/**
 * B4, ride detail. Phone: name, date line, the distance as the one large number, route shape, the
 * other metrics, details and Delete ride. Desktop: two columns (route + details left, metrics right)
 * with Back and Delete ride in the header.
 */
export function RideDetail({
  ride,
  desktop,
  onDelete,
}: {
  ride: Ride;
  desktop: boolean;
  onDelete: () => void;
}) {
  const heading = (
    <div className="min-w-0 flex-1">
      <h2 className="text-2xl leading-[30px] font-semibold tracking-[-0.015em] break-words">
        {ride.name}
      </h2>
      <p className="mt-1 text-[13px] leading-[18px] text-muted">{detailDateLine(ride)}</p>
    </div>
  );

  if (desktop) {
    return (
      <article className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Link
            to="/rides"
            aria-label="Back to rides"
            className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-md text-text hover:bg-subtle"
          >
            <BackIcon />
          </Link>
          {heading}
          <DeleteButton onDelete={onDelete} block={false} />
        </div>
        <div className="grid grid-cols-[1.25fr_1fr] items-start gap-5">
          <div className="flex flex-col gap-4">
            <RouteDrawing polyline={ride.polyline} name={ride.name} heightClass="h-[330px]" />
            <Details ride={ride} />
          </div>
          <div className="flex flex-col gap-4">
            <Distance ride={ride} labelled />
            <Metrics ride={ride} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-3">
      {heading}
      <div className="mt-1">
        <Distance ride={ride} labelled={false} />
      </div>
      <RouteDrawing polyline={ride.polyline} name={ride.name} heightClass="h-[150px]" />
      <Metrics ride={ride} />
      <Details ride={ride} />
      <div className="mt-3">
        <DeleteButton onDelete={onDelete} block />
      </div>
    </article>
  );
}
