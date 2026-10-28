/** Reads a Strava GPX export (GPX 1.1, Garmin TrackPointExtension, bare or namespaced power). */

export interface TrackPoint {
  /** Milliseconds since the epoch; null when the point has no (valid) time. */
  time: number | null;
  lat: number | null;
  lon: number | null;
  ele: number | null;
  hr: number | null;
  cad: number | null;
  power: number | null;
  temp: number | null;
}

export type GpxResult = { kind: "gpx"; points: TrackPoint[] } | { kind: "not_gpx" };

type Field = "hr" | "cad" | "power" | "temp";

/** Extension element names (lower case local names) → field. Matched by localName, any namespace. */
const EXTENSION_FIELDS: Record<string, Field> = {
  hr: "hr",
  heartrate: "hr",
  cad: "cad",
  cadence: "cad",
  power: "power",
  watts: "power",
  atemp: "temp",
  temp: "temp",
};

function number(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function directChild(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.localName.toLowerCase() === localName) return child;
  }
  return null;
}

function readPoint(element: Element): TrackPoint {
  const timeText = directChild(element, "time")?.textContent.trim();
  const time = timeText ? Date.parse(timeText) : Number.NaN;
  const point: TrackPoint = {
    time: Number.isNaN(time) ? null : time,
    lat: number(element.getAttribute("lat")),
    lon: number(element.getAttribute("lon")),
    ele: number(directChild(element, "ele")?.textContent),
    hr: null,
    cad: null,
    power: null,
    temp: null,
  };
  const extensions = directChild(element, "extensions");
  if (extensions) {
    for (const node of Array.from(extensions.getElementsByTagName("*"))) {
      const field = EXTENSION_FIELDS[node.localName.toLowerCase()];
      if (field && point[field] === null) point[field] = number(node.textContent);
    }
  }
  if (point.lat === null || point.lon === null) {
    point.lat = null;
    point.lon = null;
  }
  return point;
}

/** Parses GPX text. Anything that is not a GPX document (an HTML page, an error) is `not_gpx`. */
export function parseGpx(text: string): GpxResult {
  if (!text.trim()) return { kind: "not_gpx" };
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const root = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length > 0 || root.localName !== "gpx") {
    return { kind: "not_gpx" };
  }
  const points = Array.from(root.getElementsByTagNameNS("*", "trkpt")).map(readPoint);
  return { kind: "gpx", points };
}
