## What

<!-- What changes for the user (or for the codebase). Link the backlog item or decision, e.g. v0.1.0 item 9, A3. -->

## Why

<!-- The reason for the change. -->

## How to test

<!-- Steps on the preview URL, on phone and desktop where it matters. -->

1.

## Checklist

- [ ] The PR title is a Conventional Commit (`feat(rides): add ride list`); it becomes the changelog line.
- [ ] `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` pass locally.
- [ ] Tests added or updated for the change.
- [ ] Contains a database migration? If yes: it is additive, has RLS + grants and pgTAP tests, and `pnpm db:types` is re-run.
- [ ] UI: visible labels on inputs, no example values in inputs, keyboard and screen reader checked, contrast meets WCAG 2.2 AA.
- [ ] `docs/decisions.md` / `docs/backlog.md` updated if a decision or the plan changed.
- [ ] No secrets, keys or personal data in the code, the PR or the screenshots.
