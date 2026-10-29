import { useContext, useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  STATUS_PRIORITY,
  StatusRegistryContext,
  statusActionClass,
  useStatusCard,
} from "@/components/status/status-context";
import { Button } from "@/components/ui";
import { useBaseline } from "@/features/baseline/hooks";
import { useMediaQuery, DESKTOP_QUERY } from "@/lib/use-media-query";
import { buildPlan } from "../engine";
import {
  draftFromProfile,
  engineInput,
  firstInvalidStep,
  formatDay,
  goalOf,
  hasWeightLoss,
  INTAKE_STEPS,
  intakeToday,
  profilePatchFor,
  useActiveWeightGoal,
  useCreatePlan,
  useCurrentWeight,
  usePlan,
  usePlanProfile,
  useSavePlanProfile,
  validateStep,
  type EngineContext,
  type IntakeDraft,
  type IntakeErrors,
  type IntakeStep,
} from "../data";
import { BaselineNeeded } from "../components/NoPlan";
import { usePlanLoadErrorCard } from "../components/page-hooks";
import { PlanLoadError, PlanSkeleton } from "../components/parts";
import { Summary } from "../components/intake/Summary";
import {
  LevelStep,
  PurposesStep,
  StartStep,
  TimeStep,
  type StepProps,
} from "../components/intake/steps";

const TITLES: Record<IntakeStep | "summary", string> = {
  1: "What do you want from this plan?",
  2: "Tell us about your riding",
  3: "How much time do you have?",
  4: "When do you start?",
  summary: "Check your answers",
};

const NEXT_LABEL: Record<IntakeStep, string> = {
  1: "Next: Level",
  2: "Next: Time and place",
  3: "Next: Start and event",
  4: "Review the summary",
};

const READY_MS = 8000;
const READY_ID = "plan-ready";
let readyTimer: ReturnType<typeof setTimeout> | undefined;

function parseStep(value: string | null): IntakeStep | "summary" {
  if (value === "summary") return "summary";
  const n = Number(value);
  return n === 2 || n === 3 || n === 4 ? n : 1;
}

