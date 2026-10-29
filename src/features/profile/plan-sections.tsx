import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import type { Level } from "@/features/plan/engine";
import {
  planProfileSchema,
  TRAINING_PURPOSES,
  trainingPurposesSchema,
  type TrainingPurpose,
} from "@/features/plan/schemas";
import { Checkbox } from "@/features/rides/list/controls";
import type { Profile } from "./api";
import { FormButtons, NotSet, ViewRow, type SaveReport } from "./form-parts";
import { countdownText, formatLongDate } from "./format";
import { useSaveProfileSection } from "./hooks";
import { scoredLevel, toEngineAnswers } from "./level";
import { LEVEL_LABEL, LEVEL_QUESTIONS, PURPOSE_LABEL, SAVE_FAILED } from "./labels";
import { RadioGroup } from "./RadioGroup";
import { SectionCard } from "./SectionCard";

interface SectionProps {
  profile: Profile;
  report: SaveReport;
}

type FormProps = SectionProps & { onDone: () => void };

// ---- purposes (P65, P75) -----------------------------------------------------------------------------

type Direction = "up" | "down";

function PurposesForm({ profile, onDone, report }: FormProps) {
  const [chosen, setChosen] = useState<TrainingPurpose[]>(profile.trainingPurposes);
  const [error, setError] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ purpose: TrainingPurpose; to: Direction }>();
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    groupRef.current?.querySelector("input")?.focus();
  }, []);

  // After a move the focus stays with the moved row: on the same button, or on the other one when the
  // row reached the end of the list and the button is disabled there.
  useEffect(() => {
    if (!focusRequest) return;
    const row = listRef.current?.querySelector(`[data-purpose="${focusRequest.purpose}"]`);
    const buttons = row ? [...row.querySelectorAll("button")] : [];
    const wanted = buttons.find((b) => b.dataset["direction"] === focusRequest.to);
    const other = buttons.find((b) => b.dataset["direction"] !== focusRequest.to);
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [focusRequest, chosen]);

  const move = (purpose: TrainingPurpose, direction: Direction) => {
    const index = chosen.indexOf(purpose);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= chosen.length) return;
    const next = [...chosen];
    next.splice(index, 1);
    next.splice(target, 0, purpose);
    setChosen(next);
    setFocusRequest({ purpose, to: direction });
    setAnnouncement(`${PURPOSE_LABEL[purpose]} moved to position ${target + 1}`);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = trainingPurposesSchema.safeParse(chosen);
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      report.fail("purposes", "Check the training purposes, then save again.");
      groupRef.current?.querySelector("input")?.focus();
      return;
    }
    setError(undefined);
    mutate(
      { section: "purposes", trainingPurposes: result.data },
      {
        onSuccess: () => {
          report.clear("purposes");
          onDone();
        },
        onError: () => {
          report.fail("purposes", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-5">
      <fieldset ref={groupRef}>
        <legend className="mb-1 text-[13px] font-semibold">What do you want to work on?</legend>
        <div className="divide-y divide-border">
          {TRAINING_PURPOSES.map((purpose) => (
            <div key={purpose}>
              <Checkbox
                checked={chosen.includes(purpose)}
                onChange={(checked) => {
                  setError(undefined);
                  setChosen((current) =>
                    checked
                      ? [...current, purpose]
                      : current.filter((existing) => existing !== purpose),
                  );
                }}
              >
                {PURPOSE_LABEL[purpose]}
              </Checkbox>
            </div>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-1.5 text-[13px] font-medium text-text">
            <span aria-hidden="true" className="mr-1 text-accent">
              !
            </span>
            {error}
          </p>
        ) : null}
        <p className="mt-1.5 text-[13px] text-muted">
          Choose one or two: the first counts as the main purpose, the second as the secondary one.
        </p>
      </fieldset>

      {chosen.length > 0 ? (
        <div>
          <h3 className="mb-1 text-[13px] font-semibold">Order of importance</h3>
          <ol ref={listRef} className="divide-y divide-border">
            {chosen.map((purpose, index) => (
              <li
                key={purpose}
                data-purpose={purpose}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-1 text-[15px]"
              >
                <span>
                  {PURPOSE_LABEL[purpose]}
                  <span className="ml-2 text-[13px] text-muted">
                    {index === 0 ? "main purpose" : "second"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="secondary"
                    data-direction="up"
                    disabled={index === 0}
                    aria-label={`Move ${PURPOSE_LABEL[purpose]} up`}
                    onClick={() => {
                      move(purpose, "up");
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="secondary"
                    data-direction="down"
                    disabled={index === chosen.length - 1}
                    aria-label={`Move ${PURPOSE_LABEL[purpose]} down`}
                    onClick={() => {
                      move(purpose, "down");
                    }}
                  >
                    Move down
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[13px] text-muted">
            The first one counts most. If two purposes pull in different directions, the higher one
            wins and the plan says so.
          </p>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("purposes");
          onDone();
        }}
      />
    </form>
  );
}

/** R1, R1b: the training purposes in rank order, moved with Move up and Move down (no dragging, WCAG 2.5.7). */
export function PurposesSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const rest = TRAINING_PURPOSES.filter((p) => !profile.trainingPurposes.includes(p));
  return (
    <SectionCard
      title="Training purposes"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.trainingPurposes.length === 0}
      emptyText="No purposes yet. Without them the plan builds endurance."
      addLabel="Add purposes"
      view={
        <>
          <p className="mt-1 text-[13px] text-muted">In order of importance</p>
          <ol className="mt-1">
            {profile.trainingPurposes.map((purpose, index) => (
              <li key={purpose} className="flex min-h-11 items-center gap-2 text-[15px]">
                <span className="tabular-nums">{index + 1}.</span>
                <span>{PURPOSE_LABEL[purpose]}</span>
                <span className="text-[13px] text-muted">
                  {index === 0 ? "main purpose" : "second"}
                </span>
              </li>
            ))}
          </ol>
          {rest.length > 0 ? (
            <p className="mt-1 text-[13px] text-muted">
              Not selected: {rest.map((p) => PURPOSE_LABEL[p].toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </>
      }
      form={
        <PurposesForm
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

// ---- level (P60) --------------------------------------------------------------------------------------

const LEVEL_OPTIONS = [
  { value: "amateur", label: LEVEL_LABEL.amateur },
  { value: "committed", label: LEVEL_LABEL.committed },
  { value: "semi-pro", label: LEVEL_LABEL["semi-pro"] },
] as const;

function LevelForm({ profile, onDone, report }: FormProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    profile.levelAnswers ?? LEVEL_QUESTIONS.map(() => null),
  );
  const initialScored = scoredLevel(answers, profile.weeklyHours);
  const [override, setOverride] = useState<Level | null>(
    profile.level !== null && initialScored && profile.level !== initialScored.level
      ? profile.level
      : null,
  );
  const [error, setError] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    formRef.current?.querySelector("input")?.focus();
  }, []);

  const scored = scoredLevel(answers, profile.weeklyHours);
  const chosen = override ?? scored?.level ?? null;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stored = toEngineAnswers(answers);
    const outcome = scoredLevel(answers, profile.weeklyHours);
    if (!stored || !outcome) {
      setError("Answer all five questions.");
      report.fail("level", "Check the level questions, then save again.");
      formRef.current?.querySelector("input")?.focus();
      return;
    }
    setError(undefined);
    mutate(
      {
        section: "level",
        levelAnswers: answers.map((a) => a ?? 0),
        level: override ?? outcome.level,
      },
      {
        onSuccess: () => {
          report.clear("level");
          onDone();
        },
        onError: () => {
          report.fail("level", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="mt-2 flex flex-col gap-5">
      {LEVEL_QUESTIONS.map((question, index) => (
        <RadioGroup
          key={question.legend}
          legend={question.legend}
          options={question.answers.map((label, value) => ({ value: String(value), label }))}
          value={
            answers[index] === null || answers[index] === undefined ? null : String(answers[index])
          }
          onChange={(value) => {
            setError(undefined);
            setAnswers((current) => current.map((a, i) => (i === index ? Number(value) : a)));
          }}
        />
      ))}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-text">
          <span aria-hidden="true" className="mr-1 text-accent">
            !
          </span>
          {error}
        </p>
      ) : null}
      {scored ? (
        <p aria-live="polite" className="rounded-md bg-subtle px-3.5 py-3 text-[15px]">
          Your answers score {scored.score} of 15: {LEVEL_LABEL[scored.band].toLowerCase()}.
          {scored.band !== scored.level
            ? ` Lowered to ${LEVEL_LABEL[scored.level].toLowerCase()} because you train fewer hours a week than that level needs.`
            : ""}
        </p>
      ) : null}
      {scored ? (
        <RadioGroup
          legend="Level the plan uses"
          options={LEVEL_OPTIONS}
          value={chosen}
          onChange={(value) => {
            setOverride(value === scored.level ? null : value);
          }}
          helper="Sets how much work the plan assumes. Change it if the scored level does not fit."
          inline
        />
      ) : null}
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("level");
          onDone();
        }}
      />
    </form>
  );
}

/** R1: the level, scored from five answers (engine rules section 3) and changeable by the PO. */
export function LevelSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const scored = profile.levelAnswers
    ? scoredLevel(profile.levelAnswers, profile.weeklyHours)
    : null;
  const changed = profile.level !== null && scored !== null && profile.level !== scored.level;
  return (
    <SectionCard
      title="Level"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.level === null && profile.levelAnswers === null}
      emptyText="No level yet. Five short questions set it."
      addLabel="Answer the questions"
      view={
        <div className="mt-1">
          <ViewRow label="Level">
            {profile.level === null ? <NotSet /> : LEVEL_LABEL[profile.level]}
          </ViewRow>
          {scored ? (
            <p className="text-[13px] text-muted">
              {changed
                ? `You changed it. Your answers score ${scored.score} of 15: ${LEVEL_LABEL[scored.level].toLowerCase()}.`
                : `Scored from your answers: ${scored.score} of 15.`}
            </p>
          ) : null}
        </div>
      }
      form={
        <LevelForm
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

// ---- event (P66, P77) ---------------------------------------------------------------------------------

function EventForm({ profile, onDone, report }: FormProps) {
  const [name, setName] = useState(profile.eventName ?? "");
  const [date, setDate] = useState(profile.eventDate ?? "");
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useSaveProfileSection();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = planProfileSchema().safeParse({
      eventName: name,
      eventDate: date === "" ? null : date,
    });
    if (!result.success) {
      const next: { name?: string; date?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "eventName" && next.name === undefined) next.name = issue.message;
        if (field === "eventDate" && next.date === undefined) next.date = issue.message;
      }
      setErrors(next);
      const parts = [next.name ? "event name" : null, next.date ? "event date" : null].filter(
        Boolean,
      );
      report.fail("event", `Check the ${parts.join(" and the ")}, then save again.`);
      (next.name ? nameRef : dateRef).current?.focus();
      return;
    }
    setErrors({});
    mutate(
      {
        section: "event",
        eventName: result.data.eventName,
        eventDate: result.data.eventDate,
      },
      {
        onSuccess: () => {
          report.clear("event");
          onDone();
        },
        onError: () => {
          report.fail("event", SAVE_FAILED);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4">
      <TextField
        ref={nameRef}
        label="Event name"
        helper="Optional. Leave both fields empty if there is no event."
        error={errors.name}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        autoComplete="off"
      />
      <TextField
        ref={dateRef}
        type="date"
        label="Event date"
        helper="From tomorrow. The plan needs at least 4 weeks to build up to it."
        error={errors.date}
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
        }}
      />
      <FormButtons
        saving={isPending}
        onCancel={() => {
          report.clear("event");
          onDone();
        }}
      />
    </form>
  );
}

/** R1, R1b: one optional event with a name and a date; the plan is built backwards from it (P66, P77). */
export function EventSection({ profile, report }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const today = brusselsDate() ?? "";
  return (
    <SectionCard
      title="Event"
      editing={editing}
      onEdit={() => {
        setEditing(true);
      }}
      empty={profile.eventName === null && profile.eventDate === null}
      emptyText="No event. The plan builds general fitness."
      addLabel="Add an event"
      view={
        <div className="mt-1">
          <ViewRow label="Name">{profile.eventName ?? <NotSet />}</ViewRow>
          <ViewRow label="Date">
            {profile.eventDate === null ? <NotSet /> : formatLongDate(profile.eventDate)}
          </ViewRow>
          {profile.eventDate !== null ? (
            <p className="text-[13px] text-muted">
              {countdownText(today, profile.eventDate)} The plan builds a lighter last week before
              it.
            </p>
          ) : null}
        </div>
      }
      form={
        <EventForm
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
