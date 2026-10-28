import { useId, useMemo, useState } from "react";
import { PageLoading } from "@/components/PageLoading";
import { Button } from "@/components/ui";
import {
  brusselsDate,
  rangeStart,
  summarize,
  trendForRange,
  type TrendPoint,
  type WeightRange,
} from "@/features/athlete";
import { averageChange } from "./trend";
import { formatChange, formatDay, formatKg } from "./format";
import { useWeightEntries } from "./hooks";
import { useLoadErrorCard } from "./use-weight-cards";
import { WeightChart } from "./WeightChart";

const RANGES: readonly { value: WeightRange; label: string; period: string }[] = [
  { value: "week", label: "Week", period: "this week" },
  { value: "month", label: "Month", period: "this month" },
  { value: "3months", label: "3 months", period: "in 3 months" },
  { value: "year", label: "Year", period: "this year" },
];

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[20px] font-semibold leading-7 [font-variant-numeric:tabular-nums]">
        {value}
      </dd>
      {note ? <dd className="text-[13px] text-muted">{note}</dd> : null}
    </div>
  );
}

/** The Trend tab: range switch, stat tiles, the chart and the table alternative (W2, W2d). */
export function TrendTab() {
  const query = useWeightEntries();
  useLoadErrorCard(query.isError, () => void query.refetch());
  const [range, setRange] = useState<WeightRange>("month");
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  const today = brusselsDate() ?? "";
  const entries = query.data;

  const view = useMemo(() => {
    if (!entries) return null;
    return {
      points: trendForRange(entries, range, today),
      summary: summarize(entries, range, today),
      from: rangeStart(range, today),
    };
  }, [entries, range, today]);

  const period = RANGES.find((r) => r.value === range)?.period ?? "";

  return (
    <div className="max-w-3xl">
      <div
        role="radiogroup"
        aria-label="Range"
        className="mb-5 flex h-11 gap-0.5 rounded-md bg-track p-[3px] sm:max-w-md"
      >
        {RANGES.map(({ value, label }) => (
          <label
            key={value}
            className={
              "flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-2 text-[15px] font-medium text-muted " +
              "transition-colors hover:text-text has-checked:bg-raised has-checked:font-semibold has-checked:text-text " +
              "has-checked:shadow-[inset_0_0_0_1px_var(--input-border)] " +
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            }
          >
            <input
              type="radio"
              name={`${id}-range`}
              value={value}
              checked={range === value}
              onChange={() => {
                setRange(value);
              }}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>

      {query.isPending ? <PageLoading /> : null}

      {query.isError ? (
        <div className="rounded-2xl bg-surface px-5 py-6">
          <p className="text-[15px]">Your weights could not be loaded.</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {view ? (
        <TrendBody
          view={view}
          today={today}
          period={period}
          showTable={showTable}
          onToggle={() => {
            setShowTable((v) => !v);
          }}
        />
      ) : null}
    </div>
  );
}

function TrendBody({
  view,
  today,
  period,
  showTable,
  onToggle,
}: {
  view: {
    points: TrendPoint[];
    summary: ReturnType<typeof summarize>;
    from: string | null;
  };
  today: string;
  period: string;
  showTable: boolean;
  onToggle: () => void;
}) {
  const { points, summary, from } = view;
  const last = points[points.length - 1];
  const change = averageChange(points);
  const tableId = useId();

  return (
    <>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile
          label="Latest"
          value={summary.latest ? `${formatKg(summary.latest.kg)} kg` : "—"}
          {...(summary.latest ? { note: formatDay(summary.latest.date) } : {})}
        />
        <Tile label="7-day average" value={last ? `${formatKg(last.average)} kg` : "—"} />
        <Tile
          label="Change"
          value={change === null ? "—" : `${formatChange(change)} kg`}
          {...(change === null ? {} : { note: period })}
        />
      </dl>

      {points.length < 2 || !from ? (
        <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[15px] text-muted">
          Not enough entries in this range yet.
        </p>
      ) : (
        <div className="rounded-2xl bg-surface p-4">
          <WeightChart
            points={points}
            from={from}
            to={today}
            summary={`Weight trend, ${period}: ${points.length} entries, latest 7-day average ${formatKg(last?.average ?? 0)} kg.`}
          />
          <Button
            variant="ghost"
            className="mt-2 -ml-2"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={onToggle}
          >
            {showTable ? "Hide table" : "Show as table"}
          </Button>
          {showTable ? (
            <div id={tableId} className="mt-2 overflow-x-auto">
              <table className="w-full text-[15px]">
                <caption className="sr-only">Entries in this range, newest first</caption>
                <thead className="text-left text-[13px] text-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-2 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Weight (kg)
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">
                      7-day average (kg)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((p) => (
                    <tr key={p.date} className="border-t border-border">
                      <td className="h-11 py-1 pr-2">{formatDay(p.date)}</td>
                      <td className="px-2 py-1 text-right [font-variant-numeric:tabular-nums]">
                        {formatKg(p.kg)}
                      </td>
                      <td className="py-1 pl-2 text-right [font-variant-numeric:tabular-nums]">
                        {formatKg(p.average)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
