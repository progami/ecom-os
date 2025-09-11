# Ecom OS Monorepo

This repository hosts the Ecom Operating System monorepo with four apps:

- HRMS (`apps/hrms`, package `@ecom-os/hrms`)
- WMS (`apps/wms`, package `@ecom-os/wms`)
- FCC (`apps/fcc`, package `@ecom-os/fcc`)
- Website (`apps/website`, package `@ecom-os/website`)
- Central DB (`apps/central-db`, package `@ecom-os/central-db`)
- Margin Master (`apps/margin-master`, package `@ecom-os/margin-master`)
- Jason (`apps/jason`, package `@ecom-os/jason`)
- E2 (`apps/e2`) – utilities and experiments; contains `calculations/` Next.js app
- YE 2024 (`apps/ye-2024`, package `@ecom-os/ye-2024`) – experimental/non-production data and dashboards

We use pnpm workspaces and Turborepo. All apps live under `apps/` and shared code under `packages/`.

## Structure

- `pnpm-workspace.yaml` – declares workspaces for `apps/*` and `packages/*`
- `turbo.json` – build/test/dev pipeline
- `tsconfig.base.json` – shared TS config + path aliases
- `apps/website` – company website (moved from `master/`)
- `packages/` – shared libraries (config, logger; more to come: ui, theme, utils)
- `docs/` – shared guidelines (architecture, style, shared workflows)

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
