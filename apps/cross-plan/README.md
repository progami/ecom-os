# X-Plan

Next.js 15 application that mirrors the X-Plan workbook so ops, sales, and finance can collaborate without leaving the web. The UI reproduces the Excel tabs (product setup, operations planning, sales forecasting, financial planning, dashboard) and stores data in the shared `central_db.cross_plan` schema.

## Getting Started

```bash
pnpm install
pnpm --filter @ecom-os/cross-plan prisma:generate
pnpm --filter @ecom-os/cross-plan prisma:push
pnpm --filter @ecom-os/cross-plan prisma:seed
pnpm --filter @ecom-os/cross-plan dev
```

The app runs on http://localhost:3008. Authentication delegates to the central portal via the shared `@ecom-os/auth` package.

### Local database

X-Plan expects a PostgreSQL instance with the `cross_plan` schema. For local work you can start a Dockerised database with:

```bash
docker run --rm \
  --name cross-plan-postgres \
  -e POSTGRES_DB=central_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 6543:5432 \
  postgres:16
```

Then export `DATABASE_URL=postgresql://postgres:postgres@localhost:6543/central_db?schema=cross_plan` before running Prisma commands or the dev server. The seed script bootstraps the schema and loads the bundled workbook to guarantee a full dataset.

### Test & quality gates

```bash
pnpm --filter @ecom-os/cross-plan test        # Vitest unit & UI smoke tests
pnpm --filter @ecom-os/cross-plan lint        # ESLint (Next.js config)
pnpm --filter @ecom-os/cross-plan type-check  # tsc in noEmit mode
```

## Key Features

- Handsontable-based grids for each workbook sheet with keyboard navigation, copy/paste, and inline editing.
- Sheet-specific APIs (`/api/v1/cross-plan/*`) that persist changes to PostgreSQL and keep derived totals in sync.
- Excel import/export pipeline (via SheetJS) to bootstrap data from `excel_template.xlsx` and round-trip updates.
- Prisma schema scoped to the `cross_plan` schema inside the central database so the platform can grow without siloed databases.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string targeting the `cross_plan` schema |
| `NEXTAUTH_URL` | Public URL for the app (used by NextAuth) |
| `NEXTAUTH_SECRET` | Shared auth secret (should match central portal) |
| `CENTRAL_AUTH_URL` | Base URL for the central auth portal (defaults to `http://localhost:3000` in dev) |

See `.env.example` for quick-start values.
