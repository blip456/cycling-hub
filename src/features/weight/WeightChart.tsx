import { useEffect, useRef, useState, type PointerEvent } from "react";
import { addDays, diffDays, type IsoDate, type TrendPoint } from "@/features/athlete";
import { niceTicks } from "./chart-scale";
import { formatDay, formatKg, formatShortDay } from "./format";

const HEIGHT = 260;
const MARGIN = { top: 14, right: 14, bottom: 30, left: 46 };
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 600;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(Math.max(MIN_WIDTH, Math.round(next)));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { ref, width };
}

/**
 * The trend chart (W2): the raw weigh-ins as hollow circles and the 7-day average as a solid line, so
 * shape and weight differ and colour is not the only signal. The y axis is zoomed to the data. Plain SVG;
 * the same numbers are available as a table under it. A pointer (mouse or touch) shows the date and
 * weight of the nearest entry in a flat label.
 */
export function WeightChart({
  points,
  from,
  to,
  summary,
}: {
  points: readonly TrendPoint[];
  from: IsoDate;
  to: IsoDate;
  summary: string;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const values = points.flatMap((p) => [p.kg, p.average]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0] ?? 0;
  const yMax = ticks[ticks.length - 1] ?? 1;
  const totalDays = Math.max(1, diffDays(from, to) ?? 1);
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (date: IsoDate) => MARGIN.left + ((diffDays(from, date) ?? 0) / totalDays) * plotW;
  const y = (kg: number) => MARGIN.top + (1 - (kg - yMin) / (yMax - yMin || 1)) * plotH;

  const xLabels = [0, 1, 2, 3].map((i) => {
    const offset = Math.round((totalDays * i) / 3);
    return {
      offset,
      date: addDays(from, offset) ?? from,
      anchor: i === 0 ? "start" : i === 3 ? "end" : "middle",
    } as const;
  });

  const radius = points.length > 60 ? 2.5 : 4;
  const current = active === null ? undefined : points[active];

  function onPointer(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    let best = 0;
    let bestDistance = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(x(p.date) - px);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    setActive(best);
  }

  const tipText = current ? `${formatDay(current.date)}: ${formatKg(current.kg)} kg` : "";
  const tipW = tipText.length * 7.4 + 16;
  const tipX = current ? Math.min(Math.max(x(current.date) - tipW / 2, 2), width - tipW - 2) : 0;
  const tipY = current ? Math.max(y(current.kg) - 38, 2) : 0;

  return (
    <div ref={ref} className="w-full">
      <svg
        role="img"
        aria-label={summary}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block max-w-full touch-pan-y select-none"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => {
          setActive(null);
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={13}
              className="fill-muted"
            >
              {tick}
            </text>
          </g>
        ))}
        <text x={4} y={MARGIN.top - 2} fontSize={13} className="fill-muted">
          kg
        </text>
        {xLabels.map(({ offset, date, anchor }) => (
          <text
            key={offset}
            x={MARGIN.left + (offset / totalDays) * plotW}
            y={HEIGHT - 8}
            textAnchor={anchor}
            fontSize={13}
            className="fill-muted"
          >
            {formatShortDay(date)}
          </text>
        ))}
        <polyline
          fill="none"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-accent"
          points={points.map((p) => `${x(p.date)},${y(p.average)}`).join(" ")}
        />
        {points.map((p) => (
          <circle
            key={p.date}
            cx={x(p.date)}
            cy={y(p.kg)}
            r={radius}
            strokeWidth={1.5}
            className="fill-surface stroke-text"
          />
        ))}
        {current ? (
          <g pointerEvents="none">
            <circle
              cx={x(current.date)}
              cy={y(current.kg)}
              r={radius + 2}
              strokeWidth={2}
              className="fill-surface stroke-accent"
            />
            <rect
              x={tipX}
              y={tipY}
              width={tipW}
              height={28}
              rx={8}
              className="fill-raised stroke-input-border"
              strokeWidth={1}
            />
            <text
              x={tipX + tipW / 2}
              y={tipY + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              className="fill-text"
            >
              {tipText}
            </text>
          </g>
        ) : null}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <li className="flex items-center gap-2">
          <svg width={22} height={10} aria-hidden="true">
            <line x1={0} x2={22} y1={5} y2={5} strokeWidth={2.5} className="stroke-accent" />
          </svg>
          7-day average
        </li>
        <li className="flex items-center gap-2">
          <svg width={12} height={12} aria-hidden="true">
            <circle cx={6} cy={6} r={4} strokeWidth={1.5} className="fill-surface stroke-text" />
          </svg>
          Entry
        </li>
      </ul>
    </div>
  );
}
