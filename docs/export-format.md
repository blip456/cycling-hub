# Export format v2 (Chrome extension → Import)

The contract between the Cycling Hub Chrome extension (`extension/`) and the app's import
(`src/features/import/parse.ts`). Decisions T11 (start times), T12 (v2 and streams). v1 stays readable.

## File

```json
{
  "version": 2,
  "exportedAt": "2026-10-28T10:00:00.000Z",
  "source": "cycling-hub-extension 0.1.0",
  "activities": [ ... ]
}
```

- One JSON file, UTF-8, `cycling-hub-export-YYYY-MM-DD.json`. Every activity of the athlete (rides and
  others); the app decides what a ride is (P13).
- Unknown top-level and activity fields are allowed and ignored (activity fields are kept in `raw`, T6).

## Activity

| Field | Type | Source in Strava's `/athlete/training_activities` list | Notes |
| --- | --- | --- | --- |
| `id` | number > 0 | `id` | Strava activity ID. |
| `name` | string | `name` | |
| `sportType` | string | `sport_type` | e.g. `Ride`, `MountainBikeRide`, `AlpineSki`. |
| `startDateLocal` | string `YYYY-MM-DDTHH:MM:SS`, **no zone** | `start_date_local_raw` (Unix seconds of the local wall-clock time) → `new Date(raw * 1000).toISOString().slice(0, 19)` | Brussels wall-clock time (T11). |
| `startDate` | string ISO UTC with `Z` | `start_time` (`…+0000`) | The real instant. |
| `distance` | number ≥ 0, metres | `distance_raw` | |
| `movingTime` | number ≥ 0, seconds | `moving_time_raw` | |
| `elapsedTime` | number ≥ 0, seconds | `elapsed_time_raw` | Optional. |
| `elevation` | number, metres | `elevation_gain_raw` | |
| `commute` | boolean | `commute` | |
| `trainer` | boolean | `trainer` | Indoor. |
| `private` | boolean | `private` | Optional. |
| `hasLatlng` | boolean | `has_latlng` | Optional. |
| `gearId` | number or null | `bike_id` | Optional. |
| `description` | string | `description` | Optional. |
| `polyline` | string or null | from the GPX track (below) | Google encoded polyline, precision 5, simplified to at most ~500 points. null without GPS. |
| `averageWatts`, `maxWatts` | number ≥ 0 or null | from the GPX (below) | null when the GPX has no power. |
| `averageHeartrate`, `maxHeartrate` | number ≥ 0 or null | from the GPX | |
| `averageCadence` | number ≥ 0 or null | from the GPX | |
| `details` | `"gpx"`, `"no_gpx"`, `"skipped"`, `"failed"` | | `gpx`: GPX read; `no_gpx`: Strava had no track (indoor without GPS); `skipped`: not a ride, no GPX fetched; `failed`: the download failed (values null, try again next export). |
| `streams` | object or null | from the GPX | Per-point data, below. Not stored in the database row; the app saves it in Storage. |

Other Strava list fields (static map URLs, twitter texts, tags, visibility) are left out.

## Streams

Columnar arrays of equal length, one entry per GPX track point, in time order:

```json
"streams": {
  "time": [0, 1, 2, 5],
  "latlng": [[51.0445, 4.8906], ...],
  "altitude": [12.4, 12.6, null, 13.0],
  "heartrate": [98, 101, 103, null],
  "watts": [0, 180, 210, 205],
  "cadence": [0, 85, 88, 90]
}
```

- `time`: whole seconds since the first point (required when `streams` is present).
- Every other key is optional; leave a key out when the track has no value for it at all; use `null`
  for a missing single value. Numbers: `latlng` 5 decimals, `altitude` 1 decimal, the rest integers.
- Known keys: `time`, `latlng`, `altitude`, `heartrate`, `watts`, `cadence`, `temperature`. Unknown
  keys are kept.

## Averages from the GPX

- Only points with a value count. Time-weighted over the gaps between points; a gap longer than 30 s
  counts as a pause and is left out.
- `averageWatts` includes zeros (coasting), like Strava. `averageCadence` leaves out zeros.
- Round averages to whole numbers.

## Reading v1 and v2 (app)

- `startDateLocal` **with** a trailing `Z` (v1 files and the old extension) is UTC and is converted to
  Brussels wall-clock time; **without** a zone it is already Brussels wall-clock time (T11).
- `streams` is taken out of `raw` before saving; invalid streams are dropped (the ride still imports).
- The app's "Export rides → JSON" writes `version: 2` with the stored raw activities (without streams),
  so it imports again as unchanged.
