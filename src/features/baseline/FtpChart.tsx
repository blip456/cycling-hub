import { addMonths, diffDays, type IsoDate } from "@/features/athlete";
import { MONTHS } from "./format";

/** A baseline row that sets FTP: the chart draws these. */
export type FtpPoint = { date: IsoDate; ftp: number };

const W = 600;
const H = 220;
const PAD = { left: 44, right: 20, top: 28, bottom: 30 };

function monthLabel(month: IsoDate, withYear: boolean): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? "";
  return withYear ? `${name} ${month.slice(2, 4)}` : name;
}

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** Month ticks from the first to the last date, at most about six of them. */
function monthTicks(from: IsoDate, to: IsoDate): IsoDate[] {
  const ticks: IsoDate[] = [];
  let month = monthStart(from);
  const total =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7));
  const step = Math.max(1, Math.ceil(total / 5));
  while (month <= to && ticks.length < 12) {
    ticks.push(month);
    const next = addMonths(month, step);
    if (next === null) break;
    month = next;
  }
  return ticks;
}

/** Y axis limits: a few watts of room around the values, on round numbers. */
function yRange(values: readonly number[]): { min: number; max: number } {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max(10, Math.round((high - low) * 0.2));
  return { min: Math.floor((low - pad) / 10) * 10, max: Math.ceil((high + pad) / 10) * 10 };
}

/**
 * FTP over time as a step line: an FTP holds until the next baseline. Every baseline has a dot with its
 * value written next to it, and the same data is in the list under the chart, so the chart is never the only
 * way to read it. `today` is where the last step ends.
 */
export function FtpChart({ points, today }: { points: readonly FtpPoint[]; today: IsoDate }) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date ?? today;
  const last = sorted.at(-1)?.date ?? today;
  const end = today > last ? today : last;
  const span = Math.max(1, diffDays(first, end) ?? 1);
  const { min, max } = yRange(sorted.map((p) => p.ftp));
  const x = (date: IsoDate) =>
    PAD.left + ((diffDays(first, date) ?? 0) / span) * (W - PAD.left - PAD.right);
  const y = (ftp: number) => PAD.top + (1 - (ftp - min) / (max - min)) * (H - PAD.top - PAD.bottom);

  let path = "";
  sorted.forEach((p, i) => {
    path +=
      i === 0
        ? `M${String(x(p.date))} ${String(y(p.ftp))}`
        : ` H${String(x(p.date))} V${String(y(p.ftp))}`;
  });
  path += ` H${String(x(end))}`;

  const yTicks = [min, min + (max - min) / 3, min + ((max - min) * 2) / 3, max].map(Math.round);
  const months = monthTicks(first, end);
  const multiYear = first.slice(0, 4) !== end.slice(0, 4);
  const description = sorted.map((p) => `${p.date}: ${String(p.ftp)} W`).join(", ");

  return (
    <figure>
      <figcaption className="mb-1 text-[13px] text-muted">FTP over time (W)</figcaption>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label={`FTP over time. ${description}`}
        className="h-auto w-full max-w-[640px] text-text"
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--muted)"
            >
              {tick}
            </text>
          </g>
        ))}
        {months.map((month) => (
          <text
            key={month}
            x={x(month < first ? first : month)}
            y={H - 8}
            textAnchor="middle"
            fontSize="12"
            fill="var(--muted)"
          >
            {monthLabel(month, multiYear)}
          </text>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {sorted.map((p) => (
          <g key={p.date + String(p.ftp)}>
            <circle
              cx={x(p.date)}
              cy={y(p.ftp)}
              r="4.5"
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
            <text
              x={x(p.date)}
              y={y(p.ftp) - 10}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="currentColor"
            >
              {p.ftp}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
