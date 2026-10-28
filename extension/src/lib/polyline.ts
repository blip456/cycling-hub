/** Google encoded polyline (precision 5) and Douglas–Peucker simplification. */

export type LatLng = readonly [number, number];

/** The route in the export has at most this many points (docs/export-format.md). */
export const MAX_POLYLINE_POINTS = 500;

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(points: readonly LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    out += encodeValue(la - lastLat) + encodeValue(ln - lastLng);
    lastLat = la;
    lastLng = ln;
  }
  return out;
}

/** Squared distance from p to segment a–b, in a local flat projection (degrees, lng scaled). */
function segmentDistanceSq(p: LatLng, a: LatLng, b: LatLng, lngScale: number): number {
  const ax = a[1] * lngScale;
  const ay = a[0];
  const bx = b[1] * lngScale;
  const by = b[0];
  const px = p[1] * lngScale;
  const py = p[0];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

interface Segment {
  start: number;
  end: number;
  index: number;
  distance: number;
}

/** A max-heap of segments by the distance of their farthest point. */
class SegmentHeap {
  private items: Segment[] = [];

  get size() {
    return this.items.length;
  }

  push(segment: Segment) {
    const items = this.items;
    items.push(segment);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent];
      if (!p || p.distance >= segment.distance) break;
      items[i] = p;
      i = parent;
    }
    items[i] = segment;
  }

  pop(): Segment | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (!top || !last || items.length === 0) return top;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let largest = i;
      let largestDistance = last.distance;
      const l = items[left];
      const r = items[right];
      if (l && l.distance > largestDistance) {
        largest = left;
        largestDistance = l.distance;
      }
      if (r && r.distance > largestDistance) largest = right;
      if (largest === i) break;
      const child = items[largest];
      if (!child) break;
      items[i] = child;
      i = largest;
    }
    items[i] = last;
    return top;
  }
}

/**
 * Douglas–Peucker that always splits the segment with the farthest point first, until `maxPoints`
 * are kept or every left-out point is within about 1 m of the line. Keeps the shape as well as
 * possible within the point budget.
 */
export function simplify(points: readonly LatLng[], maxPoints = MAX_POLYLINE_POINTS): LatLng[] {
  const first = points[0];
  if (points.length <= maxPoints || !first || maxPoints < 2) return [...points];
  const lngScale = Math.cos((first[0] * Math.PI) / 180);
  const minDistanceSq = 0.00001 ** 2;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  let kept = 2;

  const heap = new SegmentHeap();
  const consider = (start: number, end: number) => {
    const a = points[start];
    const b = points[end];
    if (!a || !b || end - start < 2) return;
    let distance = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      if (!p) continue;
      const d = segmentDistanceSq(p, a, b, lngScale);
      if (d > distance) {
        distance = d;
        index = i;
      }
    }
    if (index !== -1 && distance > minDistanceSq) heap.push({ start, end, index, distance });
  };

  consider(0, points.length - 1);
  while (kept < maxPoints && heap.size > 0) {
    const segment = heap.pop();
    if (!segment) break;
    keep[segment.index] = 1;
    kept++;
    consider(segment.start, segment.index);
    consider(segment.index, segment.end);
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** The route for the export: simplified and encoded; null without points. */
export function routePolyline(points: readonly LatLng[]): string | null {
  if (points.length === 0) return null;
  return encodePolyline(simplify(points));
}
