## Database Schema Strategy

We run every workspace off a single Postgres cluster (`portal_db`) that lives on the
`ecomos-prod.cyx0i8s6srto.us-east-1.rds.amazonaws.com` RDS instance. To avoid the
“shared dev database” pitfalls we now treat **schemas** as the isolation boundary:

| App          | Production schema | Dev schema      | Notes                               |
|--------------|-------------------|-----------------|-------------------------------------|
| Portal/Auth  | `auth_prod`       | `auth_dev`      | Holds NextAuth + directory tables   |
| WMS          | `wms_prod`        | `wms_dev`       | Already used by Prisma today        |
| X-Plan       | `xplan_prod`      | `xplan_dev`     | Update `DATABASE_URL` + migrations  |
| Website/FCC… | `website_prod`    | `website_dev`   | Create on demand per workspace      |

### Environment variables

Each app points Prisma at the proper schema via the `?schema=` suffix in
`DATABASE_URL`. Example (WMS dev):

```
DATABASE_URL="postgresql://portal_wms:*****@localhost:6543/portal_db?schema=wms_dev"
```

For prod we swap the tunnel host for the direct RDS host and use the `*_prod`
schema. The `.env.dev`, `.env.production`, and `.env.local` files for every app
have been updated to follow this naming convention.

### Creating a new schema

1. `psql` into the cluster (usually through the SSH tunnel).
2. `CREATE SCHEMA IF NOT EXISTS <schema>;`
3. Grant the app’s DB user access: `GRANT ALL ON SCHEMA <schema> TO <user>;`
4. Point `DATABASE_URL` at the new schema and run
   `pnpm --filter @ecom-os/<app> prisma migrate deploy`.
5. Seed if necessary (`pnpm --filter … prisma db seed`).

### Migrations & resets

| Operation            | Dev                                           | Prod                                        |
|----------------------|-----------------------------------------------|---------------------------------------------|
| Apply migrations     | `pnpm --filter <app> prisma migrate dev`      | `pnpm --filter <app> prisma migrate deploy` |
| Reset data           | `psql ... -c 'DROP SCHEMA <schema> CASCADE'`  | Never drop; use targeted `DELETE` scripts   |
| CI sanity checks     | `DATABASE_URL=...schema=<app>_ci`             | n/a                                          |

Keep the schema names in sync with the Prisma `schema.prisma` files so we can
switch environments by flipping a single env var. This also allows us to
snapshot/restore individual apps without touching the rest of the system.
