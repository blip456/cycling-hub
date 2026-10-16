# Contributing

Setup, scripts, environments and the release flow are in the [README](README.md). This file is about
the rules for changes.

## Before you start

- Read [`docs/decisions.md`](docs/decisions.md) and the current sprint in
  [`docs/backlog.md`](docs/backlog.md). When a change contradicts a decision, add a new decision row
  instead of quietly deviating.
- A screen is built only after its wireframe and design are approved (D2).

## Branches

Branch from `dev` (not `main`) and name the branch `<type>/<description>`:

| Type        | Use for                                       | PR title type    |
| ----------- | --------------------------------------------- | ---------------- |
| `feat/`     | a new user-facing feature                     | `feat`           |
| `fix/`      | a bug fix                                     | `fix`            |
| `hotfix/`   | an urgent fix between sprints (patch release) | `fix`            |
| `chore/`    | tooling, dependencies, housekeeping           | `chore`, `build` |
| `docs/`     | documentation only                            | `docs`           |
| `refactor/` | code changes without behaviour change         | `refactor`       |
| `test/`     | tests only                                    | `test`           |
| `ci/`       | CI/CD workflows                               | `ci`             |

The description is lower case `a-z` and `0-9`, words joined by single hyphens: `feat/ride-list`,
`fix/import-timezone`. Rename a branch with `git branch -m <type>/<description>`. The pre-push hook and
the `Branch name` CI check run `scripts/branch-name.mjs`.

## Commit messages and PR titles

[Conventional Commits](https://www.conventionalcommits.org). They drive the version number and the
changelog the app shows in What's new, so write them for someone reading that changelog.

```
<type>(<optional scope>): <what changed, lower case, imperative>
```

| Type                                                        | Changelog section | Version bump (before 1.0) |
| ----------------------------------------------------------- | ----------------- | ------------------------- |
| `feat`                                                      | Features          | minor                     |
| `fix`                                                       | Bug Fixes         | patch                     |
| `perf`                                                      | Performance       | patch                     |
| `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style` | Technical         | none                      |

- Scopes (optional): `app`, `auth`, `import`, `rides`, `settings`, `design`, `db`, `ci`, `deps`,
  `docs`, `release` (`commitlint.config.js`).
- Breaking change: `feat!: …` or a `BREAKING CHANGE:` footer. Before 1.0 it bumps the minor version.
- Hotfixes use `fix:`; a `feat:` would take the next sprint's version number.
- The `commit-msg` hook checks every commit locally; CI checks every commit in the PR and the PR title.

## Pull requests

- PR into `dev`, fill in the template, keep it small. CI must be green; check the Vercel preview.
- Work branches are **squash-merged** into `dev`; the PR title becomes the commit and the changelog line.
- `dev` → `main` and the back-merge `main` → `dev` use a **merge commit**. The release PR is squash-merged.

## Code

- TypeScript strict; no `any`, no non-null assertions outside tests. ESLint and Prettier decide style.
- Tests next to the code (`*.test.ts(x)`), with Vitest and Testing Library. Query by role and label.
- Only the Supabase URL and publishable key go into the client (`VITE_*`). No secrets in the repo, the
  PR or screenshots.

## UI and accessibility (WCAG 2.2 AA)

- Every input has a visible label above it; helper text and errors below, linked with
  `aria-describedby`.
- Never put example values in inputs or placeholders.
- No eyebrow text (small labels above headings), few pills, no glow or halo effects.
- Colour contrast at least 4.5:1 for text, 3:1 for UI parts; everything works with the keyboard and a
  screen reader; respect `prefers-reduced-motion`.

## Database

- Every schema change is a migration (`pnpm exec supabase migration new <name>`), additive first.
- Every table: RLS on, policies scoped to `auth.uid()`, explicit grants, pgTAP tests in
  `supabase/tests/`.
- Run `pnpm db:reset && pnpm db:lint && pnpm db:test`, then `pnpm db:types`, and commit the types.
