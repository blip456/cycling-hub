import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from "react";
import { Button, TextField } from "@/components/ui";
import { Checkbox } from "@/features/rides/list/controls";
import { LIMITS, profileSchema, WEEKDAYS, type Weekday } from "@/features/athlete";
import type { Profile } from "./api";
import { useSaveProfileSection } from "./hooks";
import { SectionCard } from "./SectionCard";
import { TextAreaField } from "./TextAreaField";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "./weekday-labels";

export type SectionId = "about" | "week" | "goal";

/** How a section tells the page that a save failed ("Not saved" card, P12) or is no longer relevant. */
export type SaveReport = {
  fail: (section: SectionId, message: string) => void;
  clear: (section: SectionId) => void;
};

interface SectionProps {
  profile: Profile;
  report: SaveReport;
}

const SAVE_FAILED = "Something went wrong. Try again.";

function FormButtons({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-5 flex gap-3">
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}

function ViewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 break-words text-right">{children}</span>
    </div>
  );
}

const NOT_SET = <span className="text-muted">Not set</span>;

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
          <ViewRow label="Display name">{profile.displayName ?? NOT_SET}</ViewRow>
          <ViewRow label="Birth year">
            {profile.birthYear === null ? (
              NOT_SET
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

function WeekForm({ profile, onDone, report }: SectionProps & { onDone: () => void }) {
  const [days, setDays] = useState<Weekday[]>(profile.availableDays);
  const legendRef = useRef<HTMLFieldSetElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    legendRef.current?.querySelector("input")?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = profileSchema().safeParse({ availableDays: days });
    if (!result.success) {
      report.fail("week", "Check the training days, then save again.");
      return;
    }
    mutate(
      { section: "week", availableDays: result.data.availableDays },
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
    <form onSubmit={submit} noValidate className="mt-2">
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

/** H1 to H3: available training days. Selected days are filled and bold; the screen reader hears the state. */
export function WeekSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard
      title="Training week"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.availableDays.length === 0}
      emptyText="No available days yet."
      addLabel="Add days"
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
