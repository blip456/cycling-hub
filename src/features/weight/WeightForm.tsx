import { useRef, useState, type SubmitEvent } from "react";
import { Button, FormAlert, TextField } from "@/components/ui";
import {
  brusselsDate,
  isIsoDate,
  LIMITS,
  weightEntrySchema,
  type WeightEntry,
} from "@/features/athlete";
import { formatDay, parseKg } from "./format";
import { useSaveWeight } from "./hooks";
import { useWeightCards } from "./use-weight-cards";

interface Errors {
  date?: string;
  kg?: string;
  note?: string;
}

/**
 * The log form (W1a, W1b, W5): date, weight in kg and an optional note. One entry per day: saving a day
 * that has one replaces it (P45), and says so before saving. With `editing` it changes that entry
 * (title "Edit entry", with Cancel). Mount it with a `key` per entry so the fields start from the entry.
 */
export function WeightForm({
  entries,
  editing,
  onDone,
}: {
  entries: readonly WeightEntry[] | undefined;
  editing: WeightEntry | null;
  onDone: () => void;
}) {
  const today = brusselsDate() ?? "";
  const [date, setDate] = useState(editing?.date ?? today);
  const [kgText, setKgText] = useState(editing ? String(editing.kg) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const kgRef = useRef<HTMLInputElement>(null);
  const save = useSaveWeight();
  const cards = useWeightCards();

  const replaces = entries?.some((e) => e.date === date) && editing?.date !== date;

  function submit() {
    cards.hide();
    const next: Errors = {};
    if (!isIsoDate(date)) next.date = "Choose a date.";
    else if (today !== "" && date > today) next.date = "Choose a date that is not in the future.";
    const parsed = weightEntrySchema.safeParse({ kg: parseKg(kgText), note });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "note" ? "note" : "kg";
        next[field] ??= issue.message;
      }
    }
    setErrors(next);
    if (!parsed.success || next.date) return;
    const entry: WeightEntry = { date, kg: parsed.data.kg, note: parsed.data.note };
    save.mutate(
      { entry, replaces: editing?.date },
      {
        onSuccess: () => {
          if (editing) {
            onDone();
            return;
          }
          setKgText("");
          setNote("");
          setDate(today);
          kgRef.current?.focus();
        },
        onError: () => {
          cards.showSaveFailed(submit);
        },
      },
    );
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    submit();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">
        {editing ? "Edit entry" : "Log weight"}
      </h2>
      <TextField
        label="Date"
        type="date"
        value={date}
        max={today}
        required
        error={errors.date}
        helper="One entry per day. Saving a day that already has an entry replaces it."
        onChange={(e) => {
          setDate(e.target.value);
        }}
      />
      <TextField
        ref={kgRef}
        label="Weight"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={kgText}
        required
        error={errors.kg}
        helper="Metric units. One decimal at most."
        trailing={
          <span aria-hidden="true" className="pr-3.5 text-[15px] text-muted">
            kg
          </span>
        }
        onChange={(e) => {
          setKgText(e.target.value);
        }}
      />
      <TextField
        label="Note"
        type="text"
        maxLength={LIMITS.weightNoteMax}
        autoComplete="off"
        value={note}
        error={errors.note}
        helper={`Optional. ${LIMITS.weightNoteMax} characters at most.`}
        onChange={(e) => {
          setNote(e.target.value);
        }}
      />
      {replaces ? (
        <FormAlert tone="info">
          There is already an entry for {formatDay(date)}. Saving replaces it.
        </FormAlert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          {editing ? "Save changes" : "Save weight"}
        </Button>
        {editing ? (
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
