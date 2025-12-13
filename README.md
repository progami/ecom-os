# Ecom OS Monorepo

Ecom OS is a single pnpm + Turborepo workspace that hosts every customer-facing app. All apps live under `apps/` and share utilities under `packages/` (auth helpers, the design theme, configuration, etc.).

## Apps & Environments

| App | Package | Main Port | Dev Port | Status |
| --- | --- | --- | --- | --- |
| Portal / Navigation Hub | `apps/ecomos` | 3000 | 3100 | Active |
| Warehouse Management | `apps/wms` | 3001 | 3101 | Active |
| Marketing Website | `apps/website` | 3005 | 3105 | Active |
| HRMS | `apps/hrms` | 3006 | 3106 | Development |
| X-Plan | `apps/x-plan` | 3008 | 3108 | Active |
| Finance Console | `apps/archived/fcc` | — | — | Archived |
| Margin Master | `apps/archived/margin-master` | — | — | Archived |
| Jason (AI assistant) | `apps/jason` | — | — | Archived |

### Hosted URLs

| Environment | Portal URL | Branch |
| --- | --- | --- |
| **Main** | `https://ecomos.targonglobal.com` | `main` |
| **Dev** | `https://dev-ecomos.targonglobal.com` | `dev` |

Child apps are accessed via path-based routing: `/wms`, `/hrms`, `/x-plan`.

### App Lifecycles

- **Active**: Deployed, validated, and in use. Runs in both main and dev environments.
- **Development**: Actively iterated, participates in CI, deployed to dev only.
- **Archived**: Kept for reference, excluded from CI/builds/deployments.

`app-manifest.json` is the source of truth for lifecycles. The `scripts/run-turbo-task.js` script filters archived apps from lint/type-check/build tasks.

## Deployment Directories

Two directories on the server correspond to two environments:

| Directory | Environment | Ports | URL |
| --- | --- | --- | --- |
| `ecom-os-dev` | Dev | 31xx | dev-ecomos.targonglobal.com |
| `ecom-os-main` | Main | 30xx | ecomos.targonglobal.com |

Each directory tracks its respective git branch (`dev` or `main`).

## Tech Stack

- **Next.js 16** / **React 19** for all frontends
- **NextAuth v5** (beta.30) for authentication — requires `trustHost: true` behind reverse proxy
- **pnpm workspaces** + **Turborepo** for builds
- **TypeScript 5.9** everywhere
- **Prisma ORM** + **PostgreSQL** (single cluster, multi-schema)
- **Tailwind CSS** + **Radix UI** for design
- **PM2** + **nginx** on EC2; GitHub Actions for CI

## Shared Packages

Everything under `packages/` is built so apps never re-implement the same glue:

- `@ecom-os/auth` – shared NextAuth config, cookie helpers, `hasPortalSession`, etc.
- `@ecom-os/theme` – brand tokens, Tailwind extensions, spacing/radii definitions.

## Database & Schemas

One PostgreSQL cluster (`portal_db`) backs every environment. Each app owns its own schema:

| App | Main Schema | Dev Schema |
| --- | --- | --- |
| Portal / Auth | `auth` | `dev_auth` |
| WMS | `wms` | `dev_wms` |
| X-Plan | `xplan` | `dev_xplan` |
| HRMS | `hrms` | `dev_hrms` |

Environment files (`.env.local`) in each app directory configure the correct schema via `DATABASE_URL` query param.

## PM2 Process Management

All apps run via PM2 using `ecosystem.config.js`:

```bash
# View all processes
pm2 status

# Restart dev environment
pm2 restart dev-ecomos dev-wms dev-website dev-hrms dev-x-plan --update-env

# Restart main environment
pm2 restart main-ecomos main-wms main-website main-hrms main-x-plan --update-env

# View logs
pm2 logs main-ecomos --lines 50

# Save config (persists across reboots)
pm2 save
```

The `ecosystem.config.js` uses environment variables for paths:
- `ECOM_OS_DEV_DIR` – defaults to `/Users/jarraramjad/ecom-os-dev`
- `ECOM_OS_MAIN_DIR` – defaults to `/Users/jarraramjad/ecom-os-main`

## Branching & Releases

1. All work branches off `dev`: `git checkout dev && git pull origin dev`
2. Branch as `app-name/feature-name` (e.g., `wms/inline-sku-modal`)
3. Open PR into `dev` — CI must pass (lint, type-check, build)
4. After merge to `dev`, create PR from `dev` → `main` for production release
5. Direct pushes to `dev`/`main` are blocked

### Deployment Workflow

```bash
# After PR merged to dev:
cd ~/ecom-os-dev
git pull origin dev
pnpm --filter ecomos --filter wms --filter website --filter hrms --filter x-plan build
pm2 restart dev-ecomos dev-wms dev-website dev-hrms dev-x-plan --update-env

# After PR merged to main:
cd ~/ecom-os-main
git pull origin main
pnpm --filter ecomos --filter wms --filter website --filter hrms --filter x-plan build
pm2 restart main-ecomos main-wms main-website main-hrms main-x-plan --update-env
```

## Auth & Local Dev

- Portal (`apps/ecomos`) is the source of truth for NextAuth cookies
- All apps share `PORTAL_AUTH_SECRET` / `NEXTAUTH_SECRET`
- NextAuth v5 requires `AUTH_TRUST_HOST=true` when behind nginx/reverse proxy
- WMS/X-Plan guard every route — use `BYPASS_AUTH=true` for local testing without auth

### Running Apps Locally

```bash
# Install dependencies
pnpm install

# Run portal
pnpm --filter @ecom-os/ecomos dev

# Run other apps (needs portal for auth)
pnpm --filter @ecom-os/wms dev
pnpm --filter @ecom-os/hrms dev
pnpm --filter @ecom-os/x-plan dev
```

## Environment Variables

Each app has `.env.local` with environment-specific config. Key variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | App port (30xx for main, 31xx for dev) |
| `AUTH_TRUST_HOST` | Must be `true` for NextAuth v5 behind proxy |
| `NEXTAUTH_URL` | Full URL to the app's auth endpoint |
| `PORTAL_AUTH_URL` | Portal URL for cross-app auth |
| `DATABASE_URL` | Postgres connection with schema param |
| `PORTAL_APPS_CONFIG` | `prod.apps.json` or `dev.apps.json` |

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/run-turbo-task.js` | Runs turbo tasks, filtering archived apps |
| `scripts/sync-versions.js` | Keeps app versions aligned with root |
| `scripts/open-db-tunnel.sh` | SSH tunnel to RDS |
| `scripts/update-deploy-metadata.sh` | Updates nginx headers, purges Cloudflare |

## Troubleshooting

### "UntrustedHost" error
Add `AUTH_TRUST_HOST=true` to `.env.local` and ensure `trustHost: true` is in the NextAuth config.

### 502 Bad Gateway
Check PM2 status — app may have crashed. View logs with `pm2 logs <app-name>`.

### Auth cookies not working
Ensure `COOKIE_DOMAIN=.targonglobal.com` is set and portal is running.

### Database connection failed
Verify `DATABASE_URL` points to correct host/schema and PostgreSQL is accessible.
