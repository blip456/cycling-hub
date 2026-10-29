import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { buttonClass } from "@/components/button-class";
import { PageLoading } from "@/components/PageLoading";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { Button, EmptyState } from "@/components/ui";
import { brusselsDate } from "@/features/athlete";
import { TextAreaField } from "@/features/profile/TextAreaField";
import { DEFAULT_PROMPT_LINES } from "../export";
import { dayLabel, monthLabel } from "../export/format";
import { mondayOf, sessionFromRow } from "./adapt";
import { buildSummary, findSession, ridesNeeded, type SummarySource } from "./build";
import { copyText } from "./copy";
import { useRideMetrics, useSummarySource } from "./hooks";
import { loadSummaryOptions, saveSummaryOptions, type StoredSummaryOptions } from "./storage";
import { paramsFor, stepSubject, subjectFromParams, switchKind, type Subject } from "./subject";
import { Switch } from "./Switch";
import type { RideMetrics } from "./types";

const KINDS: readonly { value: Subject["kind"]; label: string }[] = [
  { value: "session", label: "Session" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const KIND_TITLE: Record<Subject["kind"], string> = {
  session: "Session summary",
  week: "Week summary",
  month: "Month summary",
};

/** How long the Copy button says Copied, and the card stays. */
const COPIED_BUTTON_MS = 3000;
const COPIED_CARD_MS = 8000;

/**
 * R11: a summary of a session, a week or a month to copy into an AI chat. The address says what it is
 * about (`?type=session&id=`, `?type=week&date=`, `?type=month&date=`); without one it is this week. No AI
 * service is called: the text is made here from the plan, the rides, the baseline, the weight log and the
 * profile, and Copy puts it on the clipboard.
 */
export function SummaryScreen() {
  const state = useSummarySource();
  if (state.status === "pending") return <PageLoading />;
  if (state.status === "error") {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>The summary could not be prepared.</EmptyState>
        <Button variant="secondary" onClick={state.retry}>
          Try again
        </Button>
      </div>
    );
  }
  return <SummaryBody source={state.source} />;
}

function SummaryBody({ source }: { source: SummarySource }) {
  const [params, setParams] = useSearchParams();
  const today = brusselsDate() ?? "";
  const subject = useMemo(() => subjectFromParams(params, today), [params, today]);
  const sessions = useMemo(
    () => source.plan.sessions.filter((s) => s.status !== "dropped"),
    [source.plan.sessions],
  );

  const go = (next: Subject | null) => {
    if (next) setParams(paramsFor(next), { replace: true });
  };

  const needed = useMemo(() => ridesNeeded(source, subject), [source, subject]);
  const { metrics, pending } = useRideMetrics(needed, source.baseline);

  const headingId = useId();
  const row = subject.kind === "session" ? findSession(source, subject.id) : null;
  const session = row === null ? null : sessionFromRow(row, source.baseline.ftp);
  const missing = subject.kind === "session" && session === null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-[560px] flex-col gap-4 lg:max-w-[1000px]"
    >
      <KindSwitch
        value={subject.kind}
        onChange={(kind) => {
          go(switchKind(subject, kind, today, sessions));
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[17px] font-semibold">
            {KIND_TITLE[subject.kind]}
          </h2>
          <p className="text-[15px] text-muted">
            {subjectLabel(
              subject,
              source,
              session === null ? null : { title: session.title, date: session.date },
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            aria-label={`Previous ${subject.kind}`}
            disabled={stepSubject(subject, -1, sessions) === null}
            onClick={() => {
              go(stepSubject(subject, -1, sessions));
            }}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <Button
            variant="secondary"
            aria-label={`Next ${subject.kind}`}
            disabled={stepSubject(subject, 1, sessions) === null}
            onClick={() => {
              go(stepSubject(subject, 1, sessions));
            }}
          >
            <span aria-hidden="true">→</span>
          </Button>
        </div>
      </div>

      {subject.kind === "session" && sessions.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyState>There are no planned sessions to summarise yet.</EmptyState>
          <Link to="/plan/new" className={buttonClass("secondary")}>
            Make a plan
          </Link>
        </div>
      ) : missing ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyState>That session is not in your plan any more.</EmptyState>
          <Button
            variant="secondary"
            onClick={() => {
              go(switchKind(subject, "week", today, sessions));
            }}
          >
            Summarise a week instead
          </Button>
        </div>
      ) : (
        <SummaryPanel
          key={JSON.stringify(subject)}
          subject={subject}
          source={source}
          metrics={metrics}
          loadingRides={pending}
        />
      )}
    </section>
  );
}

function subjectLabel(
  subject: Subject,
  source: SummarySource,
  session: { title: string; date: string } | null,
): string {
  if (subject.kind === "session") {
    return session === null ? "" : `${session.title}, ${dayLabel(session.date)}`;
  }
  if (subject.kind === "month") return monthLabel(subject.year, subject.month);
  const monday = mondayOf(subject.date);
  const planned = source.plan.sessions.find((s) => mondayOf(s.session_date) === monday);
  if (planned) return `Training week ${planned.week_number} of ${source.plan.plan?.weeks ?? 12}`;
  return `Week of ${dayLabel(monday)}`;
}

function KindSwitch({
  value,
  onChange,
}: {
  value: Subject["kind"];
  onChange: (kind: Subject["kind"]) => void;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label="Summary of"
      className="flex h-11 gap-0.5 rounded-md bg-track p-[3px] sm:max-w-md"
    >
      {KINDS.map(({ value: kind, label }) => (
        <label
          key={kind}
          className={
            "flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-2 text-[15px] font-medium text-muted " +
            "transition-colors hover:text-text has-checked:bg-raised has-checked:font-semibold has-checked:text-text " +
            "has-checked:shadow-[inset_0_0_0_1px_var(--input-border)] " +
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          }
        >
          <input
            type="radio"
            name={name}
            value={kind}
            checked={value === kind}
            onChange={() => {
              onChange(kind);
            }}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function SummaryPanel({
  subject,
  source,
  metrics,
  loadingRides,
}: {
  subject: Subject;
  source: SummarySource;
  metrics: Readonly<Record<string, RideMetrics | null>>;
  loadingRides: boolean;
}) {
  const kind = subject.kind;
  const [options, setOptions] = useState<StoredSummaryOptions>(() => loadSummaryOptions(kind));
  const defaultPrompt = DEFAULT_PROMPT_LINES[kind];
  const promptValue = options.prompt ?? defaultPrompt;
  // The panel is remounted for every subject (see `key`), so this is the moment the summary was made.
  const [madeAt] = useState(() => new Date());

  const update = (next: StoredSummaryOptions) => {
    setOptions(next);
    saveSummaryOptions(kind, next);
  };

  const text = useMemo(
    () =>
      buildSummary(subject, source, new Map(Object.entries(metrics)), madeAt, {
        includeWeight: options.includeWeight,
        includeGoals: options.includeGoals,
        promptLine: options.includePrompt ? promptValue : null,
      }),
    [
      subject,
      source,
      metrics,
      madeAt,
      options.includeWeight,
      options.includeGoals,
      options.includePrompt,
      promptValue,
    ],
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const buttonTimer = useRef<number | undefined>(undefined);
  const cardTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(buttonTimer.current);
      window.clearTimeout(cardTimer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(text);
    window.clearTimeout(buttonTimer.current);
    window.clearTimeout(cardTimer.current);
    if (ok) {
      setCopyFailed(false);
      setCopied(true);
      setCardOpen(true);
      buttonTimer.current = window.setTimeout(() => {
        setCopied(false);
      }, COPIED_BUTTON_MS);
      cardTimer.current = window.setTimeout(() => {
        setCardOpen(false);
      }, COPIED_CARD_MS);
      return;
    }
    setCopied(false);
    setCopyFailed(true);
    const preview = previewRef.current;
    if (preview) {
      preview.focus();
      const range = document.createRange();
      range.selectNodeContents(preview);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  useStatusCard(
    "plan-summary-copied",
    STATUS_PRIORITY.flash,
    cardOpen
      ? {
          tone: "success",
          message: (
            <>
              <span className="block font-semibold">Summary copied</span>
              <span className="block">Paste it into your AI chat. Nothing was sent anywhere.</span>
            </>
          ),
          onDismiss: () => {
            setCardOpen(false);
          },
        }
      : null,
  );
  useStatusCard(
    "plan-summary-copy-failed",
    STATUS_PRIORITY.error,
    copyFailed
      ? {
          tone: "error",
          message: (
            <>
              <span className="block font-semibold">Could not copy</span>
              <span className="block">Select the preview text and copy it by hand.</span>
            </>
          ),
          onDismiss: () => {
            setCopyFailed(false);
          },
        }
      : null,
  );

  const previewId = useId();

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[420px_1fr] lg:items-start">
      <div className="flex flex-col gap-4">
        <fieldset className="rounded-2xl bg-surface p-4">
          <legend className="mb-1 text-[13px] font-semibold">Include</legend>
          <Switch
            label="Weight trend"
            checked={options.includeWeight}
            onChange={(checked) => {
              update({ ...options, includeWeight: checked });
            }}
          />
          <Switch
            label="Goals"
            checked={options.includeGoals}
            onChange={(checked) => {
              update({ ...options, includeGoals: checked });
            }}
          />
          <Switch
            label="Prompt line at the top"
            checked={options.includePrompt}
            onChange={(checked) => {
              update({ ...options, includePrompt: checked });
            }}
          />
        </fieldset>
        {options.includePrompt ? (
          <div className="rounded-2xl bg-surface p-4">
            <TextAreaField
              label="Prompt line"
              helper="Edit it to say what you want from the AI chat. Your words are kept for next time."
              value={promptValue}
              onChange={(event) => {
                const value = event.target.value;
                update({ ...options, prompt: value === defaultPrompt ? null : value });
              }}
            />
            {options.prompt !== null ? (
              <Button
                variant="ghost"
                className="mt-1 -ml-2"
                onClick={() => {
                  update({ ...options, prompt: null });
                }}
              >
                Use the standard line
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button
          className="min-h-14 w-full text-[17px]"
          disabled={loadingRides}
          onClick={() => {
            void copy();
          }}
        >
          {copied ? (
            <>
              <span aria-hidden="true">✓</span> Copied
            </>
          ) : (
            "Copy summary"
          )}
        </Button>
        <p aria-live="polite" className="sr-only">
          {copied ? "Summary copied" : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        <h3 id={previewId} className="mb-2 text-[13px] font-semibold">
          Preview
        </h3>
        {loadingRides ? (
          <div role="status" className="text-[15px] text-muted">
            Reading the ride data…
          </div>
        ) : (
          <div
            ref={previewRef}
            role="region"
            aria-labelledby={previewId}
            // A scrollable region must be reachable by keyboard (WCAG 2.1.1).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className="max-h-[60vh] overflow-auto rounded-md bg-subtle p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <pre className="font-mono text-[13px] leading-5 break-words whitespace-pre-wrap">
              {text}
            </pre>
          </div>
        )}
        <p className="mt-2 text-[13px] text-muted">
          {text.length.toLocaleString("en-US")} characters. Plain text with simple markdown
          headings, readable as it is.
        </p>
      </div>
    </div>
  );
}
