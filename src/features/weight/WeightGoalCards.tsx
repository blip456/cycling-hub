import { useId, useState } from "react";
import { Link } from "react-router";
import { buttonClass } from "@/components/button-class";
import { Button } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import {
  capKgPerWeek,
  capSentence,
  currentAverage,
  goalStanding,
  weeklyTrendLoss,
  type GoalStanding,
} from "./goal-model";
import { useGoalView } from "./goal-hooks";
import { formatDay, formatKg } from "./format";

const STANDING_TEXT: Record<Exclude<GoalStanding["state"], "reached" | "unknown">, string> = {
  behind: "Behind the pace you need",
  "on-pace": "On pace",
  "ahead-of-cap": "Ahead of the cap",
};

/** "0.14 kg/week" for a loss, "up 0.20 kg/week" for a gain (words, so the sign is never the only signal). */
function paceText(lossKgPerWeek: number | null): string {
  if (lossKgPerWeek === null) return "Not enough weigh-ins yet";
  if (lossKgPerWeek >= 0) return `${lossKgPerWeek.toFixed(2)} kg/week`;
  return `up ${Math.abs(lossKgPerWeek).toFixed(2)} kg/week`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold [font-variant-numeric:tabular-nums]">{value}</dd>
    </div>
  );
}

/** R2a and R2b: the goal card above the chart. Nothing is drawn unless weight loss is a purpose or a goal exists. */
export function WeightGoalCard() {
  const { goal, entries, pending, visible } = useGoalView();
  const headingId = useId();
  const today = brusselsDate() ?? "";

  if (goal.isError) {
    return (
      <div className="mb-5 rounded-2xl bg-surface px-5 py-4">
        <p className="text-[15px]">The weight goal could not be loaded.</p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            void goal.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (pending || !visible || !entries.data) return null;

  const average = currentAverage(entries.data, today);
  const active = goal.data;

  if (active) {
    const standing = goalStanding(active, entries.data, today);
    return (
      <section aria-labelledby={headingId} className="mb-5 rounded-2xl bg-surface p-4">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 id={headingId} className="text-[17px] font-semibold">
            Weight goal
          </h2>
          <Link
            to="/weight/goal"
            className={buttonClass("secondary")}
            aria-label="Edit weight goal"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-[15px]">
          Target <span className="font-semibold">{formatKg(active.targetKg)} kg</span> by{" "}
          {formatDay(active.targetDate)}
        </p>
        {average !== null ? (
          <p className="text-[15px] text-muted">
            {standing?.state === "reached"
              ? `You reached your target. Your 7-day average is ${formatKg(average)} kg.`
              : `Still to lose ${formatKg(average - active.targetKg)} kg from ${formatKg(average)} kg`}
          </p>
        ) : (
          <p className="text-[15px] text-muted">Log a weigh-in to see how far you are.</p>
        )}
        {standing && standing.state !== "reached" && standing.state !== "unknown" ? (
          <p className="mt-2 text-[15px] font-semibold">{STANDING_TEXT[standing.state]}</p>
        ) : null}
        {standing?.state === "reached" ? (
          <Link to="/weight/goal" className={buttonClass("secondary", "mt-3")}>
            Set a new goal
          </Link>
        ) : null}
      </section>
    );
  }

  const rate = weeklyTrendLoss(entries.data, today);
  const cap = average === null ? null : capKgPerWeek(average);
  return (
    <section aria-labelledby={headingId} className="mb-5 rounded-2xl bg-surface p-4">
      <h2 id={headingId} className="text-[17px] font-semibold">
        Weight loss trend
      </h2>
      <dl className="mt-1">
        <Row label="7-day average" value={average === null ? "—" : `${formatKg(average)} kg`} />
        <Row label="Last 4 weeks" value={paceText(rate)} />
      </dl>
      {rate !== null && cap !== null ? (
        <p className="mt-1 text-[15px] font-semibold">
          {rate > cap ? "Faster than the cap" : "Inside the cap"}
        </p>
      ) : null}
      <p className="mt-1 text-[15px] text-muted">
        The plan reacts only if you lose faster than the cap or the trend stalls for 3 weeks.
      </p>
      <Link to="/weight/goal" className={buttonClass("secondary", "mt-3 w-full sm:w-auto")}>
        Set a target and date
      </Link>
    </section>
  );
}

/** R2a and R2b: the weekly pace under the chart (trend, needed pace with a goal, and the cap). */
export function WeightPaceCard() {
  const { goal, entries, pending, visible } = useGoalView();
  const headingId = useId();
  const capId = useId();
  const [open, setOpen] = useState(false);
  const today = brusselsDate() ?? "";

  if (pending || !visible || !entries.data || goal.isError) return null;

  const average = currentAverage(entries.data, today);
  const standing = goal.data ? goalStanding(goal.data, entries.data, today) : null;
  const needed = standing && standing.state !== "reached" ? standing.neededKgPerWeek : null;

  return (
    <section aria-labelledby={headingId} className="mt-5 rounded-2xl bg-surface p-4">
      <h2 id={headingId} className="text-[17px] font-semibold">
        Weekly pace
      </h2>
      <dl className="mt-1">
        <Row
          label="Your trend (last 4 weeks)"
          value={paceText(weeklyTrendLoss(entries.data, today))}
        />
        {needed !== null ? (
          <Row label="Needed to reach the target" value={`${needed.toFixed(2)} kg/week`} />
        ) : null}
        {average !== null ? (
          <Row
            label="Cap (0.5 % of body weight)"
            value={`${capKgPerWeek(average).toFixed(2)} kg/week`}
          />
        ) : null}
      </dl>
      <p className="mt-1 text-[13px] text-muted">
        The cap is the fastest loss the plan will ever aim for.
      </p>
      <Button
        variant="ghost"
        className="mt-1 -ml-2"
        aria-expanded={open}
        aria-controls={capId}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        How the cap works
      </Button>
      {open ? (
        <div id={capId} className="mt-1 text-[15px]">
          <CapExplanation weightKg={average} />
        </div>
      ) : null}
    </section>
  );
}

/** The cap in plain words (R2c): three short sentences and a training-rule note. */
export function CapExplanation({ weightKg }: { weightKg: number | null }) {
  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <p>
        {weightKg === null
          ? "The plan never aims for a loss faster than 0.5 % of your body weight per week."
          : capSentence(weightKg)}{" "}
        A goal that needs more than that is not accepted. Pick a later date or a higher target.
      </p>
      <p className="text-muted">
        Training quality drops when you lose weight quickly, so the plan holds this line. It is a
        training rule, not medical advice.
      </p>
    </div>
  );
}
