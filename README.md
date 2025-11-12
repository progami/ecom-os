# Ecom OS Monorepo

Ecom OS is a single pnpm + Turborepo workspace that hosts every customer-facing app. All apps live under `apps/` and share utilities under `packages/` (auth helpers, the design theme, configuration, etc.).

## Apps & Ports

| App | Path / Package | Default Port | Status | Hosted URL |
| --- | --- | --- | --- | --- |
| Portal / Navigation Hub | `apps/ecomos` (`@ecom-os/ecomos`) | 3000 | Production | `https://ecomos.targonglobal.com` |
| Warehouse Management | `apps/wms` (`@ecom-os/wms`) | 3001 | Production | `https://ecomos.targonglobal.com/wms` |
| Finance Console (Bookkeeping) | `apps/fcc` (`@ecom-os/fcc`) | 3003 | Development | `https://ecomos.targonglobal.com/fcc` |
| HRMS | `apps/hrms` (`@ecom-os/hrms`) | 3006 | Development | `https://ecomos.targonglobal.com/hrms` |
| Legal Suite | Portal route (`/legal`) | 3015 | Development | — |
| Marketing Website | `apps/website` (`@ecom-os/website`) | 3005 | Production | `https://www.targonglobal.com` |
| Margin Master | `apps/margin-master` (`@ecom-os/margin-master`) | 3400 | Archive | `https://ecomos.targonglobal.com/margin-master` |
| Jason (AI assistant) | `apps/jason` (`@ecom-os/jason`) | 3001 when run alone | Archive | `https://ecomos.targonglobal.com/jason` |
| X‑Plan | `apps/x-plan` (`@ecom-os/x-plan`) | 3008 | Production | `https://ecomos.targonglobal.com/x-plan` |

### App Categories

- **Production** (actively deployed): Portal (`apps/ecomos`), WMS (`apps/wms`), Website (`apps/website`), X‑Plan (`apps/x-plan`).
- **Development** (work in progress): HRMS (`apps/hrms`), Finance Console (`apps/fcc`), Legal Suite (portal module).
- **Archive** (kept for reference only): Margin Master (`apps/margin-master`), Jason assistant (`apps/jason`).

Only the Production + Development apps participate in CI/builds; archived apps stay in the repo for historical context but are excluded from day-to-day work.

We reserve ports in 20-port blocks so that future services slot in without conflicts (3000‑3019 for core apps, 3020‑3039 for finance, etc.). Margin Master keeps its historic 3400 assignment.

## Shared Packages

Everything under `packages/` is built so apps never re‑implement the same glue:

- `@ecom-os/auth` – shared NextAuth config, cookie helpers, `hasPortalSession`, etc.
- `@ecom-os/theme` – brand tokens, Tailwind extensions, spacing/radii definitions.
- Future shared libraries (logger, config, UI) all belong here so consumers just `pnpm add @ecom-os/<pkg>`.

## Tech Stack Snapshot

- Next.js 15 / React 19 for all frontends.
- pnpm workspaces + Turborepo for builds (`turbo.json` describes build/test/lint/type-check tasks).
- TypeScript everywhere (`tsconfig.base.json` holds shared paths).
- Prisma ORM + PostgreSQL (single cluster, multi-schema) for data; Tailwind CSS + Radix UI for design.
- PM2 + nginx on the EC2 host; GitHub Actions handles CI (`.github/workflows/ci.yml`).

## Database & Migrations

One RDS Postgres cluster (`portal_db`) backs every environment. Each app owns its own schema per environment:

| App | Prod Schema | Dev Schema | Notes |
| --- | --- | --- | --- |
| Portal / Auth | `auth_prod` | `auth_dev` | NextAuth tables + directory |
| WMS | `wms_prod` | `wms_dev` | Immutable inventory + cost ledgers |
| X‑Plan | `xplan_prod` | `xplan_dev` | Planning tables + workbook metadata |
| Website / FCC / others | `website_prod` | `website_dev` | Create per feature |

Rules of the road:
- Every `DATABASE_URL` must pair with `PRISMA_SCHEMA` (the Prisma client now merges them so NextAuth, `pg` pools, etc. stay aligned).
- Dev migrations: `pnpm --filter <app> prisma migrate dev`.
- Prod migrations: `pnpm --filter <app> prisma migrate deploy`.
- Never drop prod schemas; in dev you can `DROP SCHEMA <name> CASCADE` to reset safely.

CI and DB tunnels:
- `.github/workflows/ci.yml` copies `.env.dev.ci` for each app; keep those templates current so CI and Codespaces have the same schema names you expect locally.
- `./scripts/open-db-tunnel.sh` opens `localhost:6543 → ecomos-prod…:5432` so Prisma/psql connect to the shared DB without exposing RDS publicly.

## Auth & Local Dev

