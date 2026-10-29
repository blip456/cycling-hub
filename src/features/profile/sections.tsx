import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { TextField } from "@/components/ui";
import { Checkbox } from "@/features/rides/list/controls";
import { LIMITS, profileSchema, WEEKDAYS, type Weekday } from "@/features/athlete";
import { planProfileSchema, type RidingEnvironment } from "@/features/plan/schemas";
import type { Profile } from "./api";
import { FormButtons, NotSet, ViewRow, type SaveReport } from "./form-parts";
import { formatHours } from "./format";
import { useSaveProfileSection } from "./hooks";
import { ENVIRONMENT_LABEL, SAVE_FAILED } from "./labels";
import { RadioGroup } from "./RadioGroup";
import { SectionCard } from "./SectionCard";
import { TextAreaField } from "./TextAreaField";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "./weekday-labels";

interface SectionProps {
  profile: Profile;
  report: SaveReport;
}

/** Birth year text to a number: empty is null, anything else that is not a number becomes NaN (an error). */
function parseYear(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function AboutForm({ profile, onDone, report }: SectionProps & { onDone: () => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [birthYear, setBirthYear] = useState(profile.birthYear?.toString() ?? "");
  const [errors, setErrors] = useState<{ displayName?: string; birthYear?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = profileSchema().safeParse({ displayName, birthYear: parseYear(birthYear) });
    if (!result.success) {
      const next: { displayName?: string; birthYear?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if ((field === "displayName" || field === "birthYear") && next[field] === undefined) {
          next[field] = issue.message;
        }
      }
      setErrors(next);
      const names = [next.displayName ? "name" : null, next.birthYear ? "birth year" : null].filter(
        Boolean,
      );
      report.fail("about", `Check the ${names.join(" and the ")}, then save again.`);
      (next.displayName ? nameRef : yearRef).current?.focus();
      return;
    }
    setErrors({});
    mutate(
      {
        section: "about",
        displayName: result.data.displayName,
        birthYear: result.data.birthYear,
      },
      {
        onSuccess: () => {
          report.clear("about");
          onDone();
        },
        onError: () => {
          report.fail("about", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
      <TextField
        ref={nameRef}
        label="Display name"
        helper="Shown on this page only. Optional."
        error={errors.displayName}
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
        }}
        autoComplete="off"
      />
      <TextField
        ref={yearRef}
        label="Birth year"
        helper="Four digits. Used for heart rate estimates. Optional."
        error={errors.birthYear}
        value={birthYear}
        onChange={(e) => {
          setBirthYear(e.target.value);
        }}
        inputMode="numeric"
        autoComplete="off"
      />
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("about");
          onDone();
        }}
      />
    </form>
  );
}

/** H1 to H3: display name and birth year. */
export function AboutSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard
      title="About you"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.displayName === null && profile.birthYear === null}
      emptyText="No name or birth year yet."
      addLabel="Add details"
      view={
        <div className="mt-1">
          <ViewRow label="Display name">{profile.displayName ?? <NotSet />}</ViewRow>
          <ViewRow label="Birth year">
            {profile.birthYear === null ? (
              <NotSet />
            ) : (
              <span className="tabular-nums">{profile.birthYear}</span>
            )}
          </ViewRow>
        </div>
      }
      form={
        <AboutForm
          profile={profile}
          report={report}
          onDone={() => {
            setEditing(false);
          }}
        />
      }
    />
  );
}

const ENVIRONMENT_OPTIONS = [
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
  { value: "both", label: "Both" },
] as const;

/** Hours text to a number: empty is null, comma counts as decimal separator, other text becomes NaN (an error). */
function parseHours(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
}

