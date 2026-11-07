import { Link } from "react-router";
import { AlertIcon, BaselineIcon, ChevronRightIcon, PlanIcon } from "@/components/icons";
import { useBaseline } from "@/features/baseline/hooks";
import { formatShortDate, useCurrentWeight, usePlanProfile } from "../data";
import { GRID_QUERY, usePlanLoadErrorCard, useToday } from "./page-hooks";
import { CheckIcon } from "./icons";
import { EmptyTile, LinkButton, PlanLoadError, PlanSkeleton } from "./parts";
import { useMediaQuery } from "@/lib/use-media-query";

const ROUTES = [
  {
    to: "/baseline/suggestion",
    title: "Estimate it from my rides",
    text: "Uses your rides with power data. Quickest if you rode with a power meter in the last months.",
  },
  {
    to: "/baseline/values",
    title: "Enter it myself",
    text: "You know your FTP from a test or another app.",
  },
  {
    to: "/baseline/test-week",
    title: "Do the guided test week",
    text: "Two or three sessions on days you choose, then the app sets your FTP.",
  },
] as const;

/** T3: the plan needs an FTP first. Three equal routes, each a whole-row link. */
export function BaselineNeeded({ reasons = [] }: { reasons?: readonly string[] }) {
  return (
    <section aria-labelledby="plan-needs-ftp" className="max-w-[640px]">
      <EmptyTile>
        <BaselineIcon className="size-6" />
      </EmptyTile>
      <h2 id="plan-needs-ftp" className="text-heading">
        Your plan needs an FTP first
      </h2>
      <p className="mt-2 text-body text-muted">
        Zones, watts and heart rates in every session come from your FTP. You do not have one yet.
      </p>
      {reasons.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-body text-muted">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      <h3 className="mt-6 mb-2 text-body font-semibold">Three ways to get an FTP</h3>
      <ul className="flex flex-col gap-2">
        {ROUTES.map((route) => (
          <li key={route.to}>
            <Link
              to={route.to}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 hover:bg-surface-hover"
            >
              <span className="min-w-0">
                <span className="block text-body font-semibold">{route.title}</span>
                <span className="block text-caption text-muted">{route.text}</span>
              </span>
              <ChevronRightIcon className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-body text-muted">
        When you have an FTP you come back here and the questions start. Nothing you did is lost.
      </p>
    </section>
  );
}

/** One line of "What the plan will use": text with a check mark, or a link to the page that fixes it. */
function UseLine({
  ok,
  children,
  fix,
}: {
  ok: boolean;
  children: string;
  fix?: { to: string; label: string };
}) {
  return (
    <li className="flex min-h-9 items-center gap-2 text-body">
      {ok ? <CheckIcon className="size-5 shrink-0" /> : <AlertIcon className="size-5 shrink-0" />}
      {ok || !fix ? (
        <span>{children}</span>
      ) : (
        <span>
          {children}{" "}
          <Link to={fix.to} className="font-semibold text-accent">
            {fix.label}
          </Link>
        </span>
      )}
    </li>
  );
}

/** T1.0: no plan yet, with what the plan will use. Without an FTP it is T3 instead. */
export function NoPlanState() {
  const baseline = useBaseline();
  const profile = usePlanProfile();
  const today = useToday();
  const weight = useCurrentWeight(today);
  const desktop = useMediaQuery(GRID_QUERY);
  usePlanLoadErrorCard(baseline.isError, baseline.refetch);

  if (baseline.isPending || profile.isPending || weight.isPending)
    return <PlanSkeleton desktop={desktop} />;
  if (baseline.isError) return <PlanLoadError retry={baseline.refetch} />;
  const ftp = baseline.baseline?.ftp ?? null;
  if (ftp === null) return <BaselineNeeded />;
  const days = profile.data?.availableDays.length ?? 0;
  const kg = weight.weight?.kg ?? null;

  return (
    <section aria-labelledby="plan-none" className="max-w-[560px]">
      <EmptyTile>
        <PlanIcon className="size-6" />
      </EmptyTile>
      <h2 id="plan-none" className="text-heading">
        No training plan yet
      </h2>
      <p className="mt-2 mb-4 text-body text-muted">
        Answer a few questions and the app builds a 12-week plan in watts and heart rate from your
        FTP, your zones and your week. It takes about three minutes.
      </p>
      <LinkButton to="/plan/new">Create my plan</LinkButton>
      <h3 className="mt-6 mb-2 text-body font-semibold">What the plan will use</h3>
      <ul className="rounded-lg bg-surface px-4 py-2">
        <UseLine
          ok
        >{`FTP ${String(ftp.value)} W (baseline of ${formatShortDate(ftp.effectiveDate)})`}</UseLine>
        <UseLine ok={days >= 2} fix={{ to: "/profile", label: "Add days in your profile" }}>
          {days >= 2 ? "Training days from your profile" : "At least 2 training days are needed."}
        </UseLine>
        <UseLine ok={kg !== null} fix={{ to: "/weight", label: "Log your weight" }}>
          {kg !== null
            ? `Latest weight ${kg.toFixed(1)} kg`
            : "No weight logged yet (only needed for weight loss)."}
        </UseLine>
      </ul>
    </section>
  );
}
