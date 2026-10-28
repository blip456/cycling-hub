# Cycling Hub

A personal training app for one cyclist: import rides, see them in detail, and (later) plan training
around them. It is an installable web app (PWA) for phone and desktop with a single account.

The plan lives in [`docs/backlog.md`](docs/backlog.md) (roadmap and sprints) and the decisions in
[`docs/decisions.md`](docs/decisions.md). Conventions for people are in
[`CONTRIBUTING.md`](CONTRIBUTING.md), for AI agents in [`CLAUDE.md`](CLAUDE.md).

## Stack

| Layer    | Choice                                                                                   |
| -------- | ---------------------------------------------------------------------------------------- |
| Frontend | Vite, React, TypeScript (strict), client-rendered SPA, installable PWA (T1)              |
| Backend  | Supabase: Auth (email + password), Postgres with Row Level Security, CLI migrations (T2) |
| Hosting  | Vercel: production from `main`, previews for `dev` and every other branch (T4)           |
| Quality  | ESLint, Prettier, Vitest + Testing Library, pgTAP, commitlint, lefthook                  |
| Releases | Conventional Commits and release-please: version, `CHANGELOG.md`, tags, GitHub Releases  |
| Tools    | pnpm 10, Node 22 (`.nvmrc`), Docker for the local database                               |

## Setup

You need Node 22, pnpm 10 (`corepack enable` installs the version from `package.json`) and Docker
(Docker Desktop, OrbStack or Colima) for the local Supabase.

```sh
pnpm install
pnpm local:setup      # local Supabase in Docker + .env.local + a local login
pnpm dev              # http://localhost:5173
```

`pnpm local:setup` starts the local Supabase (`pnpm db:start`), waits until it is healthy, writes the
local URL and publishable key to `.env.local` and creates a local login (`rider@local.test` /
`local-password-only`; override with `LOCAL_USER_EMAIL` and `LOCAL_USER_PASSWORD`). Run it again after a
restart; it is safe to repeat. Password-reset emails land in the local inbox it prints. To start from an
empty database run `pnpm db:reset` and then `pnpm local:setup` again (the reset removes the user).

The local Supabase includes Storage (the private `streams` bucket for per-second ride data, T13). If
yours was started before Storage was added, run `pnpm db:stop` and then `pnpm local:setup` once.

Only the URL and the publishable key ever go into the app. Never commit `.env.local` or any key.

## Scripts

| Script             | What it does                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Start the dev server                                                                                                                |
| `pnpm build`       | Typecheck and build the production bundle into `dist/`                                                                              |
| `pnpm local:setup` | Local Supabase + `.env.local` + local login, ready for `pnpm dev`                                                                   |
| `pnpm preview`     | Serve the production build locally                                                                                                  |
| `pnpm lint`        | ESLint (`pnpm lint:fix` fixes what it can)                                                                                          |
| `pnpm format`      | Format everything with Prettier (`pnpm format:check` only checks)                                                                   |
| `pnpm typecheck`   | TypeScript, no output                                                                                                               |
| `pnpm test`        | Run the tests once (`pnpm test:watch` in watch mode)                                                                                |
| `pnpm coverage`    | Tests with a coverage report in `coverage/`                                                                                         |
| `pnpm db:start`    | Start the local Supabase (Docker), without the services the app does not use                                                        |
| `pnpm db:stop`     | Stop it                                                                                                                             |
| `pnpm db:reset`    | Recreate the local database from `supabase/migrations` (and the seed)                                                               |
| `pnpm db:lint`     | Lint the local database schema                                                                                                      |
| `pnpm db:test`     | Run the pgTAP tests in `supabase/tests`                                                                                             |
| `pnpm db:types`    | Regenerate `src/lib/supabase/database.types.ts` from the local database                                                             |
| `pnpm ext:build`   | Build the Strava export Chrome extension into `extension/dist` ([extension/README.md](extension/README.md); `pnpm ext:dev` watches) |

Before pushing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

## Environments

Two Supabase projects, no branching (T3). Previews share the dev database.

| Environment | Git branch                                  | Supabase project   | Vercel                |
| ----------- | ------------------------------------------- | ------------------ | --------------------- |
| Local       | any                                         | local, in Docker   | `pnpm dev`            |
| Dev         | `dev`, and every PR / work branch (preview) | `cycling-hub-dev`  | Preview deployments   |
| Production  | `main`, release commits only                | `cycling-hub-prod` | Production deployment |

Vercel's **Preview** environment variables point to `cycling-hub-dev`, **Production** to
`cycling-hub-prod`. The one-time setup of GitHub, Supabase and Vercel is a checklist for the PO in
[`docs/setup-production.md`](docs/setup-production.md).

## Git flow

`main` is production, `dev` is integration (D4). Both are protected by rulesets: no direct pushes, a
pull request with green CI is required.