/** The step bar: "Step 1 of 4" as text on the phone, a list of the steps with aria-current on desktop. */
function Progress({ step, desktop }: { step: IntakeStep | "summary"; desktop: boolean }) {
  const index = step === "summary" ? 5 : step;
  if (desktop)
    return (
      <nav aria-label="Steps" className="w-52 shrink-0">
        <ol className="flex flex-col gap-1">
          {[...INTAKE_STEPS, { step: 5, name: "Summary" }].map((s) => (
            <li
              key={s.step}
              aria-current={s.step === index ? "step" : undefined}
              className={
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] " +
                (s.step === index ? "bg-subtle font-semibold" : "text-muted")
              }
            >
              <span aria-hidden="true" className="w-4 text-center">
                {s.step < index ? "✓" : s.step}
              </span>
              <span>
                {s.name}
                {s.step < index ? <span className="sr-only"> (done)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </nav>
    );
  return (
    <div className="mb-4">
      <p className="text-[13px] font-semibold text-muted">
        {step === "summary" ? "Summary" : `Step ${String(step)} of 4`}
      </p>
      <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${String(Math.min(index, 4) * 25)}%` }}
        />
      </div>
    </div>
  );
}

function IntakeForm({
  initial,
  baseline,
  availableDays,
  profileEnvironment,
  hasExisting,
}: {
  initial: IntakeDraft;
  baseline: { ftp: number; lthr: number | null; maxHr: number | null };
  availableDays: EngineContext["availableDays"];
  profileEnvironment: EngineContext["profileEnvironment"];
  hasExisting: boolean;
}) {
  const navigate = useNavigate();
  const registry = useContext(StatusRegistryContext);
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const today = intakeToday();
  const weight = useCurrentWeight(today);
  const saveProfile = useSavePlanProfile();
  const create = useCreatePlan();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [focusTick, setFocusTick] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);
  const step = parseStep(params.get("step"));

  const ctx: EngineContext = useMemo(
    () => ({
      today,
      weightKg: weight.weight?.kg ?? null,
      availableDays,
      profileEnvironment,
      ftp: baseline.ftp,
      lthr: baseline.lthr,
      maxHr: baseline.maxHr,
    }),
    [today, weight.weight?.kg, availableDays, profileEnvironment, baseline],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (focusTick === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  useStatusCard(
    "plan-intake-save",
    STATUS_PRIORITY.error,
    saveFailed
      ? {
          tone: "error",
          message: "Your answers could not be saved to your profile. They are kept on this page.",
          onDismiss: () => {
            setSaveFailed(false);
          },
        }
      : null,
  );

  const preview = useMemo(() => {
    if (step !== "summary") return null;
    const input = engineInput(draft, ctx);
    if (!input) return null;
    const calculated = engineInput(draft, ctx, null);
    return {
      input,
      plan: buildPlan(input),
      calculatedLevel: calculated ? buildPlan(calculated).level : buildPlan(input).level,
    };
  }, [step, draft, ctx]);

  function change(patch: Partial<IntakeDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const touched = new Set(Object.keys(patch));
      return Object.fromEntries(Object.entries(e).filter(([key]) => !touched.has(key)));
    });
  }

  function goTo(next: IntakeStep | "summary") {
    setParams({ step: String(next) });
  }

  function onNext(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "summary") return;
    const found = validateStep(step, draft, ctx);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFocusTick((t) => t + 1);
      return;
    }
    const patch = profilePatchFor(step, draft, ctx);
    saveProfile.mutate(patch, {
      onError: () => {
        setSaveFailed(true);
      },
    });
    goTo(step === 4 ? "summary" : ((step + 1) as IntakeStep));
  }

  function onBack() {
    if (step === 1) void navigate("/plan");
    else goTo(step === "summary" ? 4 : ((step - 1) as IntakeStep));
  }

  function build() {
    if (!preview || preview.plan.status !== "ok") return;
    const { plan, input } = preview;
    const goal = goalOf(draft);
    const startKg = ctx.weightKg;
    setBuildFailed(false);
    create.mutate(
      {
        newPlan: {
          plan,
          intake: input.intake,
          ftp: baseline.ftp,
          weightKg: input.intake.weightKg ?? null,
        },
        ...(hasWeightLoss(draft.purposes)
          ? { goal: goal && startKg !== null ? { ...goal, startKg } : null }
          : {}),
      },
      {
        onSuccess: (saved) => {
          if (registry) {
            registry.set(READY_ID, STATUS_PRIORITY.flash, {
              tone: "success",
              message: `Your plan is ready. ${String(saved.weeks)} weeks from ${formatDay(saved.startDate)}`,
              onDismiss: () => {
                registry.set(READY_ID, STATUS_PRIORITY.flash, null);
              },
            });
            if (readyTimer !== undefined) clearTimeout(readyTimer);
            readyTimer = setTimeout(() => {
              readyTimer = undefined;
              registry.set(READY_ID, STATUS_PRIORITY.flash, null);
            }, READY_MS);
          }
          void navigate("/plan");
        },
        onError: () => {
          setBuildFailed(true);
        },
      },
    );
  }

  useStatusCard(
    "plan-build-failed",
    STATUS_PRIORITY.error,
    buildFailed
      ? {
          tone: "error",
          message: (
            <>
              <strong className="font-semibold">Plan not built</strong>
              <br />
              Nothing was saved and your answers are kept. Try again.
            </>
          ),
          action: (
            <button type="button" className={statusActionClass} onClick={build}>
              Try again
            </button>
          ),
          onDismiss: () => {
            setBuildFailed(false);
          },
        }
      : null,
  );

  const weightLabel =
    ctx.weightKg !== null
      ? `Your latest weight is ${ctx.weightKg.toFixed(1)} kg (7-day average).`
      : null;
  const stepProps: StepProps = { draft, change, errors, ctx };
  const missing = step === "summary" ? firstInvalidStep(draft, ctx) : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <Progress step={step} desktop={desktop} />
      <section aria-labelledby="intake-heading" className="min-w-0 flex-1">
        <h2
          id="intake-heading"
          ref={headingRef}
          tabIndex={-1}
          className="mb-4 text-xl font-semibold tracking-tight outline-none"
        >
          {TITLES[step]}
        </h2>
        {step === "summary" ? (
          missing !== null || !preview ? (
            <div role="alert" className="max-w-[560px] rounded-md bg-subtle px-4 py-3 text-[15px]">
              <p className="font-semibold">Some answers are missing</p>
              <p className="mt-1">
                <Link
                  to={`/plan/new?step=${String(missing ?? 1)}`}
                  className="font-semibold text-accent underline"
                >
                  Go to step {String(missing ?? 1)}
                </Link>{" "}
                to finish them.
              </p>
            </div>
          ) : (
            <Summary
              draft={draft}
              change={change}
              input={preview.input}
              plan={preview.plan}
              calculatedLevel={preview.calculatedLevel}
              hasExisting={hasExisting}
              building={create.isPending}
              onBuild={build}
              onBack={onBack}
            />
          )
        ) : (
          <form ref={formRef} onSubmit={onNext} noValidate>
            {step === 1 ? <PurposesStep {...stepProps} weightLabel={weightLabel} /> : null}
            {step === 2 ? <LevelStep {...stepProps} /> : null}
            {step === 3 ? <TimeStep {...stepProps} /> : null}
            {step === 4 ? <StartStep {...stepProps} /> : null}
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button type="submit">{NEXT_LABEL[step]}</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

/** T1, T2, T3, T9c: the intake stepper at /plan/new. Answers are saved in the profile as they are given. */
export function IntakePage() {
  const baseline = useBaseline();
  const profile = usePlanProfile();
  const goal = useActiveWeightGoal();
  const existing = usePlan();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const failed = baseline.isError || profile.isError || existing.isError;
  const retry = () => {
    baseline.refetch();
    void profile.refetch();
    void existing.refetch();
  };
  usePlanLoadErrorCard(failed, retry);

  if (failed) return <PlanLoadError retry={retry} />;
  if (baseline.isPending || profile.isPending || goal.isPending || existing.isPending)
    return <PlanSkeleton desktop={desktop} />;
  const ftp = baseline.baseline?.ftp?.value ?? null;
  if (ftp === null) return <BaselineNeeded />;
  return (
    <IntakeForm
      initial={draftFromProfile(profile.data, goal.data ?? null, intakeToday())}
      baseline={{
        ftp,
        lthr: baseline.baseline?.lthr?.value ?? null,
        maxHr: baseline.baseline?.maxHr?.value ?? null,
      }}
      availableDays={profile.data.availableDays}
      profileEnvironment={profile.data.ridingEnvironment}
      hasExisting={existing.data !== null}
    />
  );
}
