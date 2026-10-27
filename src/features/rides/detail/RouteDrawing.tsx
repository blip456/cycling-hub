import { useMemo } from "react";
import { decodePolyline, routePath } from "../polyline";

const WIDTH = 270;
const HEIGHT = 190;
const PADDING = 16;

/** The first point of a `M x y L …` path, for the start dot. */
function startPoint(path: string): { x: number; y: number } | null {
  const match = /^M(-?[\d.]+) (-?[\d.]+)/.exec(path);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/**
 * The large route shape on the ride detail (DESIGN.md, D-PO5, P34): the polyline as a 3 px accent line
 * on a plain surface card, scaled to fit with even padding, with a start dot. No map, no tiles.
 */
export function RouteDrawing({
  polyline,
  name,
  heightClass,
}: {
  polyline: string | null;
  name: string;
  /** Height of the drawing, e.g. `h-[150px]`. */
  heightClass: string;
}) {
  const path = useMemo(
    () => routePath(decodePolyline(polyline), WIDTH, HEIGHT, PADDING),
    [polyline],
  );
  const start = startPoint(path);

  if (!path) {
    return (
      <p
        className={`flex items-center justify-center rounded-2xl bg-surface px-4 text-center text-[15px] text-muted ${heightClass}`}
      >
        No route shape for this ride.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Route shape of ${name}`}
        className={`block w-full ${heightClass}`}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {start ? (
          <circle
            cx={start.x}
            cy={start.y}
            r={5}
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}
