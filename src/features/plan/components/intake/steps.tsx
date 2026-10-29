import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { TextField } from "@/components/ui";
import type { Purpose } from "../../engine";
import {
  EVENT_DURATION_OPTIONS,
  formatDuration,
  formatLongDate,
  hasWeightLoss,
  LEVEL_QUESTIONS,
  parseNumber,
  PURPOSE_OPTIONS,
  purposeLabel,
  effectiveStart,
  type IntakeContext,
  type IntakeDraft,
  type IntakeErrors,
} from "../../data";
import { RIDING_ENVIRONMENTS } from "../../schemas";
import { ChoiceRow } from "../parts";

export type StepProps = {
  draft: IntakeDraft;
  change: (patch: Partial<IntakeDraft>) => void;
  errors: IntakeErrors;
  ctx: IntakeContext;
};

/** An error line under a field or group: a warning sign, then the text, wired with aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-[13px] font-medium text-text">
      <span aria-hidden="true" className="mr-1 text-accent">
        !
      </span>
      {children}
    </p>
  );
}

function Fieldset({
  legend,
  children,
  className = "",
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1 text-[13px] font-semibold text-text">{legend}</legend>
      {children}
    </fieldset>
  );
}

// ---- step 1: purposes ----------------------------------------------------------------------------

function RankedList({
  purposes,
  onMove,
}: {
  purposes: readonly Purpose[];
  onMove: (index: number, by: -1 | 1) => void;
}) {
  const [announce, setAnnounce] = useState("");
  const focus = useRef<string | null>(null);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (focus.current === null) return;
    list.current?.querySelector<HTMLElement>(`[data-move="${focus.current}"]`)?.focus();
    focus.current = null;
  }, [purposes]);

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    const purpose = purposes[index];
    if (target < 0 || target >= purposes.length || purpose === undefined) return;
    focus.current = `${purpose}-${by === -1 ? "up" : "down"}`;
    onMove(index, by);
    setAnnounce(`${purposeLabel(purpose)} is now number ${String(target + 1)}`);
  }

  const buttonClass =
    "flex size-11 items-center justify-center rounded-md bg-subtle text-[15px] text-text hover:bg-fill-hover aria-disabled:opacity-50";
  return (
    <div>
      <h3 className="mb-1 text-[13px] font-semibold">Your order</h3>
      <ol ref={list} className="flex flex-col gap-2">
        {purposes.map((purpose, i) => (
          <li
            key={purpose}
            className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-1.5"
          >
            <span aria-hidden="true" className="w-5 text-[15px] font-semibold">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-medium">
              <span className="sr-only">Number {i + 1}: </span>
              {purposeLabel(purpose)}
              {i === 0 ? (
                <span className="ml-2 text-[13px] font-normal text-muted">main</span>
              ) : null}
              {i === 1 ? (
                <span className="ml-2 text-[13px] font-normal text-muted">secondary</span>
              ) : null}
            </span>
            <button
              type="button"
              data-move={`${purpose}-up`}
              aria-label={`Move ${purposeLabel(purpose)} up`}
              aria-disabled={i === 0}
              className={buttonClass}
              onClick={() => {
                move(i, -1);
              }}
            >
              <span aria-hidden="true">▲</span>
            </button>
            <button
              type="button"
              data-move={`${purpose}-down`}
              aria-label={`Move ${purposeLabel(purpose)} down`}
              aria-disabled={i === purposes.length - 1}
              className={buttonClass}
              onClick={() => {
                move(i, 1);
              }}
            >
              <span aria-hidden="true">▼</span>
            </button>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {announce}
      </p>
      <p className="mt-2 text-[13px] text-muted">
        The first purpose shapes most of the plan, the second what is left. Weight loss and muscle
        building pull in different directions, so the plan keeps either small when it is not first.
      </p>
    </div>
  );
}

export function PurposesStep({
  draft,
  change,
  errors,
  ctx,
  weightLabel,
}: StepProps & { weightLabel: string | null }) {
  const full = draft.purposes.length >= 2;
  function toggle(purpose: Purpose) {
    const has = draft.purposes.includes(purpose);
    change({
      purposes: has ? draft.purposes.filter((p) => p !== purpose) : [...draft.purposes, purpose],
    });
  }
  function move(index: number, by: -1 | 1) {
    const next = [...draft.purposes];
    const a = next[index];
    const b = next[index + by];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[index + by] = a;
    change({ purposes: next });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-5">
        <Fieldset legend="Which purposes apply?">
          {PURPOSE_OPTIONS.map((option, i) => {
            const checked = draft.purposes.includes(option.value);
            return (
              <ChoiceRow
                key={option.value}
                type="checkbox"
                name="purpose"
                value={option.value}
                checked={checked}
                disabled={full && !checked}
                invalid={errors.purposes !== undefined && i === 0}
                describedBy="purposes-help purposes-error"
                note={option.help}
                onChange={() => {
                  toggle(option.value);
                }}
              >
                {option.label}
              </ChoiceRow>
            );
          })}
          {errors.purposes ? <FieldError id="purposes-error">{errors.purposes}</FieldError> : null}
          <p id="purposes-help" className="mt-1.5 text-[13px] text-muted">
            Choose one or two: a main purpose and a secondary one. You put them in order next.
          </p>
        </Fieldset>
        {hasWeightLoss(draft.purposes) ? (
          <div className="flex flex-col gap-4">
            <h3 className="text-[17px] font-semibold">Weight loss</h3>
            <TextField
              label="Target weight"
              inputMode="decimal"
              autoComplete="off"
              value={draft.targetKg}
              error={errors.targetKg}
              {...(weightLabel ? { helper: weightLabel } : {})}
              onChange={(e) => {
                change({ targetKg: e.target.value });
              }}
              trailing={<span className="pr-3.5 text-[15px] text-muted">kg</span>}
            />
            <TextField
              label="Target date"
              type="date"
              value={draft.targetDate}
              error={errors.targetDate}
              helper="The plan never plans a loss faster than 0.5 % of your weight per week. If your target is faster, it tells you. Leave the weight and the date empty to only keep that cap."
              onChange={(e) => {
                change({ targetDate: e.target.value });
              }}
            />
            {ctx.weightKg === null ? (
              <p className="text-[13px] text-muted">
                <Link to="/weight" className="font-semibold text-accent underline">
                  Log your weight
                </Link>{" "}
                to set a target.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {draft.purposes.length > 0 ? <RankedList purposes={draft.purposes} onMove={move} /> : null}
    </div>
  );
}

// ---- step 2: level ---------------------------------------------------------------------------------

export function LevelStep({ draft, change, errors }: StepProps) {
  return (
    <div>
      <p className="mb-4 max-w-[60ch] text-[15px] text-muted">
        Five questions. The answers set how much work and how hard the plan starts, from amateur to
        semi-pro. You see the result on the summary and can change it there.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {LEVEL_QUESTIONS.map((q, qi) => {
          const key = `answer${String(qi)}` as "answer0";
          const error = errors[key];
          return (
            <Fieldset key={q.question} legend={q.question}>
              {q.answers.map((answer, ai) => (
                <ChoiceRow
                  key={answer}
                  type="radio"
                  name={`level-${String(qi)}`}
                  value={String(ai)}
                  checked={draft.answers[qi] === ai}
                  invalid={error !== undefined && ai === 0}
                  describedBy={error ? `${key}-error` : undefined}
                  onChange={() => {
                    change({ answers: draft.answers.map((a, i) => (i === qi ? ai : a)) });
                  }}
                >
                  {answer}
                </ChoiceRow>
              ))}
              {error ? <FieldError id={`${key}-error`}>{error}</FieldError> : null}
            </Fieldset>
          );
        })}
      </div>
    </div>
  );
}

// ---- step 3: time and place --------------------------------------------------------------------------

const DAY_LABEL: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const ENV_LABEL = { indoor: "Indoor", outdoor: "Outdoor", both: "Both" } as const;

export function TimeStep({ draft, change, errors, ctx }: StepProps) {
  const hours = parseNumber(draft.hours);
  const days = ctx.availableDays.length;
  const perSession = !Number.isNaN(hours) && days > 0 ? (hours * 60) / days : null;
  return (
    <div className="flex max-w-[480px] flex-col gap-5">
      <TextField
        label="Average hours per week"
        inputMode="decimal"
        autoComplete="off"
        value={draft.hours}
        error={errors.hours}
        helper="Everything you can train in a normal week, including the long ride. Between 1 and 25 hours, in half hours."
        onChange={(e) => {
          change({ hours: e.target.value });
        }}
        trailing={<span className="pr-3.5 text-[15px] text-muted">h</span>}
      />
      {perSession !== null && days > 0 ? (
        <p role="status" className="-mt-3 text-[13px] text-muted">
          With {days} training {days === 1 ? "day" : "days"} that is about{" "}
          {formatDuration(perSession)} per session.
          {perSession > 180
            ? " That is a lot for one day: the plan will assume fewer hours if it does not fit."
            : ""}
        </p>
      ) : null}
      <div>
        <h3 className="mb-1 text-[13px] font-semibold">Training days</h3>
        <div
          aria-describedby={errors.days ? "days-error" : undefined}
          className="rounded-md border border-dashed border-input-border px-3.5 py-3 text-[15px]"
        >
          {days > 0
            ? ctx.availableDays.map((d) => DAY_LABEL[d] ?? d).join(", ")
            : "No training days set"}
        </div>
        {errors.days ? <FieldError id="days-error">{errors.days}</FieldError> : null}
        <p className="mt-1.5 text-[13px] text-muted">
          From your profile.{" "}
          <Link to="/profile" className="font-semibold text-accent underline">
            Change days in your profile
          </Link>
        </p>
      </div>
      {ctx.profileEnvironment !== null ? (
        <div>
          <h3 className="mb-1 text-[13px] font-semibold">Indoor or outdoor</h3>
          <div className="rounded-md border border-dashed border-input-border px-3.5 py-3 text-[15px]">
            {ENV_LABEL[ctx.profileEnvironment]}
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            Set in your profile. Sessions are planned for indoor, outdoor or both.{" "}
            <Link to="/profile" className="font-semibold text-accent underline">
              Change in your profile
            </Link>
          </p>
        </div>
      ) : (
        <Fieldset legend="Indoor or outdoor">
          {RIDING_ENVIRONMENTS.map((env, i) => (
            <ChoiceRow
              key={env}
              type="radio"
              name="environment"
              value={env}
              checked={draft.environment === env}
              invalid={errors.environment !== undefined && i === 0}
              describedBy={errors.environment ? "environment-error" : undefined}
              onChange={() => {
                change({ environment: env });
              }}
            >
              {ENV_LABEL[env]}
            </ChoiceRow>
          ))}
          {errors.environment ? (
            <FieldError id="environment-error">{errors.environment}</FieldError>
          ) : null}
          <p className="mt-1.5 text-[13px] text-muted">
            Saved to your profile. Sessions are planned for indoor, outdoor or both.
          </p>
        </Fieldset>
      )}
    </div>
  );
}

// ---- step 4: start and event ---------------------------------------------------------------------------

export function StartStep({ draft, change, errors, ctx }: StepProps) {
  const next = effectiveStart({ ...draft, startChoice: "next-monday" }, ctx.today);
  const chosen = effectiveStart(draft, ctx.today);
  const moved =
    draft.startChoice === "other" && draft.startDate !== "" && chosen !== draft.startDate;
  return (
    <div className="flex max-w-[480px] flex-col gap-6">
      {ctx.fixedStart ? (
        <div>
          <h3 className="mb-1 text-[13px] font-semibold">Start date</h3>
          <div className="rounded-md border border-dashed border-input-border px-3.5 py-3 text-[15px]">
            {formatLongDate(ctx.fixedStart)}
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            The start date of a plan cannot be changed. To start on another date, remove this plan
            and build a new one.
          </p>
        </div>
      ) : (
        <Fieldset legend="When should the plan start?">
          <ChoiceRow
            type="radio"
            name="start"
            value="next-monday"
            checked={draft.startChoice === "next-monday"}
            note="Plans run Monday to Sunday"
            onChange={() => {
              change({ startChoice: "next-monday" });
            }}
          >
            {formatLongDate(next)}
          </ChoiceRow>
          <ChoiceRow
            type="radio"
            name="start"
            value="other"
            checked={draft.startChoice === "other"}
            onChange={() => {
              change({ startChoice: "other" });
            }}
          >
            Another date
          </ChoiceRow>
          {draft.startChoice === "other" ? (
            <div className="mt-2 pl-8">
              <TextField
                label="Start date"
                type="date"
                value={draft.startDate}
                error={errors.startDate}
                helper={
                  moved
                    ? `Plans run Monday to Sunday, so this plan starts on ${formatLongDate(chosen)}.`
                    : "Plans run Monday to Sunday."
                }
                onChange={(e) => {
                  change({ startDate: e.target.value });
                }}
              />
            </div>
          ) : null}
        </Fieldset>
      )}
      <div>
        <ChoiceRow
          type="checkbox"
          name="has-event"
          value="event"
          checked={draft.hasEvent}
          onChange={() => {
            change({ hasEvent: !draft.hasEvent });
          }}
        >
          I am training for an event
        </ChoiceRow>
        {draft.hasEvent ? (
          <div className="mt-3 flex flex-col gap-4 pl-8">
            <TextField
              label="Event name (optional)"
              autoComplete="off"
              value={draft.eventName}
              error={errors.eventName}
              onChange={(e) => {
                change({ eventName: e.target.value });
              }}
            />
            <TextField
              label="Event date"
              type="date"
              value={draft.eventDate}
              error={errors.eventDate}
              helper="The last weeks before it get lighter (taper). The plan ends on the event day."
              onChange={(e) => {
                change({ eventDate: e.target.value });
              }}
            />
            <Fieldset legend="Expected duration">
              {EVENT_DURATION_OPTIONS.map((o) => (
                <ChoiceRow
                  key={o.value}
                  type="radio"
                  name="event-duration"
                  value={o.value}
                  checked={draft.eventDuration === o.value}
                  onChange={() => {
                    change({ eventDuration: o.value });
                  }}
                >
                  {o.label}
                </ChoiceRow>
              ))}
              <p className="mt-1 text-[13px] text-muted">A longer event gets a longer taper.</p>
            </Fieldset>
          </div>
        ) : null}
      </div>
    </div>
  );
}
