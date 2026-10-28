import { useState, type SyntheticEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { buttonClass } from "@/components/button-class";
import { FormAlert, TextField } from "@/components/ui";
import {
  baselineSchema,
  brusselsDate,
  isIsoDate,
  LIMITS,
  type BaselineValues,
} from "@/features/athlete";
import { formatDate } from "./format";
import { useAddBaseline, useBaseline, useHeartRateScan } from "./hooks";
import { savedMessage, valueOf } from "./model";
import type { NewBaselineEntry } from "./api";

const NOTE_MAX = 500;

/** What other screens pass along when they open "Enter values" (the value is filled in, never saved). */
export type ValuesLocationState = {
  maxHr?: number;
  /** The ride the max HR suggestion came from. */
  rideId?: string;
  note?: string;
};

type Fields = "ftp" | "maxHr" | "lthr" | "restingHr";

type Errors = Partial<Record<Fields | "date" | "note" | "form", string>>;

/** Empty is "not set" (null); anything else becomes a number, which may be NaN (then the schema says so). */
function toNumber(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function unit(label: string) {
  return (
    <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
      {label}
    </span>
  );
}

function readState(state: unknown): ValuesLocationState {
  if (typeof state !== "object" || state === null) return {};
  const s = state as Record<string, unknown>;
  return {
    ...(typeof s["maxHr"] === "number" ? { maxHr: s["maxHr"] } : {}),
    ...(typeof s["rideId"] === "string" ? { rideId: s["rideId"] } : {}),
    ...(typeof s["note"] === "string" ? { note: s["note"] } : {}),
  };
}

/** Z3: type FTP, max heart rate, LTHR or resting heart rate. Empty fields are left alone. */
export function ValuesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = readState(location.state);
  const { baseline } = useBaseline();
  const add = useAddBaseline();
  const hrScan = useHeartRateScan(true);
  const today = brusselsDate() ?? new Date().toISOString().slice(0, 10);

  const [ftp, setFtp] = useState("");
  const [maxHr, setMaxHr] = useState(incoming.maxHr === undefined ? "" : String(incoming.maxHr));
  const [lthr, setLthr] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState(incoming.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  // The suggestion was pressed (or arrived from the empty state); it counts as the source only while the
  // field still holds that value.
  const [suggestionUsed, setSuggestionUsed] = useState<{
    bpm: number;
    rideId: string | null;
  } | null>(
    incoming.maxHr === undefined ? null : { bpm: incoming.maxHr, rideId: incoming.rideId ?? null },
  );

  const found = hrScan.data?.suggestion ?? null;
  const currentFtp = baseline ? valueOf(baseline, "ftp") : null;
  const currentMaxHr = baseline ? valueOf(baseline, "maxHr") : null;

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const next: Errors = {};
    const parsed = baselineSchema.safeParse({
      ftp: toNumber(ftp),
      maxHr: toNumber(maxHr),
      lthr: toNumber(lthr),
      restingHr: toNumber(restingHr),
    });
    let values: BaselineValues | null = null;
    if (parsed.success) {
      values = parsed.data;
      if (
        values.ftp === null &&
        values.maxHr === null &&
        values.lthr === null &&
        values.restingHr === null
      ) {
        next.form = "Enter at least one value to save.";
      }
      if (
        values.lthr !== null &&
        values.maxHr === null &&
        currentMaxHr !== null &&
        values.lthr > currentMaxHr
      ) {
        next.lthr = `LTHR cannot be higher than your max heart rate of ${String(currentMaxHr)} bpm.`;
      }
    } else {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "ftp" || key === "maxHr" || key === "lthr" || key === "restingHr") {
          next[key] ??= issue.message;
        }
      }
    }
    const effectiveDate = date === "" ? today : date;
    if (!isIsoDate(effectiveDate)) next.date = "Enter a valid date.";
    else if (effectiveDate > today) next.date = "The date cannot be in the future.";
    const trimmedNote = note.trim();
    if (trimmedNote.length > NOTE_MAX) {
      next.note = `The note can be at most ${String(NOTE_MAX)} characters.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !values) return;

    const fromData =
      suggestionUsed !== null && values.maxHr === suggestionUsed.bpm ? suggestionUsed : null;
    const rows: NewBaselineEntry[] = [];
    if (fromData) {
      rows.push({
        effectiveDate,
        ftp: null,
        maxHr: values.maxHr,
        restingHr: null,
        lthr: null,
        source: "hr_data",
        sourceActivityId: fromData.rideId,
        note: trimmedNote === "" ? null : trimmedNote,
      });
    }
    const rest = {
      ftp: values.ftp,
      maxHr: fromData ? null : values.maxHr,
      restingHr: values.restingHr,
      lthr: values.lthr,
    };
    if (Object.values(rest).some((v) => v !== null)) {
      rows.push({
        effectiveDate,
        ...rest,
        source: "manual",
        note: trimmedNote === "" || fromData ? null : trimmedNote,
      });
    }
    void (async () => {
      try {
        for (const row of rows) await add.mutateAsync(row);
        void navigate("/baseline", { state: { flash: savedMessage(values) } });
      } catch {
        setErrors({ form: "Couldn't save your baseline. Nothing was changed. Try again." });
      }
    })();
  };

  const fieldErrors = (Object.entries(errors) as [keyof Errors, string][]).filter(
    ([, message]) => message !== "",
  );

  return (
    <form onSubmit={submit} noValidate className="max-w-[640px] lg:max-w-none">
      <p className="mb-5 text-[15px]">
        Fill in only what you want to change. Empty fields keep their current value.
      </p>
      {fieldErrors.length > 0 ? (
        <FormAlert>
          <p className="font-semibold">Error: this baseline was not saved.</p>
          <ul className="mt-1 list-inside list-disc">
            {fieldErrors.map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </FormAlert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-3 lg:gap-8">
        <div className="flex flex-col gap-5">
          <TextField
            label="FTP"
            inputMode="numeric"
            autoComplete="off"
            value={ftp}
            error={errors.ftp}
            helper={`Whole watts, ${String(LIMITS.ftp.min)} to ${String(LIMITS.ftp.max)}.${currentFtp === null ? "" : ` Current value is ${String(currentFtp)} W.`}`}
            trailing={unit("W")}
            onChange={(e) => {
              setFtp(e.target.value);
            }}
          />
          <TextField
            label="Max heart rate"
            inputMode="numeric"
            autoComplete="off"
            value={maxHr}
            error={errors.maxHr}
            helper={`Whole beats per minute, ${String(LIMITS.maxHr.min)} to ${String(LIMITS.maxHr.max)}.${currentMaxHr === null ? "" : ` Current value is ${String(currentMaxHr)} bpm.`}`}
            trailing={unit("bpm")}
            onChange={(e) => {
              setMaxHr(e.target.value);
            }}
          />
          <section aria-labelledby="highest-heading" className="rounded-2xl bg-surface p-4">
            <h2 id="highest-heading" className="text-[15px] font-semibold">
              Highest heart rate in your rides
            </h2>
            {hrScan.isPending ? (
              <p role="status" className="mt-1 text-[13px] text-muted">
                Looking in your rides. This can take a moment.
              </p>
            ) : found ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {found.bpm}
                  <span className="ml-1 text-[15px] font-medium text-muted">bpm</span>
                </p>
                <p className="text-[13px] text-muted">
                  {hrScan.data?.ride
                    ? `${formatDate(hrScan.data.ride.start_local.slice(0, 10))} · ${hrScan.data.ride.name}. `
                    : ""}
                  A loose strap can cause a spike, so check that it looks right.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMaxHr(String(found.bpm));
                    setSuggestionUsed({ bpm: found.bpm, rideId: found.rideId });
                  }}
                  className={buttonClass("secondary", "mt-3")}
                >
                  Use this value
                </button>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-muted">
                {hrScan.isError
                  ? "The ride files could not be read, so there is no suggestion. You can type a value."
                  : "No heart rate data was found in your rides."}
              </p>
            )}
          </section>
        </div>
        <div className="flex flex-col gap-5">
          <TextField
            label="Lactate threshold heart rate (LTHR) (optional)"
            inputMode="numeric"
            autoComplete="off"
            value={lthr}
            error={errors.lthr}
            helper="The average heart rate of the last 15 minutes of an all-out 20-minute effort."
            trailing={unit("bpm")}
            onChange={(e) => {
              setLthr(e.target.value);
            }}
          />
          <TextField
            label="Resting heart rate (optional)"
            inputMode="numeric"
            autoComplete="off"
            value={restingHr}
            error={errors.restingHr}
            helper="Measured after waking up, before you get out of bed."
            trailing={unit("bpm")}
            onChange={(e) => {
              setRestingHr(e.target.value);
            }}
          />
          <TextField
            label="Effective from (optional)"
            type="date"
            value={date}
            max={today}
            error={errors.date}
            helper="Leave empty to use today."
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-5">
          <TextField
            label="Note (optional)"
            autoComplete="off"
            value={note}
            error={errors.note}
            helper="Stored with this baseline in the history."
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <div className="flex flex-col gap-2 lg:flex-row">
            <button type="submit" disabled={add.isPending} className={buttonClass("primary")}>
              Save baseline
            </button>
            <Link to="/baseline" className={buttonClass("secondary")}>
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
