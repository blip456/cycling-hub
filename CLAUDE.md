# Cycling Hub: rules for AI agents

A single-user PWA: Vite + React + TypeScript (strict) SPA, Supabase (Auth, Postgres, RLS), Vercel,
pnpm 10, Node 22. Setup and flows: [README.md](README.md). Rules for changes:
[CONTRIBUTING.md](CONTRIBUTING.md).

## Read first

- [`docs/decisions.md`](docs/decisions.md) before changing architecture, flows or UI patterns. When a
  decision changes, add a row; don't let decisions live only in PR descriptions.
- [`docs/backlog.md`](docs/backlog.md) for the current sprint and its acceptance criteria. Keep the
  `## vX.Y.Z — Title` / `Sprint:` / `Status:` / `Tagline:` format intact: the What's next page is
  generated from it and the build fails when it breaks.
- Build screens only from approved wireframes and designs (`docs/wireframes/`, `docs/design/`). When the
  brief and the approved design differ, follow the design and tell the PO.

## Git

- Branch from `dev`: `<type>/<kebab-case>` with type `feat fix hotfix chore docs refactor test ci`
  (`scripts/branch-name.mjs`). In a Claude Code session the suggested `claude/*` branch is allowed.
- Conventional Commits, scopes from `commitlint.config.js`; the PR title is the changelog line.
- Never push to `main` or `dev`, never force-push shared branches, never merge release PRs or mark a
  sprint done: that is the PO's call after testing.
- Before pushing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
- Git hooks live in the shared `.git/hooks`. Agents working in `.claude/worktrees/` should not run
  `lefthook install` for the main checkout; run the checks above by hand instead.

## Secrets

- No secrets in the repo, commits, PRs, logs or chat. Only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` reach the client. Never ask the PO to paste keys or passwords into the
  conversation; point to the settings screen in `docs/setup-production.md`.

## Supabase

- Schema changes only through migrations in `supabase/migrations`, additive first.
- Every table: RLS on, policies scoped to `auth.uid()`, explicit grants, pgTAP tests. Regenerate types
  with `pnpm db:types`.
- Sign-ups are off; there is one user, created in the dashboard.

## UI and accessibility (WCAG 2.2 AA)

- Visible labels above every input; helper text and errors below, wired with `aria-describedby`.
- Never put example values in inputs or placeholders.
- No eyebrow text above headings. Use pills sparingly. No glows, halos or decorative shadows.
- Contrast 4.5:1 for text, 3:1 for UI parts; full keyboard and screen reader support; respect
  `prefers-reduced-motion`. Status messages are cards at the bottom of the page (P12).
