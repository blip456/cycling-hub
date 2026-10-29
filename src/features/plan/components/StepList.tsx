import type { Step } from "../engine";
import {
  formatDuration,
  formatStepMinutes,
  heartRateText,
  heartRateZoneLabel,
  powerZoneLabel,
  stepGroups,
  wattsText,
} from "../data";
import { ZoneLabel } from "./parts";

const STEP_NAMES: Record<Step["kind"], string> = {
  "warm-up": "Warm-up",
  work: "Work",
  rest: "Between",
  easy: "Easy",
  "cool-down": "Cool-down",
};

/** The shape of the session: one bar per step, as wide as its time and as high as its intensity. Decoration only. */
function ShapeBar({ steps }: { steps: readonly Step[] }) {
  const total = steps.reduce((sum, s) => sum + s.durationSec, 0) || 1;
  const top = Math.max(...steps.map((s) => s.target.percentFtp), 100);
  return (
    <div
      aria-hidden="true"
      className="flex h-16 items-end gap-px overflow-hidden rounded-md bg-surface"
    >
      {steps.map((step, i) => (
        <span
          key={`${String(i)}-${step.label}`}
          className="block min-w-px"
          style={{
            flexGrow: step.durationSec / total,
            flexBasis: 0,
            height: `${String(Math.max(12, (step.target.percentFtp / top) * 100))}%`,
            backgroundColor: `var(--zone-${String(step.target.powerZone ?? 7)})`,
          }}
        />
      ))}
    </div>
  );
}

function StepLine({
  step,
  repeats,
  showTitle,
}: {
  step: Step;
  repeats: number;
  showTitle: boolean;
}) {
  const watts = wattsText(step);
  const power = powerZoneLabel(step);
  const hr = heartRateZoneLabel(step);
  const bpm = heartRateText(step);
  return (
    <li className="border-t border-border py-3 first:border-t-0 first:pt-0">
      {showTitle ? (
        <p className="text-[15px] font-semibold">
          {STEP_NAMES[step.kind]}, {formatStepMinutes(step.durationMin)}
          {repeats > 1 ? <span className="font-normal text-muted"> × {repeats}</span> : null}
        </p>
      ) : null}
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-muted">Power</dt>
        <dd className="min-w-0">
          {power && step.target.powerZone !== null ? (
            <ZoneLabel zone={step.target.powerZone} label={power} />
          ) : (
            <span>All out</span>
          )}
          {watts ? (
            <span className="block font-medium [font-variant-numeric:tabular-nums]">{watts}</span>
          ) : null}
        </dd>
        {hr && step.heartRate ? (
          <>
            <dt className="text-muted">Heart rate</dt>
            <dd className="min-w-0">
              <ZoneLabel zone={step.heartRate.zoneFrom} label={hr} />
              {bpm ? (
                <span className="block font-medium [font-variant-numeric:tabular-nums]">{bpm}</span>
              ) : null}
              {step.powerLeads ? (
                <span className="block text-muted">Heart rate lags here: follow the power.</span>
              ) : null}
            </dd>
          </>
        ) : null}
        {step.cadence ? (
          <>
            <dt className="text-muted">Cadence</dt>
            <dd>{step.cadence}</dd>
          </>
        ) : null}
      </dl>
    </li>
  );
}

/** T7: the steps as warm-up, main set and cool-down, with watts, heart rate and the zone as number and name. */
export function StepList({
  steps,
  totalMinutes,
}: {
  steps: readonly Step[];
  totalMinutes: number;
}) {
  const groups = stepGroups(steps);
  if (steps.length === 0)
    return (
      <p className="text-[15px] text-muted">
        This session has no steps to show. It is {formatDuration(totalMinutes)} long.
      </p>
    );
  return (
    <div>
      <ShapeBar steps={steps} />
      <p className="mt-1 text-[13px] text-muted">
        Session shape, {formatDuration(totalMinutes)}. Height and colour show the zone; the steps
        give the numbers.
      </p>
      <ol className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13.5rem),1fr))]">
        {groups.map((group, i) => (
          <li key={`${group.title}-${String(i)}`} className="rounded-2xl bg-surface p-4">
            <h3 className="text-[17px] font-semibold">
              {i + 1}. {group.title}
            </h3>
            <p className="mb-3 text-[14px] text-muted">
              {group.summary ? `${group.summary}, ` : ""}
              {formatStepMinutes(group.minutes)}
            </p>
            <ul>
              {group.lines.map((line, n) => (
                <StepLine key={String(n)} {...line} showTitle={group.title === "Main set"} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
