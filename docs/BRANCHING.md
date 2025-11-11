# Branching Cheat Sheet

## Branches
- `main`: production, protected, only merge via PR from `dev`
- `dev`: integration branch, push allowed
- feature branches: use `work/*`, `feat/*`, or `fix/*` off `dev`

## Workflow
1. Run tests/CI locally (`pnpm lint`, `pnpm typecheck`, etc.).
2. Push commits to your remote branch (e.g., `origin/work/website` or `origin/dev`).
3. Open PR from your branch → `dev` (skip if already on `dev`).
4. Wait for CI to pass; fix failures before merging.
5. Merge `dev` → `main`, wait for CI, create release, trigger CD.
6. Wait for CD to complete; verify deploy.
7. Sync `dev` from `main` so both point to the same commit.

If any step fails, stop and fix before moving forward. Keep history linear (use rebase or squash).
