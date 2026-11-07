import type { BaselineValues, IsoDate, Zone } from "@/features/athlete";
import type { Database } from "@/lib/supabase/database.types";

type EntryRow = Database["public"]["Tables"]["baseline_entries"]["Row"];
type CurrentRow = Database["public"]["Views"]["current_baseline"]["Row"];

/** Where a baseline value came from (`baseline_entries.source`). */
export type BaselineSource = "manual" | "test_20min" | "test_ramp" | "stream_estimate" | "hr_data";

const SOURCE_LABELS: Record<BaselineSource, string> = {
  manual: "Typed by hand",
  test_20min: "Test, 20-minute",
  test_ramp: "Test, ramp",
  stream_estimate: "Ride estimate",
  hr_data: "Highest in your data",
};

function isBaselineSource(value: string): value is BaselineSource {
  return Object.hasOwn(SOURCE_LABELS, value);
}

/** Plain-English source, or the stored text when it is not one we know. */
export function sourceLabel(source: string): string {
  return isBaselineSource(source) ? SOURCE_LABELS[source] : source;
}

/** One saved baseline row, with the columns the screens use. */
export type BaselineEntry = Pick<
  EntryRow,
  | "id"
  | "effective_date"
  | "ftp_w"
  | "max_hr"
  | "resting_hr"
  | "lthr"
  | "source"
  | "source_activity_id"
  | "note"
  | "created_at"
>;

export const ENTRY_COLUMNS =
  "id, effective_date, ftp_w, max_hr, resting_hr, lthr, source, source_activity_id, note, created_at";

/** The four metrics of a baseline. */
export type Metric = "ftp" | "maxHr" | "lthr" | "restingHr";

const COLUMN = {
  ftp: "ftp_w",
  maxHr: "max_hr",
  lthr: "lthr",
  restingHr: "resting_hr",
} as const satisfies Record<Metric, keyof BaselineEntry>;

/** A current value with its effective date and where it came from. */
export type CurrentValue = {
  value: number;
  effectiveDate: IsoDate;
  /** Null when the history row it came from cannot be found. */
  source: string | null;
  sourceActivityId: string | null;
};

export type CurrentBaseline = Record<Metric, CurrentValue | null>;

export const EMPTY_BASELINE: CurrentBaseline = {
  ftp: null,
  maxHr: null,
  lthr: null,
  restingHr: null,
};

/** Newest first: effective date, then when it was saved (the same order as the `current_baseline` view). */
export function sortEntries<T extends Pick<BaselineEntry, "effective_date" | "created_at">>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      b.effective_date.localeCompare(a.effective_date) || b.created_at.localeCompare(a.created_at),
  );
}

/**
 * The current baseline: values and dates from the `current_baseline` view, with the source taken from the
 * history row that holds that value on that date (the view does not carry the source).
 */
export function currentBaseline(
  view: CurrentRow | null,
  entries: readonly BaselineEntry[],
): CurrentBaseline {
  if (!view) return EMPTY_BASELINE;
  const sorted = sortEntries(entries);
  const pairs: Record<Metric, [number | null, string | null]> = {
    ftp: [view.ftp_w, view.ftp_effective_date],
    maxHr: [view.max_hr, view.max_hr_effective_date],
    lthr: [view.lthr, view.lthr_effective_date],
    restingHr: [view.resting_hr, view.resting_hr_effective_date],
  };
  const result: CurrentBaseline = { ...EMPTY_BASELINE };
  for (const metric of Object.keys(pairs) as Metric[]) {
    const [value, effectiveDate] = pairs[metric];
    if (value === null || effectiveDate === null) continue;
    const entry = sorted.find(
      (e) => e[COLUMN[metric]] === value && e.effective_date === effectiveDate,
    );
    result[metric] = {
      value,
      effectiveDate,
      source: entry?.source ?? null,
      sourceActivityId: entry?.source_activity_id ?? null,
    };
  }
  return result;
}

/** True when nothing is set. */
export function isEmptyBaseline(baseline: CurrentBaseline): boolean {
  return Object.values(baseline).every((v) => v === null);
}

/** The value of a metric, or null when it is not set. */
export function valueOf(baseline: CurrentBaseline, metric: Metric): number | null {
  return baseline[metric]?.value ?? null;
}

