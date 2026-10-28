# Backlog

The roadmap (discovery) and the sprint planning (delivery) for Cycling Hub. Decisions are referenced by ID
from [`decisions.md`](decisions.md); screens by ID from the wireframes in [`wireframes/`](wireframes/).

## How we work

- **Dual-track agile** (D1). The roadmap below is epic-level and revisited at every sprint review. Only
  the next sprint is planned in detail. No sprint starts without the PO's go.
- **One-week sprints**; a sprint is a unit of scope, not of calendar time.
- **Versions** (D5, D6): Sprint 0 ships **v0.1.0**, then every sprint ships the next minor version.
  Hotfixes between sprints are patch releases with `fix:` titles. The release PR is merged once per
  sprint, after the PO has tested on the `dev` preview.
- **Environments** (T3, T4): `dev` branch → `cycling-hub-dev` Supabase project + Vercel preview;
  `main` → `cycling-hub-prod` + Vercel production.
- **Designs first** (D2): a screen is built only after its wireframe and design are approved.
- **Sprint ritual:** demo summary with preview URL and a phone test checklist → PO feedback → fixes →
  release PR `dev → main` after PO approval → retro (3 bullets) → re-plan → stop.

## Roadmap — epics

Sequence and dependencies matter; dates don't. **Product focus (P34):** tailored training plans and
AI/LLM analysis of past sessions. Ride data is the input for that, not an end in itself (no Strava
rebuild).

| #   | Epic                                   | Outcome                                                                                                                                  | Sprints     | Open discovery questions                                                                                          |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| E0  | **Foundation, import & rides**         | Design system, repo + standards + CI/CD, login, import with history, settings + release pages, ride list and ride detail.               | S0, S1, S2  | Export format v2 and its timing (Q1). Weather source (P19). Export format for "export rides".                    |
| E1  | **Baseline & zones**                   | Athlete profile, guided FTP test week, power and HR zones from the test, zone history.                                                  | S3          | Test protocol (20-min, ramp)? Zone models? Manual test entry or automatic from streams (needs export v2 streams)? |
| E2  | **Training plan — general fitness**    | Periodized plan (base / build / peak) around Wed / Sun / optional ride, weekly view, session detail with watt and HR targets.           | —           | Rule-based, Claude API or hybrid? How does the plan adapt to missed sessions?                                    |
| E3  | **Plan vs actual & progress**          | Match rides to sessions, compliance, trends: FTP estimate, power curve, efficiency factor, aerobic decoupling, fitness / fatigue / form. | —           | Which metrics are reliable from the export? Most history has no power or HR (P5).                                 |
| E4  | **Event mode**                         | Event with date, distance, elevation, goal; plan built backwards, taper, pacing and fueling targets.                                    | —           | Do event mode and general mode coexist?                                                                           |
| E5  | **Body composition**                   | Weight log and trend, linked to training load.                                                                                          | —           | Manual entry or smart-scale import?                                                                               |
| E6  | **Nutrition**                          | Food logging, ride-day vs rest-day targets, daily meal plans.                                                                           | —           | Food database source? Acceptable logging effort?                                                                  |

Out of scope: medical data, multi-user, Strava API, printable/PDF plans, maps (P34).

## Sprint format (parsed at build time)

The in-app **What's next** page is generated from the sprint sections below by a build-time script. The
format is strict; the build fails when it is broken:

```markdown
## v0.2.0 — Title
Sprint: 1
Status: planned | in progress | shipped
Tagline: One sentence in user terms.

### Details
Everything from here to the next "## v" heading is stripped from the app.
```

- Kept: version, title, sprint, status, tagline. Stripped: everything under `### Details`.
- The build fails when a version, title, sprint or tagline is missing or a version appears twice.
- `shipped` entries are left out of What's next; they appear in What's new (the changelog).
- Only `## v…` headings are parsed; the sections above this one are ignored.

## v0.1.0 — Design & foundation
Sprint: 0
Status: in progress
Tagline: The Cycling Hub look and feel, and an installable app you can sign in to.

