import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { buttonClass } from "@/components/button-class";
import { PageLoading } from "@/components/PageLoading";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { Button, EmptyState, TextField } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import { useProfile } from "@/features/profile/hooks";
import { weightGoalSchema } from "@/features/plan/schemas";
import { formatDay, formatKg, parseKg } from "./format";
import { useActiveWeightGoal, useCancelWeightGoal, useSaveWeightGoal } from "./goal-hooks";
import { checkGoal, currentAverage } from "./goal-model";
import { useWeightEntries } from "./hooks";
import { CapExplanation } from "./WeightGoalCards";

type Errors = {
  target?: string | undefined;
  date?: string | undefined;
  earliest?: string | undefined;
};

/**
 * R2c: set the weight goal (target weight and date), checked against the weekly-rate cap. A date that needs
 * more than the cap is an error that says what is wrong, why, and offers the earliest date as a fix; "Use
 * <date>" only fills the field. The cap is explained on the page, not behind a tooltip. Saving cancels the
 * old goal first (one active goal).
 */
export function GoalPage() {
  const entries = useWeightEntries();
  const goal = useActiveWeightGoal();
  const profile = useProfile();
  if (entries.isPending || goal.isPending) return <PageLoading />;
  if (entries.isError || goal.isError) {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>The weight goal could not be loaded.</EmptyState>
        <Button
          variant="secondary"
          onClick={() => {
            void entries.refetch();
            void goal.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  const today = brusselsDate() ?? "";
  const average = currentAverage(entries.data, today);
  if (average === null) {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>Log a weigh-in first. The goal starts from your latest weight.</EmptyState>
        <Link to="/weight" className={buttonClass("secondary")}>
          Go to the weight log
        </Link>
      </div>
    );
  }
  return (
    <GoalForm
      average={average}
      today={today}
      previous={goal.data}
      defaultDate={profile.data?.eventDate ?? null}
    />
  );
}

function GoalForm({
  average,
  today,
  previous,
  defaultDate,
}: {
  average: number;
  today: string;
  previous: ReturnType<typeof useActiveWeightGoal>["data"];
  defaultDate: string | null;
}) {
  const navigate = useNavigate();
  const save = useSaveWeightGoal();
  const cancel = useCancelWeightGoal();
  const [target, setTarget] = useState(previous ? String(previous.targetKg) : "");
  const [date, setDate] = useState(previous?.targetDate ?? defaultDate ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [notSaved, setNotSaved] = useState<string | null>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    targetRef.current?.focus();
  }, []);

  useStatusCard(
    "weight-goal-not-saved",
    STATUS_PRIORITY.error,
    notSaved
      ? {
          tone: "error",
          message: (
            <>
              <span className="block font-semibold">Goal not saved</span>
              <span className="block">{notSaved}</span>
            </>
          ),
          onDismiss: () => {
            setNotSaved(null);
          },
        }
      : null,
  );

  const fail = (next: Errors, message: string, focus: "target" | "date") => {
    setErrors(next);
    setNotSaved(message);
    (focus === "target" ? targetRef : dateRef).current?.focus();
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = weightGoalSchema().safeParse({
      targetKg: parseKg(target),
      targetDate: date,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "targetKg" && next.target === undefined) next.target = issue.message;
        if (field === "targetDate" && next.date === undefined)
          next.date = date === "" ? "Pick a target date." : issue.message;
      }
      fail(
        next,
        "Check the target weight and the date, then save again.",
        next.target ? "target" : "date",
      );
      return;
    }
    const check = checkGoal({
      startKg: average,
      targetKg: parsed.data.targetKg,
      targetDate: parsed.data.targetDate,
      today,
    });
    if (!check.ok) {
      const next: Errors =
        check.field === "target" ? { target: check.message } : { date: check.message };
      if (check.earliestDate) next.earliest = check.earliestDate;
      fail(
        next,
        check.earliestDate
          ? "The date is too soon for this target. Pick a later date."
          : "Check the target weight and the date, then save again.",
        check.field,
      );
      return;
    }
    setErrors({});
    save.mutate(
      {
        goal: {
          targetKg: parsed.data.targetKg,
          targetDate: parsed.data.targetDate,
          startKg: Math.round(average * 100) / 100,
          startDate: today,
        },
        previous: previous ?? null,
      },
      {
        onSuccess: () => {
          void navigate("/weight/trend");
        },
        onError: () => {
          setNotSaved("Something went wrong. Try again.");
        },
      },
    );
  };

  return (
    <div className="flex max-w-[560px] flex-col gap-4 lg:max-w-[1000px] lg:grid lg:grid-cols-2 lg:items-start">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
        <h2 className="text-[17px] font-semibold">Set your goal</h2>
        <TextField
          ref={targetRef}
          label="Target weight"
          helper={`Your 7-day average is ${formatKg(average)} kg today.`}
          error={errors.target}
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
          }}
          inputMode="decimal"
          autoComplete="off"
          trailing={
            <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
              kg
            </span>
          }
        />
        <div>
          <TextField
            ref={dateRef}
            type="date"
            label="Target date"
            helper="From tomorrow."
            error={errors.date}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
          {errors.earliest ? (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setDate(errors.earliest ?? "");
                setErrors((current) => ({ ...current, date: undefined, earliest: undefined }));
                dateRef.current?.focus();
              }}
            >
              Use {formatDay(errors.earliest)}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            disabled={save.isPending}
            onClick={() => {
              void navigate("/weight/trend");
            }}
          >
            Cancel
          </Button>
          {previous ? (
            <Button
              variant="ghost"
              disabled={save.isPending || cancel.isPending}
              onClick={() => {
                cancel.mutate(undefined, {
                  onSuccess: () => {
                    void navigate("/weight/trend");
                  },
                  onError: () => {
                    setNotSaved("The goal could not be removed. Try again.");
                  },
                });
              }}
            >
              Remove the goal
            </Button>
          ) : null}
        </div>
      </form>
      <section aria-labelledby="cap-heading" className="rounded-2xl bg-surface p-4">
        <h2 id="cap-heading" className="mb-2 text-[17px] font-semibold">
          How the cap works
        </h2>
        <CapExplanation weightKg={average} />
      </section>
    </div>
  );
}
