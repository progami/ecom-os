# Ecom OS Monorepo

This repository hosts the Ecom Operating System monorepo with these apps:

- HRMS (`apps/hrms`, package `@ecom-os/hrms`)
- WMS (`apps/wms`, package `@ecom-os/wms`)
- FCC (`apps/fcc`, package `@ecom-os/fcc`)
- Website (`apps/website`, package `@ecom-os/website`)
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
  - @ecom-os/wms (`apps/wms`) – ecomos.targonglobal.com/wms
- Pre-release (wiring CI + envs)
  - @ecom-os/hrms (`apps/hrms`) – ecomos.targonglobal.com/hrms
  - @ecom-os/fcc (`apps/fcc`) – ecomos.targonglobal.com/fcc
- In development (not released)
  - @ecom-os/margin-master (`apps/margin-master`) – ecomos.targonglobal.com/margin-master
  - @ecom-os/jason (`apps/jason`) – ecomos.targonglobal.com/jason
- Experimental (non-production)
  - E2 (`apps/e2`)
  - YE 2024 (`apps/ye-2024`)

Notes
- Production deploys run on push to `main` via `.github/workflows/deploy-prod.yml`.
- Per-app env is templated from GitHub Secrets: `WEBSITE_ENV`, `WMS_ENV`, `HRMS_ENV`, `FCC_ENV`, `PORTAL_DB_ENV`, `MARGIN_MASTER_ENV`, `JASON_ENV`.

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

### Dev Utilities

- `pnpm refresh:wms-dev`
- `pnpm refresh:ecomos-dev`
- `pnpm refresh:website-dev`
- `pnpm refresh:xplan-dev`
- `pnpm deploy:metadata`
- `scripts/open-db-tunnel.sh` – opens `localhost:6543` → Postgres tunnel via the `ecomos` SSH host (kills any stale listener first). Use before running Prisma/psql locally.

Each command stops the corresponding PM2 dev process, clears Next/Turbopack caches, and restarts the app with a clean build to avoid serving stale bundles.

`pnpm deploy:metadata` runs `scripts/update-deploy-metadata.sh`, which rewrites the shared nginx deploy headers with the latest dev/prod commits, reloads nginx, and purges the Cloudflare zone (token required on the box). Use it right after pulling to EC2 so browsers see fresh bundles immediately.

## Next steps (routing & auth unification)

- Define shared auth contract in `packages/auth` (NextAuth options, cookie `Domain=.targonglobal.com`).
- Configure each app to use the shared auth and unified session cookie for SSO across subdomains.
- Add `packages/ui` + `packages/theme` for shared UI/UX components and tokens.
- Generate typed API clients into `packages/api-client`.

> Note: We are not pushing to EC2 until everything runs locally. Docker is not required for this phase.

## Notes

- Apps currently use different Next.js versions; pnpm will isolate versions per workspace. We can align later.
 - Monorepo structure is canonical; apps have been moved into `apps/`.
