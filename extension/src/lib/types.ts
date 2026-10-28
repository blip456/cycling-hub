/** Export format v2, see docs/export-format.md (the contract with the app's import). */

export type Details = "gpx" | "no_gpx" | "skipped" | "failed";

export interface Streams {
  time: number[];
  latlng?: ([number, number] | null)[];
  altitude?: (number | null)[];
  heartrate?: (number | null)[];
  watts?: (number | null)[];
  cadence?: (number | null)[];
  temperature?: (number | null)[];
}

/** What the extension derives from one GPX file (and caches). */
export interface GpxSummary {
  details: Details;
  polyline: string | null;
  averageWatts: number | null;
  maxWatts: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  streams: Streams | null;
}

/** The fields that come from Strava's activity list. */
export interface ListActivity {
  id: number;
  name: string;
  sportType: string;
  startDateLocal: string;
  startDate: string;
  distance: number;
  movingTime: number;
  elapsedTime?: number;
  elevation: number;
  commute: boolean;
  trainer: boolean;
  private?: boolean;
  hasLatlng?: boolean;
  gearId?: number | null;
  description?: string;
}

export type ExportActivity = ListActivity & GpxSummary;

export interface ExportFile {
  version: 2;
  exportedAt: string;
  source: string;
  activities: ExportActivity[];
}

export const EMPTY_SUMMARY: Omit<GpxSummary, "details"> = {
  polyline: null,
  averageWatts: null,
  maxWatts: null,
  averageHeartrate: null,
  maxHeartrate: null,
  averageCadence: null,
  streams: null,
};

export function summaryWithout(details: "no_gpx" | "skipped" | "failed"): GpxSummary {
  return { ...EMPTY_SUMMARY, details };
}