1. Branch from `dev`: `git switch dev && git pull && git switch -c feat/ride-list`.
2. Commit with Conventional Commits; push; open a PR **into `dev`**.
3. CI must pass. Check the Vercel preview. **Squash merge**: the PR title becomes the commit on `dev`.
4. At the end of a sprint, after the PO has tested the `dev` preview: PR **`dev` → `main`**, merged with
   a **merge commit**.

**Branch names**: `<type>/<description>`, types `feat/ fix/ hotfix/ chore/ docs/ refactor/ test/ ci/`,
description in kebab-case (`feat/ride-list`, `fix/import-timezone`). `main`, `dev`, release-please's
branches and `claude/*` session branches are exempt. Checked by `scripts/branch-name.mjs` in the
pre-push hook and in CI.

**Commit messages and PR titles**: [Conventional Commits](https://www.conventionalcommits.org), e.g.
`feat(rides): add ride list`. Scopes are optional; allowed scopes are in `commitlint.config.js` (`app`,
`auth`, `import`, `rides`, `settings`, `design`, `db`, `ci`, `deps`, `docs`, `release`). Checked by the
commit-msg hook and in CI. Details in [`CONTRIBUTING.md`](CONTRIBUTING.md).

### CI checks

Every PR runs these jobs; they are the required status checks in `.github/rulesets/`:

| Check             | What it checks                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| `Lint and format` | ESLint (no warnings) and Prettier                                                 |
| `Typecheck`       | `tsc -b`                                                                          |
| `Test`            | Vitest with coverage                                                              |
| `Build`           | Production build                                                                  |
| `Branch name`     | The PR's branch name                                                              |
| `PR title`        | The PR title is a Conventional Commit (re-runs when the title is edited)          |
| `Commit messages` | Every commit in the PR is a Conventional Commit                                   |
| `Database`        | Only when `supabase/` changes: fresh local database, `db reset`, `db lint`, pgTAP |

## Releases

Versions follow the sprints (D5, D6): Sprint 0 ships v0.1.0, every next sprint the next minor.

1. Every push to `main` runs **release-please**. It keeps a PR **`chore(release): release X.Y.Z`** open
   with the version bump in `package.json` and the new `CHANGELOG.md` section (Features, Bug Fixes,
   Performance, Technical).
2. Merge the release PR with **squash** when the sprint is done. release-please then tags `vX.Y.Z` and
   publishes a GitHub Release.
3. Vercel deploys production **only for that release commit** (`scripts/vercel-ignore-build.sh`), so
   the version in the app always matches a release. Other pushes to `main` build nothing.
4. The **Back-merge** workflow opens a PR `main` → `dev` (`chore(release): back-merge vX.Y.Z into dev`).
   Merge it with a **merge commit** so `dev` gets the version bump and keeps `main`'s history.

### What's new and What's next in the app

Both pages are built from files in the repository at build time; the app never calls GitHub.
`scripts/build-release-data.mjs` reads `CHANGELOG.md` (written by release-please; no file yet means "No
releases yet") and the sprint sections of `docs/backlog.md`, and writes
`src/features/release/generated/{changelog,roadmap}.json`. Those files are **not committed**
(`.gitignore`): `pnpm dev`, `build`, `lint`, `typecheck`, `test` and `coverage` regenerate them first
(`pre*` scripts in `package.json`; by hand: `pnpm release-data`), so CI and Vercel always build from the
current changelog and backlog, and `pnpm dev` regenerates them when either file changes. A broken sprint
entry in the backlog fails the build with a list of what is wrong (see "Sprint format" in the backlog).

Hotfixes between sprints use `fix:` titles: before 1.0 a `feat:` bumps the minor version, which belongs
to the next sprint.

Release and back-merge PRs are opened by GitHub Actions. GitHub does not start CI for PRs opened with the
built-in token, so the required checks never report: either merge them with the admin bypass, or add the
optional `RELEASE_PLEASE_TOKEN` secret (see the setup checklist) so CI runs on them.

## Database migrations

Every schema change is a migration in `supabase/migrations`; nothing is changed by hand in a dashboard (T2).

1. `pnpm exec supabase migration new <name>` creates `supabase/migrations/<timestamp>_<name>.sql`.
2. Write it **additive** (add first, remove in a later release): Vercel deploys the app while the
   migration runs. Every table gets RLS scoped to `auth.uid()` and explicit grants (A2).
3. Add pgTAP tests in `supabase/tests/`. Run `pnpm db:reset && pnpm db:lint && pnpm db:test`, then
   `pnpm db:types` and commit the generated types.
4. Open the PR. CI labels it **`migration`**, comments that it contains one, and validates it against a
   fresh database.
5. Merging into `dev` applies the migration to `cycling-hub-dev` (**Database deploy** workflow,
   environment `dev`).
6. Merging `dev` into `main` applies it to `cycling-hub-prod` after the PO approves the deployment in the
   `production` environment (Actions → the waiting run → Review deployments → Approve).
