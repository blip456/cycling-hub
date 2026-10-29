import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/features/rides/detail/ConfirmDialog";
import type { Level, Plan, PlanInput } from "../../engine";
import {
  assumptionLines,
  formatDay,
  formatLongDate,
  goalOf,
  hasWeightLoss,
  LEVEL_OPTIONS,
  levelLabel,
  purposeLabel,
  type IntakeDraft,
  type IntakeStep,
} from "../../data";
import { ChoiceRow, FactRow } from "../parts";

const DAY_SHORT: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const ENV_TEXT = { indoor: "Indoor", outdoor: "Outdoor", both: "Both indoor and outdoor" } as const;

function Change({ step, what }: { step: IntakeStep; what: string }) {
  return (
    <Link
      to={`/plan/new?step=${String(step)}`}
      aria-label={`Change ${what}`}
      className="ml-3 inline-flex min-h-11 items-center font-semibold text-accent underline"
    >
      Change
    </Link>
  );
}

function Row({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-border first:border-t-0">
      <FactRow label={label}>
        {children}
        {action}
      </FactRow>
    </div>
  );
}

/** T2: the answers with a Change link each, what the plan will assume, the level and Build my plan. */
export function Summary({
  draft,
  change,
  input,
  plan,
  calculatedLevel,
  hasExisting,
  building,
  onBuild,
  onBack,
}: {
  draft: IntakeDraft;
  change: (patch: Partial<IntakeDraft>) => void;
  input: PlanInput;
  plan: Plan;
  calculatedLevel: Level;
  hasExisting: boolean;
  building: boolean;
  onBuild: () => void;
  onBack: () => void;
}) {
  const [editLevel, setEditLevel] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const goal = goalOf(draft);
  const blocked = plan.status === "blocked";
  const lines = assumptionLines(plan, input);
  const days = input.intake.availableDays;

  function press() {
    if (building) return;
    if (hasExisting) setConfirm(true);
    else onBuild();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section aria-labelledby="intake-answers">
        <h3 id="intake-answers" className="mb-1 text-[17px] font-semibold">
          Your answers
        </h3>
        <dl className="rounded-2xl bg-surface px-4 py-1">
          <Row label="Purposes, in order" action={<Change step={1} what="purposes" />}>
            {draft.purposes.map((p, i) => `${String(i + 1)} ${purposeLabel(p)}`).join(", ")}
          </Row>
          {hasWeightLoss(draft.purposes) ? (
            <Row label="Weight target" action={<Change step={1} what="the weight target" />}>
              {goal
                ? `${goal.targetKg.toFixed(1)} kg by ${formatDay(goal.targetDate)}`
                : "No target"}
            </Row>
          ) : null}
          <Row
            label="Level"
            action={
              <button
                type="button"
                aria-expanded={editLevel}
                aria-label="Change level"
                onClick={() => {
                  setEditLevel((v) => !v);
                }}
                className="ml-3 inline-flex min-h-11 items-center font-semibold text-accent underline"
              >
                Change
              </button>
            }
          >
            {levelLabel(plan.level)}
            {draft.levelOverride ? " (your choice)" : ""}
          </Row>
          <Row label="Time" action={<Change step={3} what="the hours" />}>
            {String(input.intake.hoursPerWeek)} h per week
          </Row>
          <Row label="Days" action={<Change step={3} what="the days" />}>
            {days.map((d) => DAY_SHORT[d] ?? d).join(", ")}
          </Row>
          <Row label="Indoor or outdoor" action={<Change step={3} what="indoor or outdoor" />}>
            {ENV_TEXT[input.intake.environment]}
          </Row>
          <Row label="Length">
            {String(plan.weeks.length)} weeks, {formatDay(plan.startDate)} to{" "}
            {formatDay(plan.endDate)}
          </Row>
          {plan.event ? (
            <Row label="Event" action={<Change step={4} what="the event" />}>
              {plan.event.name}, {formatLongDate(plan.event.date)}
            </Row>
          ) : null}
          <Row label="Starting point">
            FTP {String(input.ftp ?? 0)} W
            {input.intake.weightKg !== undefined ? `, ${input.intake.weightKg.toFixed(1)} kg` : ""}
          </Row>
        </dl>
        {editLevel ? (
          <fieldset className="mt-3 rounded-2xl bg-surface px-4 py-3">
            <legend className="px-1 text-[13px] font-semibold">Level</legend>
            <ChoiceRow
              type="radio"
              name="level-override"
              value=""
              checked={draft.levelOverride === null}
              onChange={() => {
                change({ levelOverride: null });
              }}
              note="From your five answers and your hours"
            >
              Use the calculated level ({levelLabel(calculatedLevel)})
            </ChoiceRow>
            {LEVEL_OPTIONS.map((o) => (
              <ChoiceRow
                key={o.value}
                type="radio"
                name="level-override"
                value={o.value}
                checked={draft.levelOverride === o.value}
                onChange={() => {
                  change({ levelOverride: o.value });
                }}
              >
                {o.label}
              </ChoiceRow>
            ))}
          </fieldset>
        ) : null}
      </section>

      <section aria-labelledby="intake-assume" className="flex flex-col gap-4">
        <div>
          <h3 id="intake-assume" className="mb-1 text-[17px] font-semibold">
            What the plan will assume
          </h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px]">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        {hasExisting ? (
          <p role="note" className="rounded-md bg-subtle px-4 py-3 text-[15px]">
            You already have a plan. Building a new one replaces it.
          </p>
        ) : null}
        {blocked ? (
          <div role="alert" className="rounded-md bg-subtle px-4 py-3 text-[15px]">
            <p className="font-semibold">The plan cannot be built yet</p>
            <ul className="mt-1 list-disc pl-5">
              {plan.warnings.map((w) => (
                <li key={w.code}>{w.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button
            aria-disabled={building || blocked}
            className="min-w-44"
            onClick={() => {
              if (!blocked) press();
            }}
          >
            {building ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
                />
                Building your plan
              </>
            ) : (
              "Build my plan"
            )}
          </Button>
        </div>
      </section>

      {confirm ? (
        <ConfirmDialog
          open
          title="Replace your current plan?"
          onClose={() => {
            setConfirm(false);
          }}
          actions={
            <>
              <Button
                onClick={() => {
                  setConfirm(false);
                  onBuild();
                }}
              >
                Replace plan
              </Button>
              <Button
                variant="secondary"
                data-autofocus=""
                onClick={() => {
                  setConfirm(false);
                }}
              >
                Cancel
              </Button>
            </>
          }
        >
          <p>
            Your current plan is replaced by the new one. Sessions you marked as done stay in the
            old plan and are no longer shown here.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
