# X-Plan

Next.js 15 application that mirrors the X-Plan workbook so ops, sales, and finance can collaborate without leaving the web. The UI reproduces the Excel tabs (product setup, operations planning, sales forecasting, financial planning, dashboard) and stores data in the shared `central_db.x_plan` schema.

## Getting Started

### 1. Prerequisites

- Node.js **≥ 20.9** (the monorepo tracks the active LTS release).
- pnpm **≥ 9** (`corepack enable` if pnpm is not globally installed).
- PostgreSQL 14+ (local Docker instructions below) or access to the shared `central_db` instance.

### 2. Install workspace dependencies

From the monorepo root:

```bash
pnpm install
```

### 3. Provision a database

X-Plan stores data inside the `x_plan` schema of the `central_db` database. For local development you can launch Postgres via Docker:

```bash
docker run --rm \
  --name x-plan-postgres \
  -e POSTGRES_DB=central_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 6543:5432 \
  postgres:16
```

Then export a connection string that targets that schema before running Prisma or the dev server:

```bash
export DATABASE_URL='postgresql://postgres:postgres@localhost:6543/central_db?schema=x_plan'
```

> Using the shared central database instead of Docker? Point `DATABASE_URL` at that instance while keeping the schema name `x_plan`.

### 4. Configure environment variables

Duplicate the example file and populate the required settings:

```bash
cp apps/x-plan/.env.example apps/x-plan/.env
```

Set `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and any other secrets used by the auth gateway.

### 5. Generate Prisma client & apply migrations

Always regenerate Prisma after pulling schema changes, then apply migrations so the new supplier payment metadata columns exist:

```bash
pnpm --filter @ecom-os/x-plan prisma:generate
pnpm --filter @ecom-os/x-plan prisma:migrate:deploy
```

For fresh databases seed the canonical workbook to mirror production data:

```bash
pnpm --filter @ecom-os/x-plan prisma:seed
```

### 6. Run the dev server

```bash
pnpm --filter @ecom-os/x-plan dev
```

The app serves at http://localhost:3008 and reuses the shared `@ecom-os/auth` flow for sign-in.

## Test & Quality Gates

```bash
pnpm --filter @ecom-os/x-plan test        # Vitest unit & UI smoke tests
pnpm --filter @ecom-os/x-plan lint        # ESLint (Next.js config)
pnpm --filter @ecom-os/x-plan type-check  # tsc in noEmit mode
```

## Key Features

- Handsontable-based grids for each workbook sheet with keyboard navigation, copy/paste, and inline editing.
- Sheet-specific APIs (`/api/v1/x-plan/*`) that persist changes to PostgreSQL and keep derived totals in sync.
- Automatic supplier invoice generation (manufacturing deposit/production/final, freight, tariff) so new purchase orders surface immediately in planning and cash views.
- Excel import/export pipeline (via SheetJS) to bootstrap data from `scripts/excel_template.xlsx` and round-trip updates.
- Prisma schema scoped to the `x_plan` schema inside the central database so the platform can grow without siloed databases.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string targeting the `x_plan` schema |
| `NEXTAUTH_URL` | Public URL for the app (used by NextAuth) |
| `NEXTAUTH_SECRET` | Shared auth secret (should match the central portal) |
| `CENTRAL_AUTH_URL` | Base URL for the central auth portal (defaults to `http://localhost:3000` in dev) |

See `.env.example` for quick-start values.
