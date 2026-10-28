/** Route shape from the encoded polyline in the export (P34: shape only, no map). */

export type Point = readonly [lat: number, lng: number];

/** Decodes a Google encoded polyline (precision 5). Returns [] for an empty or broken string. */
export function decodePolyline(encoded: string | null | undefined): Point[] {
  if (!encoded) return [];
  const points: Point[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  try {
    while (index < encoded.length) {
      for (const axis of [0, 1]) {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
          if (index >= encoded.length) throw new Error("truncated polyline");
          byte = encoded.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        const delta = result & 1 ? ~(result >> 1) : result >> 1;
        if (axis === 0) lat += delta;
        else lng += delta;
      }
      points.push([lat / 1e5, lng / 1e5]);
    }
  } catch {
    return [];
  }
  return points;
}

/**
 * An SVG path (`M x y L …`) that fits the route in a `width × height` box with `padding`, keeping its
 * aspect ratio (longitude scaled by cos(latitude) so shapes are not stretched). "" when there are fewer
 * than two points.
 */
export function routePath(
  points: readonly Point[],
  width: number,
  height: number,
  padding = 2,
): string {
  if (points.length < 2) return "";
  const lats = points.map(([lat]) => lat);
  const meanLat = (lats.reduce((a, b) => a + b, 0) / lats.length) * (Math.PI / 180);
  const xs = points.map(([, lng]) => lng * Math.cos(meanLat));
  const ys = lats.map((lat) => -lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return xs
    .map((x, i) => {
      const px = (x - minX) * scale + offsetX;
      const py = ((ys[i] ?? 0) - minY) * scale + offsetY;
      return `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
}