function WeekForm({ profile, onDone, report }: SectionProps & { onDone: () => void }) {
  const [days, setDays] = useState<Weekday[]>(profile.availableDays);
  const [hours, setHours] = useState(profile.weeklyHours?.toString() ?? "");
  const [environment, setEnvironment] = useState<RidingEnvironment | null>(
    profile.ridingEnvironment,
  );
  const [errors, setErrors] = useState<{ hours?: string; environment?: string }>({});
  const legendRef = useRef<HTMLFieldSetElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    legendRef.current?.querySelector("input")?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const daysResult = profileSchema().safeParse({ availableDays: days });
    const planResult = planProfileSchema().safeParse({
      weeklyHours: parseHours(hours),
      ridingEnvironment: environment,
    });
    if (!daysResult.success || !planResult.success) {
      const next: { hours?: string; environment?: string } = {};
      if (!planResult.success) {
        for (const issue of planResult.error.issues) {
          const field = issue.path[0];
          if (field === "weeklyHours" && next.hours === undefined) next.hours = issue.message;
          if (field === "ridingEnvironment" && next.environment === undefined)
            next.environment = issue.message;
        }
      }
      setErrors(next);
      report.fail("week", "Check the training week, then save again.");
      if (next.hours) hoursRef.current?.focus();
      return;
    }
    setErrors({});
    mutate(
      {
        section: "week",
        availableDays: daysResult.data.availableDays,
        weeklyHours: planResult.data.weeklyHours,
        ridingEnvironment: planResult.data.ridingEnvironment,
      },
      {
        onSuccess: () => {
          report.clear("week");
          onDone();
        },
        onError: () => {
          report.fail("week", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-5">
      <fieldset ref={legendRef}>
        <legend className="mb-1 text-[13px] font-semibold">Available training days</legend>
        <div className="divide-y divide-border">
          {WEEKDAYS.map((day) => (
            <div key={day}>
              <Checkbox
                checked={days.includes(day)}
                onChange={(checked) => {
                  setDays((current) =>
                    checked ? [...current, day] : current.filter((d) => d !== day),
                  );
                }}
              >
                {WEEKDAY_LONG[day]}
              </Checkbox>
            </div>
          ))}
        </div>
      </fieldset>
      <TextField
        ref={hoursRef}
        label="Average hours per week"
        helper="Hours you can train in a normal week, from 1 to 25. Half hours are fine. Optional."
        error={errors.hours}
        value={hours}
        onChange={(e) => {
          setHours(e.target.value);
        }}
        inputMode="decimal"
        autoComplete="off"
        trailing={
          <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
            h
          </span>
        }
      />
      <RadioGroup
        legend="Where do you ride?"
        options={ENVIRONMENT_OPTIONS}
        value={environment}
        onChange={setEnvironment}
        error={errors.environment}
        helper="Sessions are planned for this. With Both, each session works inside and outside."
        inline
      />
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("week");
          onDone();
        }}
      />
    </form>
  );
}

/**
 * H1 to H3 and R1: available training days, average hours per week and where you ride. Selected days are
 * filled and bold; the screen reader hears the state.
 */
export function WeekSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard
      title="Training week"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={
        profile.availableDays.length === 0 &&
        profile.weeklyHours === null &&
        profile.ridingEnvironment === null
      }
      emptyText="No available days, hours or riding place yet."
      addLabel="Add your week"
      view={
        <>
          <p className="mt-1 text-[15px] text-muted">Available days</p>
          <ul className="mt-2 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((day) => {
              const on = profile.availableDays.includes(day);
              return (
                <li
                  key={day}
                  className={
                    "flex min-h-11 items-center justify-center rounded-md border px-0.5 text-[13px] " +
                    (on
                      ? "border-text bg-text font-bold text-surface"
                      : "border-input-border text-muted")
                  }
                >
                  {WEEKDAY_SHORT[day]}
                  <span className="sr-only">{on ? ", available" : ", not available"}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2">
            <ViewRow label="Average hours per week">
              {profile.weeklyHours === null ? (
                <NotSet />
              ) : (
                <span className="tabular-nums">{formatHours(profile.weeklyHours)}</span>
              )}
            </ViewRow>
            <ViewRow label="Where you ride">
              {profile.ridingEnvironment === null ? (
                <NotSet />
              ) : (
                ENVIRONMENT_LABEL[profile.ridingEnvironment]
              )}
            </ViewRow>
          </div>
        </>
      }
      form={
        <WeekForm
          profile={profile}
          report={report}
          onDone={() => {
            setEditing(false);
          }}
        />
      }
    />
  );
}

function GoalForm({ profile, onDone, report }: SectionProps & { onDone: () => void }) {
  const [goal, setGoal] = useState(profile.goal ?? "");
  const [error, setError] = useState<string | undefined>();
  const ref = useRef<HTMLTextAreaElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = profileSchema().safeParse({ goal });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      report.fail("goal", "Check the goal, then save again.");
      ref.current?.focus();
      return;
    }
    setError(undefined);
    mutate(
      { section: "goal", goal: result.data.goal },
      {
        onSuccess: () => {
          report.clear("goal");
          onDone();
        },
        onError: () => {
          report.fail("goal", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2">
      <TextAreaField
        ref={ref}
        label="Goal"
        helper={`Optional. One or two sentences, ${LIMITS.goalMax} characters at most.`}
        counter={`${goal.length} / ${LIMITS.goalMax}`}
        error={error}
        value={goal}
        onChange={(e) => {
          setGoal(e.target.value);
        }}
      />
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("goal");
          onDone();
        }}
      />
    </form>
  );
}

/** H1 to H3: one free-text goal, no date (H-PO3). */
export function GoalSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard
      title="Goal"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.goal === null}
      emptyText="No goal yet."
      addLabel="Add a goal"
      view={<p className="mt-1 text-[15px] break-words whitespace-pre-wrap">{profile.goal}</p>}
      form={
        <GoalForm
          profile={profile}
          report={report}
          onDone={() => {
            setEditing(false);
          }}
        />
      }
    />
  );
}