### Details

Goal: we agree on a design system together, then build a professionally set-up foundation with sign-in.
Two parts; part B starts only after the PO approves part A.

**Part A — Design system (gate: PO approves the design)**

1. Design question round with the PO: overall feel, colour direction (light and dark), typography,
   density, tone. Asked in rounds of 3–4 questions with visual options.
2. Two or three visual directions as a quick HTML comparison, built on the approved wireframe layouts.
3. Design V1 in `docs/design/V1/index.html`, same feedback machinery as the wireframes:
   - tokens: colours (light + dark, WCAG 2.2 AA contrast), type scale, spacing, radius, elevation;
   - components: top bar, side menu (phone drawer + permanent desktop menu), buttons, inputs with labels
     and helper text, cards, bottom status card (P12), pills (incl. Feature / Fix / Technical, P18), stat
     blocks, table rows, empty / loading / error states;
   - high-fidelity screens, phone and desktop, light and dark, for everything in Sprints 0–2: sign in
     (A1–A5), import (C1–C4 + history), settings (G1–G3), rides (B1a, X1, B2, B3).
     These include the wireframe V1 feedback, so there is no separate wireframes V2 round.
4. PO feedback recorded verbatim in `docs/design/V1/feedback-product-owner.md`; a V2 if needed.

**Part B — Technical setup (after design approval)**

5. Git: `main` with an initial commit, `dev` from `main`, default branch `main`. The PO sets the
   rulesets on `main` and `dev` (no direct pushes, PR required, CI must pass); exact clicks in the
   README.
6. Scaffold: Vite + React + TypeScript strict, React Router, TanStack Query, Tailwind v4 with the
   design tokens (light / dark / system via a `data-theme` attribute), pnpm, Node 22.
7. App shell: top bar + side menu (phone), permanent side menu (desktop) — N1b, P7, P8.
8. PWA basics: manifest, icons, installable on iOS and Android, service worker with update detection
   (no offline data, P12).
9. Sign in (A1–A5): email + password, forgot / reset password (Supabase default flow), sign out, and
   the 30-day re-sign-in rule enforced in the app (A3). Routes behind sign-in.
10. Supabase: `cycling-hub-dev` and `cycling-hub-prod` set up by the PO from the README checklist
    (sign-ups off, site URL + redirect URLs, the single user created in the dashboard). First migration:
    `profiles` (one row per user, `last_seen_version`), RLS scoped to `auth.uid()`, pgTAP test.
11. Quality: ESLint + Prettier, TypeScript strict, Vitest + Testing Library, commitlint + lefthook
    (commit-msg + pre-commit), branch-name check (`feat/ fix/ hotfix/ chore/ docs/ refactor/ test/ ci/`,
    kebab-case).
12. CI on every PR: lint + format check, typecheck, tests, production build, branch name, PR title
    (Conventional Commits), database check (detect `supabase/migrations` changes, label + comment
    "this PR contains a migration", `supabase db reset` on a fresh local database, `supabase db lint`,
    pgTAP tests).
13. Migration deploy: GitHub Action `supabase db push` to dev on merge into `dev` (environment `dev`), and
    to production on merge into `main` behind the GitHub environment `production` with required
    reviewer = PO.
14. Releases: release-please on `main` (version in `package.json`, `CHANGELOG.md`, tags, GitHub
    Release), PR title pattern `chore(release): …`, changelog sections for Features, Bug fixes and
    technical types (P18). After each release a workflow opens a PR `main → dev` so the version bump
    flows back. `dev → main` PRs use a merge commit, work branches are squash-merged into `dev`.
15. Vercel: production only from `main`, and only for release commits (Ignored Build Step), so the
    version in the app always matches the release; previews for `dev` and all other branches; env vars
    per environment (Supabase URL + publishable key; no secrets in the client).
16. Docs: `README.md` (setup, scripts, environments, release flow, PO checklists), `CLAUDE.md` and
    `CONTRIBUTING.md` (conventions for agents and people), decision log updated.