/** A history row with the values in force on it (a value a row did not set carries over from older rows). */
export type HistoryRow = BaselineEntry & {
  ftpInForce: number | null;
  maxHrInForce: number | null;
  lthrInForce: number | null;
  /** True for the newest row: the one in force now. */
  current: boolean;
};

/** History, newest first. Append-only: rows are never changed, a correction is a new row. */
export function historyRows(entries: readonly BaselineEntry[]): HistoryRow[] {
  let ftp: number | null = null;
  let maxHr: number | null = null;
  let lthr: number | null = null;
  const rows = sortEntries(entries)
    .reverse()
    .map((entry) => {
      ftp = entry.ftp_w ?? ftp;
      maxHr = entry.max_hr ?? maxHr;
      lthr = entry.lthr ?? lthr;
      return { ...entry, ftpInForce: ftp, maxHrInForce: maxHr, lthrInForce: lthr, current: false };
    })
    .reverse();
  const newest = rows[0];
  if (newest) newest.current = true;
  return rows;
}

/** The text of the status card after a save. */
export function savedMessage(values: BaselineValues): string {
  const parts: string[] = [];
  if (values.ftp !== null) parts.push(`FTP ${String(values.ftp)} W`);
  if (values.maxHr !== null) parts.push(`max heart rate ${String(values.maxHr)} bpm`);
  if (values.lthr !== null) parts.push(`LTHR ${String(values.lthr)} bpm`);
  if (values.restingHr !== null) parts.push(`resting heart rate ${String(values.restingHr)} bpm`);
  return `Baseline updated: ${parts.join(", ")}. Zones are recalculated.`;
}

/** "Up 11 W", "Down 5 W" or "Same", in words so colour is never the only signal; null without a current value. */
export function changeText(current: number | null, next: number, unit: string): string | null {
  if (current === null) return null;
  const diff = next - current;
  if (diff === 0) return "Same";
  return `${diff > 0 ? "Up" : "Down"} ${String(Math.abs(diff))} ${unit}`;
}

// ---- zone display -------------------------------------------------------------------------------

/** Upper limits in percent of the reference, as in `zones.ts` (the last zone has none). */
const UPPER = {
  power: [55, 75, 90, 105, 120, 150, null],
  lthr: [68, 83, 94, 105, null],
  "max-hr": [60, 70, 80, 90, null],
} as const;

export type ZoneModel = keyof typeof UPPER;

/** "Under 55 %", "56 to 75 %", "Over 150 %" for a zone of the given model. */
export function zonePercentText(model: ZoneModel, index: number): string {
  const uppers: readonly (number | null)[] = UPPER[model];
  const upper = uppers[index - 1] ?? null;
  const previous = index > 1 ? (uppers[index - 2] ?? null) : null;
  if (previous === null) return upper === null ? "All values" : `Under ${String(upper)} %`;
  if (upper === null) return `Over ${String(previous)} %`;
  return `${String(previous + 1)} to ${String(upper)} %`;
}

/** "Up to 137 W", "138 to 187 W", "376 W and above". */
export function zoneRangeText(zone: Zone, unit: "W" | "bpm"): string {
  if (zone.max === null) return `${String(zone.min)} ${unit} and above`;
  if (zone.index === 1) return `Up to ${String(zone.max)} ${unit}`;
  return `${String(zone.min)} to ${String(zone.max)} ${unit}`;
}

/** Widths for a zone bar: the size of each range, and the top zone as wide as the one below it. */
export function zoneBarWeights(zones: readonly Zone[]): number[] {
  const weights: number[] = [];
  for (const zone of zones) {
    if (zone.max === null) weights.push(weights.at(-1) ?? 1);
    else weights.push(Math.max(1, zone.max - zone.min + 1));
  }
  return weights;
}

/** A line of all ranges for the history: "1: up to 132 · 2: 133 to 180 · 7: 361 and above". */
export function zoneSummary(zones: readonly Zone[]): string {
  return zones
    .map((z) => {
      if (z.max === null) return `${String(z.index)}: ${String(z.min)} and above`;
      if (z.index === 1) return `${String(z.index)}: up to ${String(z.max)}`;
      return `${String(z.index)}: ${String(z.min)} to ${String(z.max)}`;
    })
    .join(" · ");
}
