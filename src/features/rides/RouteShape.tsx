import { useMemo } from "react";
import { decodePolyline, routePath } from "./polyline";

interface RouteShapeProps {
  /** Encoded polyline from the export; nothing is drawn without one (indoor rides). */
  polyline: string | null;
  width: number;
  height: number;
  /** Line width in px: 2 on the list thumbnail, 3 on the ride detail (DESIGN.md, iconography). */
  strokeWidth?: number;
  padding?: number;
  /** Start dot: a surface-filled circle with an accent ring (ride detail). */
  startDot?: boolean;
  /** Accessible name; without it the shape is decorative (hidden from screen readers). */
  label?: string;
  className?: string;
}

/** The route as a line in the accent colour (P34: shape only, no map). Shared by the list and detail. */
export function RouteShape({
  polyline,
  width,
  height,
  strokeWidth = 2,
  padding = 2,
  startDot = false,
  label,
  className,
}: RouteShapeProps) {
  const path = useMemo(
    () => routePath(decodePolyline(polyline), width, height, padding),
    [polyline, width, height, padding],
  );
  if (!path) return null;
  const start = /^M(-?[\d.]+) (-?[\d.]+)/.exec(path);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable={false}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {startDot && start ? (
        <circle
          cx={start[1]}
          cy={start[2]}
          r={strokeWidth * 1.75}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
        />
      ) : null}
    </svg>
  );
}
