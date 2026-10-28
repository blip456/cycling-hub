import { memo } from "react";
import { Link } from "react-router";
import type { Ride } from "../api";
import { formatRideDate } from "../format";
import { RouteShape } from "../RouteShape";
import { dateLineTags, METRICS, MISSING } from "./metrics";

/**
 * B1a: one ride on the phone. The name is the link; it covers the whole card, so a tap anywhere opens
 * the ride while screen readers still get the name, date line and metrics as separate content.
 */
export const RideCard = memo(function RideCard({ ride }: { ride: Ride }) {
  const dateLine = [
    formatRideDate(ride.start_local),
    ...dateLineTags(ride, { withRoad: true }),
  ].join(" · ");
  return (
    <article
      className={
        "relative rounded-2xl bg-surface p-4 transition-colors duration-(--dur-fast) hover:bg-surface-hover " +
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent"
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-fill">
          <RouteShape polyline={ride.polyline} width={44} height={44} padding={9} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] leading-6 font-semibold tracking-tight">
            <Link
              to={`/rides/${ride.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            >
              {ride.name}
            </Link>
          </h3>
          <p className="truncate text-[13px] leading-[18px] text-muted tabular-nums">{dateLine}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2.5 tabular-nums">
        {METRICS.map((metric) => {
          const value = metric.format(ride);
          return (
            <div key={metric.key} className="flex min-w-0 flex-col-reverse">
              <dt className="truncate text-[13px] leading-[18px] text-muted">{metric.label}</dt>
              <dd className="truncate leading-6">
                <span
                  className={
                    value === MISSING
                      ? "text-[17px] text-muted"
                      : `text-[17px] font-semibold ${metric.color}`
                  }
                >
                  {value}
                </span>
                <span className="ml-0.5 text-[13px] text-muted">{metric.unit}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
});
