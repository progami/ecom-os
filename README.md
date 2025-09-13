# Ecom OS Monorepo

This repository hosts the Ecom Operating System monorepo with these apps:

- HRMS (`apps/hrms`, package `@ecom-os/hrms`)
- WMS (`apps/wms`, package `@ecom-os/wms`)
- FCC (`apps/fcc`, package `@ecom-os/fcc`)
- Website (`apps/website`, package `@ecom-os/website`)
- Central DB (`apps/central-db`, package `@ecom-os/central-db`)
- Margin Master (`apps/margin-master`, package `@ecom-os/margin-master`)
- Jason (`apps/jason`, package `@ecom-os/jason`)
- YE 2024 (`apps/ye-2024`, package `@ecom-os/ye-2024`) – experimental/non-production data and dashboards

We use pnpm workspaces and Turborepo. All apps live under `apps/` and shared code under `packages/`.

## Structure

- `pnpm-workspace.yaml` – declares workspaces for `apps/*` and `packages/*`
- `turbo.json` – build/test/dev pipeline
- `tsconfig.base.json` – shared TS config + path aliases
- `apps/website` – company website (moved from `master/`)
- `packages/` – shared libraries (config, logger; more to come: ui, theme, utils)
- `docs/` – shared guidelines (architecture, style, shared workflows)

## App Status

- Active (production/CI deploy wired)
  - @ecom-os/website (`apps/website`) – www.targonglobal.com
  - @ecom-os/wms (`apps/wms`) – wms.targonglobal.com
- Pre-release (wiring CI + envs)
  - @ecom-os/hrms (`apps/hrms`) – hrms.targonglobal.com
  - @ecom-os/fcc (`apps/fcc`) – fcc.targonglobal.com
- In development (not released)
  - @ecom-os/central-db (`apps/central-db`) – centraldb.targonglobal.com
  - @ecom-os/margin-master (`apps/margin-master`) – mm.targonglobal.com
  - @ecom-os/jason (`apps/jason`) – jason.targonglobal.com
- Experimental (non-production)
  - E2 (`apps/e2`)
  - YE 2024 (`apps/ye-2024`)

Notes
- Production deploys run on push to `main` via `.github/workflows/deploy-prod.yml`.
- Per-app env is templated from GitHub Secrets: `WEBSITE_ENV`, `WMS_ENV`, `HRMS_ENV`, `FCC_ENV`, `CENTRAL_DB_ENV`, `MARGIN_MASTER_ENV`, `JASON_ENV`.

## Getting started

1) Install tooling (local):

- Node.js 20+
- pnpm 9+: `npm i -g pnpm`

2) Install dependencies (once ready to run locally):

```bash
pnpm install
```

3) Run all apps in dev:

```bash
pnpm dev
```

Or per app:

```bash
pnpm --filter @ecom-os/hrms dev
pnpm --filter @ecom-os/wms dev
pnpm --filter @ecom-os/fcc dev
pnpm --filter @ecom-os/website dev
```

## Next steps (routing & auth unification)

- Define shared auth contract in `packages/auth` (NextAuth options, cookie `Domain=.targonglobal.com`).
- Configure each app to use the shared auth and unified session cookie for SSO across subdomains.
- Add `packages/ui` + `packages/theme` for shared UI/UX components and tokens.
- Generate typed API clients into `packages/api-client`.

> Note: We are not pushing to EC2 until everything runs locally. Docker is not required for this phase.

## Notes

- Apps currently use different Next.js versions; pnpm will isolate versions per workspace. We can align later.
 - Monorepo structure is canonical; apps have been moved into `apps/`.

## Workflow Policy

- Branches: active development on `dev`; production on `main`.
- CI: runs on pull requests to `dev` and `main` only; duplicate push builds are avoided.
- Required checks: `build-test` and `GitGuardian Security Checks` must pass before merge.
- Reviews: no approval required (single-collaborator repo); merges happen via PR with green checks.
- CD: deploys on push to `main` via `.github/workflows/deploy-prod.yml`.
- Housekeeping: `apps/e2` removed; personal notes under `Pers/` are ignored by Git and not tracked.