**Acceptance criteria**

- The PO has approved design V1 (or V2).
- The app installs on the PO's phone and opens on desktop; the PO can sign in, sign out and reset the
  password; there is no way to sign up; after 30 days the app asks to sign in again.
- A PR with a lint error, a failing test, a broken build, a bad branch name or a non-conventional title
  is blocked.
- A PR with a migration is flagged and the migration is validated against a fresh database in CI.
- Merging into `dev` applies migrations to the dev database; merging into `main` waits for the PO's
  approval before applying them to production.
- Merging a `feat:` into `main` produces a release PR; merging it creates v0.1.0, a tag and a changelog
  entry, and production deploys that version.
- No secrets in the repository.

## v0.2.0 — Import & settings
Sprint: 1
Status: shipped
Tagline: Drop your Strava export file and see exactly what was imported, plus settings, What's new and What's next.

### Details

> Delivered 28 Oct 2026: merged to `main` with `dev` in PR #5. The production release (release PR #6)
> and the production database migrations are still pending (missing Supabase secrets in the `production`
> environment, see `docs/setup-production.md`).
>
> Built on 18 Oct 2026 on `chore/sprint-1-integration`, verified locally (174 unit tests, 62 pgTAP
> checks, end-to-end import of the real export: 208 rides + 97 not a ride, second run all unchanged).
> Waiting for the hosted setup and the PO's test on a preview: `docs/test-checklists/v0.2.0.md`.

Goal: import the backfill and every later export reliably, and see the app's version, changes and plans.

1. Import page (C1–C4, X2): tap to pick a file on the phone, drag and drop on desktop.
2. Validation with Zod, two levels (P14): a file that isn't a valid export changes nothing and shows why;
   broken activities inside a valid file are skipped and listed with `activities[i].field` and reason.
3. Parser for export v1 (sample: `activities.json`, 305 activities since 2014), tolerant of the optional
   v2 fields once agreed (Q1). `startDateLocal` read as Brussels wall-clock time (T5).
4. Storage (migration + pgTAP): `activities` table with normalised fields, `sport_type`, `is_ride`
   (cycling types shown, others stored and hidden, P13), the raw activity JSON (T6), `deleted_at`
   (P15), RLS on `auth.uid()`; `imports` table for the history (P16).
5. Upsert on the Strava activity ID in one database function (all-or-nothing per file); outcome per
   activity: new, updated, unchanged, not a ride, skipped (errors), deleted earlier (P15, P17).
6. Import summary (C3) with the outcome cards and a "View rides" link (enabled in Sprint 2).
7. Import history: list of past imports with date, file name and counts, including files that were not a valid export ("Not imported", P33).
8. Settings (G1): account email, theme switch System / Light / Dark (P9), units and time zone (info),
   version, links to What's new and What's next, sign out.
9. What's new (G2): changelog generated at build time from `CHANGELOG.md`, release-please link
   suffixes stripped, pills Feature / Fix / Technical (P18). Bottom card banner after an update (B1d,
   P12; on desktop inside the side menu, P31); dismissing it or opening the page stores the version in
   `profiles.last_seen_version`.
10. What's next (G3): build-time script parses this file per the sprint format above, emits a static
    JSON bundled with the app; the build fails on a broken entry. No calls to GitHub at runtime.
11. Unit tests: parser + validation (with the real sample and broken variants), outcome classification
    and de-duplication, changelog parser, sprint-format parser.

**Acceptance criteria**

- Importing `activities.json` stores all 305 activities; only the cycling ones count as rides.
- Importing the same file twice creates no duplicates; the second summary reports them as unchanged.
- A file with a few broken activities imports the rest and lists each skipped one with its reason; a
  non-JSON or wrongly structured file changes nothing.
- Every import appears in the import history with its counts.
- After a new deploy the What's new card shows once, then stays gone on phone and laptop.
- What's next shows only version, title, sprint, status and tagline.
- The version in Settings matches the deployed release.