- Portal (`apps/ecomos`) is the source of truth for NextAuth cookies. Run it with `PORTAL_APPS_CONFIG=dev.local.apps.json pnpm --filter @ecom-os/ecomos dev` so the tiles link to your localhost apps.
- Every app shares `PORTAL_AUTH_SECRET` / `NEXTAUTH_SECRET`. Matching these secrets between the portal and a child app lets `hasPortalSession` decode cookies locally instead of hitting the remote `/api/auth/session`.
- WMS/X‑Plan guard every route. If you’re prototyping and don’t care about auth, set `BYPASS_AUTH=true` (and `NEXT_PUBLIC_BYPASS_AUTH=true`) in the app’s `.env.local`.
- Common “local 404” pitfall: you opened `http://localhost:3001` (WMS) without running the portal. The middleware sees no session and hard-404s protected routes.

### Running the main apps

```bash
# Portal
PORTAL_APPS_CONFIG=dev.local.apps.json pnpm --filter @ecom-os/ecomos dev

# Warehouse Management (needs portal cookies or BYPASS_AUTH)
pnpm --filter @ecom-os/wms dev

# Finance Console / Bookkeeping
pnpm --filter @ecom-os/fcc dev

# X‑Plan
pnpm --filter @ecom-os/x-plan dev
```

For prod-style builds use `pnpm --filter <app> build` followed by `pnpm --filter <app> start` with the right env file.

## Branching & Releases

1. `git checkout dev && git pull origin dev` before starting work.
2. Branch as `app-name/feature-name` (e.g. `wms/inline-sku-modal`).
3. Build locally (`pnpm lint && pnpm typecheck && pnpm format`) before pushing.
4. Open a PR into `dev`. CI (lint, type-check, build) must stay green; the PR auto-squashes into `dev` and deletes the remote branch when checks pass.
5. Release to `main` only via a deliberate PR after testing.
6. Keep your local branch list clean (`git branch -d <branch>` after merge).

Versioning stays centralized: bump root `package.json` and, if needed, run `node scripts/sync-versions.js` to propagate the version to app packages. `--check` mode verifies nothing drifted.

## UI / Style Baseline

- Always import brand tokens from `@ecom-os/theme` (`brandColors`, `brandFontFamilies`, `brandRadii`). Don’t paste hex codes or fonts.
- Tailwind already exposes helpers like `bg-brand-primary`, `text-brand-accent`, `font-brand` – use them.
- Shared component patterns (cards, CTAs, inputs) should follow the gradient + glassmorphism examples in `@ecom-os/theme` docs. Stick to `transition-all duration-300`, `rounded-3xl`, etc. for consistent motion.
- Dark theme hierarchy: `bg-slate-900` (base) → `bg-slate-800/50` (cards) → `bg-slate-700/50` (popovers). Text colors: white (primary), `text-gray-300` (secondary), `text-gray-500` (disabled).

## Troubleshooting Dev Auth

- Missing cookies? Check the browser dev tools – you should see `__Secure-next-auth.session-token` scoped to `localhost` when running the portal locally.
- “Portal session probe failed” logs usually mean `PORTAL_AUTH_URL` points at a host you’re not running. Update `.env.local` to `http://localhost:3000` during dev.
- WMS 404 on `/operations/receive` happens when the auth check fails – run the portal or flip `BYPASS_AUTH` for local testing.

## Getting Started Checklist

1. **Install deps** – Node.js 20+, `corepack enable`, `pnpm install`.
2. **Open DB tunnel** – `./scripts/open-db-tunnel.sh` (optional if you use local DBs).
3. **Copy envs** – each app has `.env.example` / `.env.dev.ci`. Fill secrets, especially `DATABASE_URL`, `PORTAL_AUTH_SECRET`, `NEXTAUTH_SECRET`.
4. **Run apps** – use the commands above or `pnpm dev` to start everything through Turborepo (useful when you want multiple apps with shared caching).
5. **Deploy helpers** – `pnpm deploy:metadata` rewrites nginx `X-Deploy-*` headers and purges Cloudflare (requires the CF token on the EC2 box).

## Scripts Worth Knowing

| Script | Purpose |
| --- | --- |
| `scripts/open-db-tunnel.sh` | Background SSH tunnel to RDS on `localhost:6543`. Automatically kills stale listeners. |
| `scripts/update-deploy-metadata.sh` | Rewrites `/etc/nginx/conf.d/deploy-headers.conf` with the latest dev/prod commits, reloads nginx, and purges Cloudflare. Invoked via `pnpm deploy:metadata`. |
| `scripts/sync-versions.js` | Keeps app package versions aligned with the root version (supports `--check` and `--bump`). |

That’s the whole picture – no extra scattered docs. If something feels missing, add it here so new teammates can grok the repo in one read.
