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

Sequence and dependencies matter; dates don't.

| #   | Epic                                   | Outcome                                                                                                                                  | Sprints     | Open discovery questions                                                                                          |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| E0  | **Foundation, import & rides**         | Design system, repo + standards + CI/CD, login, import with history, settings + release pages, ride list and ride detail.               | S0, S1, S2  | Export format v2 and its timing (Q1). Weather source (P19). Export format for "export rides".                    |
| E1  | **Baseline & zones**                   | Athlete profile, guided FTP test week, power and HR zones from the test, zone history.                                                  | —           | Test protocol (20-min, ramp)? Zone models? Manual test entry or automatic from streams (needs export v2 streams)? |
| E2  | **Training plan — general fitness**    | Periodized plan (base / build / peak) around Wed / Sun / optional ride, weekly view, session detail with watt and HR targets.           | —           | Rule-based, Claude API or hybrid? How does the plan adapt to missed sessions?                                    |
| E3  | **Plan vs actual & progress**          | Match rides to sessions, compliance, trends: FTP estimate, power curve, efficiency factor, aerobic decoupling, fitness / fatigue / form. | —           | Which metrics are reliable from the export? Most history has no power or HR (P5).                                 |
| E4  | **Event mode**                         | Event with date, distance, elevation, goal; plan built backwards, taper, pacing and fueling targets.                                    | —           | Do event mode and general mode coexist?                                                                           |
| E5  | **Body composition**                   | Weight log and trend, linked to training load.                                                                                          | —           | Manual entry or smart-scale import?                                                                               |
| E6  | **Nutrition**                          | Food logging, ride-day vs rest-day targets, daily meal plans.                                                                           | —           | Food database source? Acceptable logging effort?                                                                  |

Out of scope: medical data, multi-user, Strava API, printable/PDF plans.

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
Status: planned
Tagline: Drop your Strava export file and see exactly what was imported, plus settings, What's new and What's next.

### Details

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
7. Import history: list of past imports with date, file name and counts.
8. Settings (G1): account email, theme switch System / Light / Dark (P9), units and time zone (info),
   version, links to What's new and What's next, sign out.
9. What's new (G2): changelog generated at build time from `CHANGELOG.md`, release-please link
   suffixes stripped, pills Feature / Fix / Technical (P18). Bottom card banner after an update (B1d,
   P12); dismissing it or opening the page stores the version in `profiles.last_seen_version`.
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
Status: planned
Tagline: All your rides by week or month, with the details of every ride.

### Details

Draft; planned in detail at the end of Sprint 1.

- Ride list: cards on the phone (B1a), dense table on desktop (X1); newest first; metric order
  distance, moving time, average speed, average power, average HR, elevation; "—" when missing
  (P10, P11).
- Week and month view with totals; filter to hide commutes; tags (MTB, commute, indoor, …) (P11).
- Empty, loading and error states (B2, B3); error as a bottom card (P12).
- Ride detail page (to be wireframed and designed): all stored fields, route map from the polyline.
- Delete a ride in the app; a deleted ride is skipped on later imports, with a way to undo (P15).
- Export rides (format to decide: CSV and/or JSON).
- Discovery: weather per ride (P19); export format v2 for power, HR and tags (Q1).

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