## v0.3.0 — Rides
Sprint: 2
Status: shipped
Tagline: All your rides by week or month, sortable and filterable, with the details of every ride, and a Chrome extension that exports them from Strava with power and heart rate.

### Details

> Delivered 28 Oct 2026: tested and approved by the PO; merged to `main` with `dev` in PR #5. The
> production release (release PR #6) and the production database migrations are still pending (see v0.2.0).
>
> Progress (27 Oct 2026): built and integrated on `chore/sprint-2-integration`, verified locally against
> the real export (208 rides, 118 week and 52 month groups, every sort and filter, delete + undo, re-import
> "Deleted earlier 1", CSV 207 rows, JSON re-import "Unchanged 207"; 253 unit tests, lint, typecheck,
> build). Waiting for the hosted setup and the PO's test: `docs/test-checklists/v0.3.0.md`.

Goal: see every imported ride, find any ride quickly, and open, delete or export it.

Foundation (done first, shared by both parts): `src/features/rides/` — `api.ts` (visible rides =
cycling types, not deleted; one ride; soft delete and restore; export query with raw JSON), `hooks.ts`
(TanStack Query, optimistic delete with rollback), `format.ts` (km, h:mm, km/h derived, W, bpm, m,
"—" when missing; Brussels wall-clock dates; tags; ISO-week and month groups with totals) and
`polyline.ts` (decode + SVG route shape), with unit tests.

Part A — ride list (design V1: B1a, B2, B3a, B3b, X1):

1. Phone (B1a): cards newest first, grouped by week or month (Week / Month control) with totals (rides,
   km, moving time) per group; metric order distance, moving time, average speed, average power,
   average HR, elevation, each in its metric colour (P10, P11); tags in the date line (P24); small route
   shape per ride; "Hide commutes" filter (P11).
2. Desktop (X1, ≥ 960 px): dense table, sortable by every column (aria-sort, keyboard; default date,
   newest first) and filter bar: name search, type, period, hide commutes, clear filters (P35). Sorting
   by anything but date shows a flat list with a count and totals line instead of week/month groups.
3. Empty (B2, link to Import), loading (B3a) and error (B3b, bottom status card with Try again) states.
4. Filters and sort survive navigation to a ride and back (URL search params).

Part B — ride detail, delete, export (design V1: B4):

5. Ride detail page `/rides/:id` (B4): name, date, tags, all stored metrics (incl. max power, max HR,
   cadence when present, "—" otherwise), the route shape (no map, P34), Strava activity link.
6. Delete a ride (P15): confirm, then removed at once with an Undo in the status card for a few seconds;
   the ride is skipped by later imports ("Deleted earlier"); undo restores it.
7. Export rides (P37): CSV (the normalised fields of the visible rides, for spreadsheets) and JSON (the
   raw activities in the extension's export format, so it can be re-imported).
8. Tests: list grouping and totals, sorting and filtering, detail page states, delete + undo, export
   contents (CSV escaping, JSON re-imports with the Sprint 1 parser).

Part C — Chrome extension and export v2 (PO request, 28 Oct 2026; T11, T12, `docs/export-format.md`):

9. Chrome extension (`extension/`, Manifest V3, loaded unpacked): on strava.com it reads the activity
   list (`/athlete/training_activities`, all pages), downloads a GPX per ride for the route, power,
   heart rate and cadence, and saves one export file (format v2). Calls are spaced out; GPX results are
   cached so a later export only downloads new or changed rides.
10. Import reads v2 next to v1: correct start times (T11), averages and maxima into the existing
    columns, the route from the GPX.
11. Per-second streams saved per ride in Supabase Storage (private bucket, RLS on `auth.uid()`), after
    the import is saved; a failed upload can be retried without importing again.
12. Fix: v1 start times are UTC and are converted to Brussels time (T11); the first import after this
    fix reports the existing rides as updated.
13. Tests: GPX parsing and averages, polyline encoding, list mapping, v2 parsing, stream upload, the
    storage policies (pgTAP).

Discovery (no build): weather per ride (P19).

**Acceptance criteria**

- After importing the real export, the list shows 208 rides newest first, grouped by week with correct
  totals, and the month view groups by month.
- On desktop every column sorts both ways; name search, type, period and hide commutes filter the table.
- A ride opens its detail page with all values and the route shape; missing power/HR show "—".
- Deleting a ride removes it, Undo brings it back, and a re-import reports a deleted ride as "Deleted
  earlier".
- The CSV opens in a spreadsheet with one row per visible ride; the JSON imports again as "Unchanged".
- Works on phone and desktop, light and dark, WCAG 2.2 AA, no horizontal scrolling on the phone.
- The extension exports every activity from Strava into one v2 file; importing it shows the rides with
  start times as on Strava, and power and heart rate where the GPX has them.
- A second export only downloads GPX files for new or changed rides; importing it reports unchanged.
- The per-second streams of each ride are in Storage and only readable by the signed-in user.

## v0.4.0 — Athlete profile & zones
Sprint: 3
Status: planned
Tagline: Your athlete profile, your FTP from a guided test week or your own rides, and your power and heart rate zones with a history.

### Details

> Planned 28 Oct 2026 (epic E1). Draft for the PO: nothing starts before the PO's go and the answers to the
> open questions below.

Goal: the app knows who the athlete is and how strong they are. A complete athlete profile, a current FTP and
heart rate baseline, the zones derived from them, and a dated history, so that E2 (training plan) can
build around the PO's week and give watt and heart rate targets, and E3 can judge sessions against zones.

Two parts; part B starts only after the PO approves part A (D2).

**Part A: Discovery and design (gate: PO approves)**

1. Answer the open questions below (PO), in one round of 3–4 questions with the options laid out.
2. Wireframes and design for the new screens in the existing design system (Deep Ocean, light + dark,
   phone + desktop): Athlete profile (view and edit), Baseline overview, Guided test week, FTP result and
   confirm, Zones and history.
3. Write the decisions in `docs/decisions.md` (a new row each) and update `docs/export-format.md` only if
   the streams are not enough.

**Part B: Build**

4. **Athlete profile** (the rest of the profile, on the existing `profiles` row; additive migration, RLS and
   pgTAP as for every table). Proposed fields, to confirm with Q-E1-6:
   - About you: display name, birth year (for age-based heart rate estimates), height.
   - Cycling background: experience level, years riding, main bike (name and type).
   - Training week: available days, the fixed rides (Wed, Sun) and the optional third ride, usual ride
     length per day and hours per week the PO wants to train. This is the input E2 needs.
   - Goals: general fitness as the default (P1), a free-text goal, and an optional event name and date
     (stored only; event mode itself is E4).
   - Not in the profile: medical data (out of scope, P1 and P34) and weight (E5).
   The profile page shows which sections are filled in, every field is optional and nothing blocks the rest
   of the app. Visible labels, helper text, no example values in inputs.
5. Data: migration for an athlete baseline (max HR, optional resting HR and LTHR) and a dated
   **baseline history** table (FTP, source, effective date, note), additive, RLS on `auth.uid()`, grants,
   pgTAP tests, `pnpm db:types`. History rows are never overwritten; the current baseline is the newest row.
6. Baseline page (new menu item, or under Settings if the design says so) with the current FTP and heart
   rate values, and "Update baseline".
7. Guided FTP test week: protocol steps with the session targets, a checklist per session and a place to
   enter the result. Both protocols (P39), Coggan zones (P40). The PO chooses the date of each session (P43).
8. FTP estimate from the stored streams (T13): best 20-minute power from rides that have power, shown as a
   suggestion with the ride it came from (date, link to the ride; P41). The PO confirms it or enters a value by
   hand; nothing changes the baseline without a confirm.
9. Zones: power zones from FTP and heart rate zones from the chosen reference, shown as a table with
   ranges in W and bpm, and a zone colour per zone from the design tokens.
10. Zone history: list of past baselines with their zones and a simple FTP-over-time view; nothing is lost
   when a new FTP is set.
11. Empty, loading and error states, copy in plain English, metric units (P6).
12. Tests: best-effort power calculation (20 min, gaps and dropouts), Coggan zone calculation (power and heart rate),
    baseline history rules (newest wins, no overwrite), stream reading and the confirm flow.

**Decided by the PO (28 Oct 2026, P39 to P43)**

- Q-E1-1: both the 20-minute and the ramp test, picked per test week.
- Q-E1-2: Coggan 7 power zones and 5 heart rate zones.
- Q-E1-3: FTP manual and automatic (suggestion from streams, confirmed by the PO).
- Q-E1-4: heart rate reference manual and automatic (typed value or highest value in the data).
- Q-E1-5: the PO picks the date of each test session; the app does not schedule for them.

**Still open for the PO**

| #      | Question | Options |
| ------ | -------- | ------- |
| Q-E1-6 | Which profile fields do you want, and which are too much? | The proposed set in item 4 (about you, cycling background, training week, goals); a minimal set (name, birth year, available days, goal); or the full set plus extra fields you name.                |
| Q-E1-7 | Should weight be in the profile now?                        | No, wait for E5 (default; keeps one source of truth); or a single current-weight field now, replaced by the weight log in E5.                                                    |
| Q-E1-8 | One sprint or two?                                          | One sprint with everything (large; the plan lists it as a risk); or split: Sprint 3 athlete profile + manual baseline and zones, Sprint 4 guided test week + FTP from streams.        |

**Out of scope (later epics)**

- Plan generation, weekly view, adapting to missed sessions (E2).
- Compliance, power curve, fitness / fatigue / form, decoupling (E3).
- Weight and body composition (E5); FTP in W/kg waits for it.
- Time in zone per ride (E3), except what the zone table itself needs.

**Acceptance criteria (draft)**

- The PO can fill in and edit the athlete profile section by section; every field is optional and the
  rest of the app works with an empty profile.
- The PO can see and update a current FTP and heart rate baseline; the old values stay in the history.
- The app suggests an FTP from existing rides with power, names the ride it came from and changes nothing
  until the PO confirms.
- A guided test week can be followed step by step, and its result becomes a baseline entry.
- Power and heart rate zones show ranges in W and bpm and follow Coggan 7 (power) and 5 (heart rate) zones.
- The history lists every baseline with its date, source and zones.
- Rides without power or heart rate never break the page; a user with no power data sees a clear empty
  state with the manual route.
- Phone and desktop, light and dark, WCAG 2.2 AA, no horizontal scrolling on the phone.

**Risks**

- Size: the profile, the baseline and the guided test week together are a lot for one week-sized sprint.
  If the PO answers Q-E1-8 with the split, this sprint keeps items 1–6 and 9–12 with manual FTP entry, and
  the guided test week and the stream estimate (items 7 and 8) move to Sprint 4.
- Little power history (P5): the suggestion can be empty or wrong for sprint-like rides; show the source
  ride so the PO can judge.
- Streams are gzip JSON per ride in Storage (T13): reading many rides in the browser can be slow, so the
  best-effort search should run on the newest rides with power first, or in a database function.
- FTP from a 20-minute effort is an estimate; label it as such.

## Later

Product

- Weather per ride: temperature, wind speed and direction (P19).
- Extra Strava tags beyond commute and indoor, once export v2 has them (P11, Q1).
- Per-second streams (power, HR, cadence) for E1 and E3, stored in Supabase Storage (T6, Q1).

Platform

- Visual polish pass once more screens exist.

## Dropped

- Detecting rides deleted in Strava from complete exports (PO, C-PO4 follow-up, 16 Oct 2026; P15).
- Offline mode (PO, B-PO5).
- Passkeys / Face ID (PO, A-PO3).
