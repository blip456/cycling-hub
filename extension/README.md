# Cycling Hub: Strava export (Chrome extension)

A Manifest V3 Chrome extension that saves all your Strava activities in one file (export format v2,
[`docs/export-format.md`](../docs/export-format.md)) for the Import page of Cycling Hub. Rides get their
route, power, heart rate, cadence and per-second streams from the GPX file Strava offers per activity.

## Install

1. `pnpm install`, then `pnpm ext:build` (writes `extension/dist`; `pnpm ext:dev` rebuilds on every change).
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** and choose the `extension/dist` folder. After a rebuild, press the reload icon on
   the extension's card.

## Use

1. Sign in to [strava.com](https://www.strava.com) in the same Chrome profile.
2. Click the extension's toolbar button. It opens the export page in a tab.
3. **Export activities**. Keep the tab open until the file is saved (`cycling-hub-export-YYYY-MM-DD.json`
   in your downloads folder). **Stop** cancels; the ride details downloaded so far are kept.
4. Import the file on the Import page of Cycling Hub.

The first export downloads one GPX file per ride, so it takes a while: about 2 seconds per ride (some 7
minutes for 200 rides). Later exports reuse what they already have and only download new rides, rides
whose distance, moving time, elapsed time or sport type changed on Strava, and rides that failed before.
**Download ride details again** throws the saved details away and downloads every ride again.

## What it fetches, and how gently

Only from `https://www.strava.com`, with your Strava cookies, one request at a time:

| Call                                        | What for                                                                                                              | Spacing                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `GET /athlete/training_activities?…&page=N` | the activity list behind "My Activities", 20 per page, until all `total` activities are in or a page is empty         | ≥ 1 s between pages     |
| `GET /activities/{id}/export_gpx`           | the GPX of each ride (sport types in `src/features/import/sport-types.ts`); other activities get `details: "skipped"` | ≥ 2 s between downloads |

The spacing counts from the end of one request to the start of the next. On a `429 Too Many Requests`
the extension waits (Strava's `Retry-After`, otherwise 60 s, at most 15 minutes) and tries once more. If
Strava still says 429 during the GPX downloads, the remaining rides are marked `failed` in the file and
are downloaded in the next export.

When Strava answers the list call with its sign-in page, a redirect to it, 401 or 403, the page says
"Sign in to Strava in this browser, then try again."

### Adjusting the list URL

The list call is one constant, `LIST_URL_TEMPLATE` in [`src/lib/strava-list.ts`](src/lib/strava-list.ts).
Its parameters (`keywords=&sport_type=&tags=&commute=&private_activities=&trainer=&gear=` empty,
`search_session_id`, `new_activity_only=false`) are the ones the PO captured in DevTools on
28 Oct 2026. `{session}` is replaced by a new random UUID per export run (Strava's page generates one per
search) and `{page}` by 1, 2, …. If Strava changes the call, capture it again in DevTools (Network tab,
"My Activities", filter on `training_activities`) and update the constant.

## Privacy

- Strava data goes nowhere except the file you download. No other hosts, no analytics, no remote code.
- Permissions: `unlimitedStorage` (the GPX cache in IndexedDB can grow beyond the default quota) and
  host access to `https://www.strava.com/*` only. The file is saved with a normal download link, so the
  `downloads` permission isn't needed.
- The cache (route, averages and streams per ride) stays in the extension's IndexedDB in this Chrome
  profile. Removing the extension deletes it.

## Design choices

- **The export runs on an extension page in a tab** (`export.html`), not in the popup (which closes as
  soon as it loses focus) and not in the service worker (which Chrome stops after 30 s idle). The page
  fetches strava.com directly; the host permission lets it send your Strava cookies.
- **No fallback through an open strava.com tab.** Running the calls inside a strava.com tab with
  `chrome.scripting.executeScript` would need the `scripting` and `tabs` permissions and an open Strava
  tab. It is only worth adding if Strava turns out to refuse the extension page's requests.
- Plain TypeScript, no React: one small page.

## Limits

- Indoor rides without GPS: Strava often has no GPX for them (`details: "no_gpx"`, no route, no power or
  heart rate in the file). Virtual rides (Zwift and the like) usually do have a GPX.
- Averages and maxima are computed from the GPX points (time-weighted, pauses over 30 s left out, zero
  watts counted, zero cadence left out). They can differ slightly from the numbers Strava shows, which
  come from Strava's own streams and rules.
- The list and GPX calls are Strava's website calls, not its public API. They may change without
  notice; see "Adjusting the list URL".

## Code

| File                                                          | What                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `public/manifest.json`                                        | the manifest; its `version` ends up in the file's `source` |
| `src/export.ts`, `export.html`, `src/export.css`              | the page                                                   |
| `src/background.ts`                                           | opens the page from the toolbar button                     |
| `src/lib/strava-list.ts`                                      | list URL, model mapping, paging, cache fingerprint         |
| `src/lib/strava-client.ts`                                    | the two calls, sign-in detection, 429 retry                |
| `src/lib/gpx.ts`, `src/lib/summary.ts`, `src/lib/polyline.ts` | GPX parsing, averages and streams, route                   |
| `src/lib/cache.ts`                                            | the IndexedDB cache                                        |
| `src/lib/exporter.ts`                                         | the whole run and the file                                 |

Tests run with `pnpm test` and use synthetic data only (`src/test/fixtures.ts`). Never commit real
Strava data.
