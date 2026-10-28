import { useEffect, useState } from "react";
import type { ImportRecord } from "../api";

const COUNT_MS = 800; // --dur-count

function prefersReducedMotion(): boolean {
  // jsdom (tests) has no matchMedia, even though the DOM types say it always exists.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up from 0 once (DESIGN.md: --dur-count); shows the number straight away with reduced motion. */
function useCountUp(target: number): number {
  const [animate] = useState(() => target > 0 && !prefersReducedMotion());
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animate, target]);
  return animate ? value : target;
}

function Outcome({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight: boolean;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className={
        "flex min-h-[92px] flex-col justify-between rounded-2xl px-4 py-3.5 " +
        (highlight ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]" : "bg-surface")
      }
    >
      <dt className={"text-[13px] " + (highlight ? "font-semibold text-text" : "text-muted")}>
        {label}
      </dt>
      <dd className="text-[32px] leading-9 font-semibold tracking-[-0.025em] tabular-nums">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{value}</span>
      </dd>
    </div>
  );
}

/** C3: one card per outcome, titled by the outcome (P17). Only "New rides" is tinted. */
export function OutcomeGrid({ record }: { record: ImportRecord }) {
  const outcomes = [
    { label: "New rides", value: record.new_count, highlight: true },
    { label: "Updated", value: record.updated_count, highlight: false },
    { label: "Unchanged", value: record.unchanged_count, highlight: false },
    { label: "Not a ride", value: record.not_a_ride_count, highlight: false },
    { label: "Skipped (errors)", value: record.skipped_count, highlight: false },
    { label: "Deleted earlier", value: record.deleted_earlier_count, highlight: false },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {outcomes.map((o) => (
        <Outcome key={o.label} {...o} />
      ))}
    </dl>
  );
}
