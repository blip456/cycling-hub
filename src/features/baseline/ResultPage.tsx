import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { buttonClass } from "@/components/button-class";
import { EmptyState, FormAlert, TextField } from "@/components/ui";
import {
  baselineSchema,
  brusselsDate,
  ftpFrom20MinTest,
  ftpFromRampTest,
  isIsoDate,
  lthrSchema,
} from "@/features/athlete";
import { Checkbox } from "@/features/rides/list/controls";
import { formatDate } from "./format";
import {
  useActiveTestWeek,
  useAddBaseline,
  useBaseline,
  useSetWeekStatus,
  useUpdateSession,
} from "./hooks";
import { changeText, savedMessage, valueOf } from "./model";
import { EffectiveFrom, LoadError, Skeleton } from "./parts";
import { PROTOCOLS } from "./protocols";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX = 500;

/** Z6: the result of the test, the calculation line by line, and the confirm. Nothing is saved before it. */
export function ResultPage() {
  const { position } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const week = useActiveTestWeek();
  const { baseline } = useBaseline();
  const add = useAddBaseline();
  const updateSession = useUpdateSession();
  const setStatus = useSetWeekStatus();
  const today = brusselsDate() ?? new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [includeLthr, setIncludeLthr] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (week.isError) {
    return (
      <LoadError
        id="result-error"
        message="Couldn't load this result. Check your connection."
        onRetry={() => {
          void week.refetch();
        }}
      />
    );
  }
  if (week.isPending) return <Skeleton label="Loading the result" />;
  const session = week.data?.sessions.find((s) => String(s.position) === position);
  const average = session?.result_avg_power_w ?? null;
  if (!week.data || !session || average === null) {
    return (
      <div className="flex max-w-[640px] flex-col items-start gap-4">
        <EmptyState>
          There is no result to check yet. Enter it on the test session first.
        </EmptyState>
        <Link to="/baseline/test-week" className={buttonClass("secondary")}>
          Back to the test week
        </Link>
      </div>
    );
  }

  const protocol = week.data.protocol;
  const weekId = week.data.week.id;
  const info = PROTOCOLS[protocol];
  const isRamp = protocol === "ramp";
  const newFtp = isRamp ? ftpFromRampTest(average) : ftpFrom20MinTest(average);
  const multiplier = isRamp ? "75 %" : "95 %";
  const testDay =
    session.scheduled_on && session.scheduled_on < today ? session.scheduled_on : today;
  const effective = date ?? testDay;
  const currentFtp = baseline ? valueOf(baseline, "ftp") : null;
  const currentMaxHr = baseline ? valueOf(baseline, "maxHr") : null;
  const change = newFtp === null ? null : changeText(currentFtp, newFtp, "W");

  const hrParam = search.get("hr");
  const parsedHr = !isRamp && hrParam !== null ? lthrSchema.safeParse(Number(hrParam)) : null;
  const lthr = parsedHr?.success ? parsedHr.data : null;
  const lthrTooHigh = lthr !== null && currentMaxHr !== null && lthr > currentMaxHr;
  const rideParam = search.get("ride");
  const rideId = rideParam !== null && UUID.test(rideParam) ? rideParam : null;
  const dateError = !isIsoDate(effective)
    ? "Enter a valid date."
    : effective > today
      ? "The date cannot be in the future."
      : undefined;

  const testName = isRamp ? "Ramp test" : "20-minute test";
  const label = `${testName}, ${session.scheduled_on ? formatDate(session.scheduled_on) : "no date"}`;

  const confirm = () => {
    setError(null);
    if (newFtp === null || dateError) return;
    const saveLthr = lthr !== null && includeLthr && !lthrTooHigh ? lthr : null;
    const parsed = baselineSchema.safeParse({ ftp: newFtp, lthr: saveLthr });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "This result can't be saved.");
      return;
    }
    const trimmed = note.trim();
    if (trimmed.length > NOTE_MAX) {
      setError(`The note can be at most ${String(NOTE_MAX)} characters.`);
      return;
    }
    add.mutate(
      {
        effectiveDate: effective,
        ftp: parsed.data.ftp,
        maxHr: null,
        restingHr: null,
        lthr: parsed.data.lthr,
        source: isRamp ? "test_ramp" : "test_20min",
        sourceActivityId: rideId,
        note: trimmed === "" ? null : trimmed,
      },
      {
        onSuccess: () => {
          // The baseline row is what matters; ticking the session off is best effort.
          updateSession.mutate({
            id: session.id,
            patch: { completed_at: new Date().toISOString(), result_ftp_w: parsed.data.ftp },
          });
          setStatus.mutate({ id: weekId, status: "completed" });
          void navigate("/baseline", { state: { flash: savedMessage(parsed.data) } });
        },
        onError: () => {
          setError("Couldn't save your baseline. Nothing was changed. Try again.");
        },
      },
    );
  };

  return (
    <div className="max-w-[640px]">
      <p className="mb-4 text-[15px]">{label}. Nothing is saved until you confirm.</p>
      {newFtp === null ? (
        <FormAlert>
          This result can&apos;t be turned into an FTP. Go back to the session and check the number.
        </FormAlert>
      ) : (
        <>
          <section aria-labelledby="calc-heading" className="rounded-2xl bg-surface p-4">
            <h2 id="calc-heading" className="sr-only">
              The calculation
            </h2>
            <dl className="divide-y divide-border text-[15px]">
              <div className="flex justify-between gap-3 py-2">
                <dt>{info.resultLabel}</dt>
                <dd className="font-semibold tabular-nums">{average} W</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt>Multiplied by</dt>
                <dd className="font-semibold tabular-nums">{multiplier}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt>New FTP</dt>
                <dd className="text-xl font-semibold tabular-nums">{newFtp} W</dd>
              </div>
            </dl>
            <p className="mt-2 text-[15px]">
              {currentFtp === null
                ? "No FTP is set yet."
                : `Current FTP ${String(currentFtp)} W${change ? `. ${change}.` : "."}`}
            </p>
          </section>
          {isRamp ? (
            <p className="mt-3 text-[13px] text-muted">
              The ramp test gives no LTHR, so there is no LTHR option here.
            </p>
          ) : lthr !== null ? (
            <div className="mt-3 rounded-2xl bg-surface p-4">
              {lthrTooHigh ? (
                <p className="text-[15px]">
                  LTHR {lthr} bpm is higher than your max heart rate of {currentMaxHr} bpm, so it is
                  not saved. Check the number, or update your max heart rate first.
                </p>
              ) : (
                <>
                  <Checkbox checked={includeLthr} onChange={setIncludeLthr}>
                    Also save LTHR: {lthr} bpm
                  </Checkbox>
                  <p className="text-[13px] text-muted">
                    Average heart rate of the last 15 minutes of the test.
                    {baseline && valueOf(baseline, "lthr") === null ? " LTHR is not set yet." : ""}
                  </p>
                </>
              )}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-5">
            <EffectiveFrom
              value={effective}
              onChange={setDate}
              max={today}
              helper="Defaults to the test date."
              error={dateError}
            />
            <TextField
              label="Note (optional)"
              autoComplete="off"
              value={note}
              helper="Stored with this baseline in the history."
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
          </div>
          {error ? (
            <div className="mt-4">
              <FormAlert>{error}</FormAlert>
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 lg:flex-row">
            <button
              type="button"
              disabled={add.isPending}
              onClick={confirm}
              className={buttonClass("primary")}
            >
              Confirm FTP {newFtp} W
            </button>
            <Link
              to="/baseline/values"
              state={{
                note: `${testName}: ${info.resultLabel.toLowerCase()} ${String(average)} W`,
              }}
              className={buttonClass("secondary")}
            >
              Enter a different value
            </Link>
            <Link to="/baseline/test-week" className={buttonClass("ghost")}>
              Discard result
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
