# Decisions log

Decisions made during the project kickoff (15 Oct 2026) and later review rounds. Each entry records what
we chose, the alternatives considered and why. **Add a new entry instead of rewriting an old one** when a
decision changes, and say which entry it refines or supersedes ("refines T3", "supersedes D4"). Every
later document (wireframes, backlog, code comments, PRs) refers to these IDs.

## Open questions

Questions asked but not answered yet (a row is removed once it becomes a decision below):

| #   | Question                                                                                     | Asked       | Options / notes                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | When does the Chrome extension start exporting power, heart rate, data streams and real UTC times (export format v2)? | 15 Oct 2026 | (a) agree the v2 format now, build Sprint 1 for v1 and v2, extend the extension in parallel · (b) extension first, then Sprint 1 · (c) Sprint 1 on v1 only |
| Q2  | Wireframes V1 feedback (41 open questions in `docs/wireframes/V1/`).                         | 15 Oct 2026 | PO reviews when back home.                                                                                                                              |

## Product

| #   | Topic                 | Decision                                                                                                                                                                                       | Notes / alternatives                                                                                                                             |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Product               | **A personal, mobile-first cycling training hub** with a general-fitness mode (default) and an event mode, anchored to real ride data. One user: the PO.                                       | Kickoff brief. Out of scope: medical data, multi-user, Strava API, printable/PDF plans.                                                          |
| P2  | Data source           | **Rides come from a JSON file exported by the PO's own Chrome extension**, dropped into the app by hand. The extension never talks to Supabase.                                                | Strava API not available.                                                                                                                        |
| P3  | Import batch size     | **One-time backfill of about 2 years**, then **the last 5 activities per file** for regular imports (covers at least two weeks of riding).                                                     | Suggested default was 10. Duplicates are handled by upsert on the Strava ID, so overlapping files are harmless.                                 |
| P4  | Activity types        | **Import every cycling type** (road ride, mountain bike, gravel, e-bike, virtual/indoor and any other Strava cycling type). Other sports (hike, walk, run, …) are counted as "not a ride" and ignored. | 15 Oct 2026. Alternative "store everything, show only rides" rejected to keep the data simple.                                                   |
| P5  | Data quality          | **Most of the 2-year history has no power or heart rate**; roughly the last 6 months have both (power meter + HR strap). Every field beyond distance/time/elevation is optional per ride.       | 15 Oct 2026. Analytics in E1/E3 use only rides that have the data.                                                                               |
| P6  | Units and locale      | **English UI, metric units (km, km/h, W, bpm), Europe/Brussels time zone, light/dark mode following the system.**                                                                              | 15 Oct 2026.                                                                                                                                     |

## Authentication

| #   | Topic        | Decision                                                                                                                    | Notes                                                                                                                                     |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Sign-in      | **Email + password.** One account, created by the PO in the Supabase dashboard. Public sign-ups disabled.                    | 15 Oct 2026. Magic links rejected: in an installed iOS PWA the link opens in Safari, so the session doesn't reach the app.                 |
| A2  | Data access  | **Row Level Security on every table, scoped to `auth.uid()`.**                                                              | Kickoff brief.                                                                                                                            |

## Technical

| #   | Topic            | Decision                                                                                                                                                                       | Alternatives considered                                                                                                    |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| T1  | Frontend         | **Vite + React + TypeScript (strict), client-rendered SPA, installable PWA.** React Router, TanStack Query, Zod, Tailwind v4, vite-plugin-pwa, Vitest + Testing Library, pnpm, Node 22. | Next.js (the bootstrap skill's default) rejected by the PO: single user, chart-heavy, must feel snappy, no SSR needed.     |
| T2  | Backend          | **Supabase** (Auth, Postgres, RLS). Migrations in `supabase/migrations` via the Supabase CLI; no manual schema changes.                                                         | Custom server only if a later sprint needs one (e.g. an Edge Function).                                                    |
| T3  | Environments     | **Two free Supabase projects: `cycling-hub-dev` (dev + previews) and `cycling-hub-prod` (production).**                                                                         | 15 Oct 2026. Supabase branching rejected: needs the Pro plan and adds moving parts. Known cost: free projects pause after ~7 days idle. |
| T4  | Hosting          | **Vercel**: production from `main` only, previews for `dev` and every other branch.                                                                                            | Kickoff brief.                                                                                                             |
| T5  | Ride timestamps  | **`startDateLocal` is read as Brussels wall-clock time**; its trailing `Z` is wrong (the value is local, not UTC), and `startEpoch` has the same offset.                          | 15 Oct 2026, from the sample file. A true UTC field in export v2 would replace this (Q1).                                  |
| T6  | Raw data         | **The raw JSON of every activity is stored next to the normalised fields**, so later sprints can extract more without re-importing. Large per-second streams go to Supabase Storage, not the database. | Streams depend on Q1.                                                                                                      |

## Delivery

| #   | Topic              | Decision                                                                                                                                                                     |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Way of working     | **Dual-track agile**: an epic-level roadmap (discovery) and one-week sprints (delivery); only the next sprint is planned in detail. No sprint starts without the PO's go.     |
| D2  | Wireframes         | **Wireframes before building**, stored in `docs/wireframes/V1/` (then V2, …). A screen is built only after its wireframe is approved.                                        |
| D3  | Planning documents | **`docs/decisions.md`** (this file) and **`docs/backlog.md`** (roadmap epics + sprint planning + later ideas) are the shared memory. `docs/backlog.md` is also the source of the in-app "What's next". 15 Oct 2026. |
| D4  | Git flow           | **`main` (production) and `dev` (integration)**, both protected. Work branch → PR into `dev` → test on the `dev` preview → PR `dev` → `main`. Branch prefixes `feat/ fix/ hotfix/ chore/ docs/ refactor/ test/ ci/`, kebab-case. |
| D5  | Versions           | **Conventional Commits + semantic versioning, automated with release-please**, starting at v0.1.0; changelog and tags generated. Proposed at kickoff (semantic-release rejected: it pushes straight to protected `main`); confirm when approving the backlog. Shown in the app with "What's new" and "What's next". |
