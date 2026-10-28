/** Synthetic Strava responses for tests. Every value is made up; never put real Strava data here. */

export interface FakeModelInput {
  id: number;
  sportType?: string;
  /** Local wall clock, `YYYY-MM-DDTHH:MM:SS`. */
  local?: string;
  /** Hours the local time is ahead of UTC. */
  offsetHours?: number;
  distance?: number;
  moving?: number;
  elapsed?: number;
  trainer?: boolean;
}

export function fakeModel(input: FakeModelInput): Record<string, unknown> {
  const local = input.local ?? "2026-10-18T08:04:40";
  const localRaw = Date.parse(`${local}Z`) / 1000;
  const utc = new Date((localRaw - (input.offsetHours ?? 2) * 3600) * 1000);
  const startTime = `${utc.toISOString().slice(0, 19)}+0000`;
  return {
    id: input.id,
    id_str: String(input.id),
    name: `Test activity ${input.id}`,
    sport_type: input.sportType ?? "Ride",
    display_type: input.sportType ?? "Ride",
    private: false,
    bike_id: 1234,
    start_date: "Sun, 10/18/2026",
    start_date_local_raw: localRaw,
    start_time: startTime,
    distance: "1.00",
    distance_raw: input.distance ?? 1000,
    moving_time_raw: input.moving ?? 300,
    elapsed_time_raw: input.elapsed ?? 320,
    trainer: input.trainer ?? false,
    static_map: "https://example.invalid/map.png",
    has_latlng: true,
    commute: false,
    elevation_gain: "10",
    elevation_gain_raw: 10,
    description: "",
    activity_url: `https://www.strava.com/activities/${input.id}`,
    twitter_msg: "tweet",
    tags: { "6": true },
    hide_power: false,
    hide_heartrate: false,
    visibility: "everyone",
  };
}

export interface FakePoint {
  /** Seconds after the start. */
  t: number;
  lat?: number;
  lon?: number;
  ele?: number;
  hr?: number;
  cad?: number;
  power?: number;
  temp?: number;
}

/** A GPX 1.1 file like Strava's export. `powerStyle` picks bare `<power>` or a namespaced one. */
export function fakeGpx(
  points: readonly FakePoint[],
  {
    powerStyle = "bare",
    start = "2026-10-18T06:04:40Z",
  }: { powerStyle?: "bare" | "namespaced"; start?: string } = {},
): string {
  const t0 = Date.parse(start);
  const pts = points
    .map((p) => {
      const ext: string[] = [];
      if (p.power !== undefined) {
        ext.push(
          powerStyle === "bare" ? `<power>${p.power}</power>` : `<pwr:power>${p.power}</pwr:power>`,
        );
      }
      const tpx: string[] = [];
      if (p.temp !== undefined) tpx.push(`<gpxtpx:atemp>${p.temp}</gpxtpx:atemp>`);
      if (p.hr !== undefined) tpx.push(`<gpxtpx:hr>${p.hr}</gpxtpx:hr>`);
      if (p.cad !== undefined) tpx.push(`<gpxtpx:cad>${p.cad}</gpxtpx:cad>`);
      if (tpx.length > 0) {
        ext.push(`<gpxtpx:TrackPointExtension>${tpx.join("")}</gpxtpx:TrackPointExtension>`);
      }
      const latlon = p.lat !== undefined ? ` lat="${p.lat}" lon="${p.lon ?? 0}"` : "";
      return [
        `<trkpt${latlon}>`,
        p.ele !== undefined ? `<ele>${p.ele}</ele>` : "",
        `<time>${new Date(t0 + p.t * 1000).toISOString().replace(".000", "")}</time>`,
        ext.length > 0 ? `<extensions>${ext.join("")}</extensions>` : "",
        "</trkpt>",
      ].join("");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
  xmlns:pwr="http://www.garmin.com/xmlschemas/PowerExtension/v1">
 <metadata><time>${start}</time></metadata>
 <trk><name>Test</name><type>cycling</type><trkseg>
${pts}
 </trkseg></trk>
</gpx>`;
}

export const HTML_PAGE = `<!DOCTYPE html><html><head><title>Log In | Strava</title></head><body><form></form></body></html>`;

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}
