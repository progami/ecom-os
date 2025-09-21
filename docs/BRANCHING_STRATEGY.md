# Branching Strategy

The warehouse monorepo flows through `dev` for day-to-day work and promotes releases to `main` on demand. Pull requests into `dev` auto-merge as soon as CI succeeds, so developers only manage their local branches.

## Daily flow

1. **Sync local dev** – `git checkout dev && git pull origin dev` to start from a clean base.
2. **Create feature branch** – `git checkout -b app-name/feature-name` (example: `wms/unify-cost-rates`).
3. **Develop & commit** – run `pnpm lint`, `pnpm typecheck`, and `pnpm format` locally before pushing.
4. **Push branch** – `git push origin app-name/feature-name` kicks off CI on the PR.
5. **Pull request** – open `origin/app-name/feature-name → origin/dev`. GitHub Actions waits for CI, then merges and deletes the remote branch automatically when checks and approvals are satisfied.
6. **Resync after merge** – `git checkout dev && git pull origin dev` (the branch is already gone remotely) followed by `git branch -d app-name/feature-name` to tidy the local copy.

## Automation details

- `.github/workflows/ci.yml` runs lint, type-check, and build for both website and WMS on every PR targeting `dev` or `main`.
- The same workflow hosts an `auto-merge-dev` job that listens for successful `dev` PR runs, performs a squash merge, and drops the corresponding remote branch. Fork-based contributions skip the delete step for safety.
- Release branches still merge into `main` manually via dedicated PRs, preserving human control over production deploys.
