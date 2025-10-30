# HRMS App

Next.js 14 + Prisma + Postgres app.

## Local Development (match production)

- Requirements:
  - Node.js 20+
  - pnpm 9+
  - Postgres 16+ installed natively (no Docker)

- Install Postgres
  - macOS (Homebrew):
    - `brew install postgresql@16`
    - `brew services start postgresql@16`
  - Ubuntu/Debian:
    - `sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib`
    - `sudo systemctl enable --now postgresql`

- Create DB and user (matches prod-style provisioning):
  - macOS (superuser often `postgres` with local trust):
    - `psql -U postgres -c "CREATE ROLE hrms WITH LOGIN PASSWORD 'hrms';" || true`
    - `psql -U postgres -c "CREATE DATABASE hrms OWNER hrms;" || true`
  - Linux (if peer auth requires):
    - `sudo -u postgres psql -c "CREATE ROLE hrms WITH LOGIN PASSWORD 'hrms';" || true`
    - `sudo -u postgres psql -c "CREATE DATABASE hrms OWNER hrms;" || true`

- Configure env:
  - Copy `.env.example` to `.env.local` (and `.env` for Prisma CLI)
  - Default connection: `postgresql://hrms:hrms@localhost:5432/hrms?schema=public`

- Initialize Prisma:
  - `pnpm -F @ecom-os/hrms db:generate`
  - First time: create and commit migrations
    - `pnpm -F @ecom-os/hrms db:migrate:dev -- --name init`
  - If you hit permission errors, bootstrap local DB privileges:
    - macOS: `psql -v ON_ERROR_STOP=1 -h localhost -U postgres -f apps/hrms/scripts/bootstrap-db.sql`
    - Linux: `sudo -u postgres psql -v ON_ERROR_STOP=1 -f apps/hrms/scripts/bootstrap-db.sql`
    - Then rerun: `pnpm -F @ecom-os/hrms db:migrate:dev`

## Seeding Data

- Place JSON files under `apps/hrms/prisma/seed/`:
  - `employees.json` (see `employees.sample.json` for shape)
  - `resources.json` (see `resources.sample.json`)
  - `policies.json` (see `policies.sample.json`)

- Run seed locally:
  - `pnpm -F @ecom-os/hrms db:seed`

- Idempotent behavior:
  - Employees upsert by `email` (fallback `employeeId`)
  - Resources match by `website` if provided; otherwise create
  - Policies match by `title`

- Production (one-time during cutover):
  - Add a step to infra deploy for HRMS to run:
    - `pnpm -C apps/hrms exec prisma generate && pnpm -C apps/hrms exec prisma db migrate deploy`
    - `pnpm -C apps/hrms exec prisma db seed`
  - Or call the package script from the app dir:
    - `pnpm -C apps/hrms run db:seed`

- Run app:
  - `pnpm -F @ecom-os/hrms dev`
  - http://localhost:3006

- Utilities:
  - `pnpm -F @ecom-os/hrms db:studio`
  - `pnpm -F @ecom-os/hrms db:reset`

## Production

- We deploy manually on the EC2 host; provision Postgres yourself (managed RDS or native service).
- Provide `DATABASE_URL` via environment (no files committed).
- Deployment sequence:
  - Install deps
  - `pnpm -F @ecom-os/hrms db:generate`
  - `pnpm -F @ecom-os/hrms db:migrate:deploy` (never `db push` in prod)
  - Build + start app

## Notes

- Migrations are tracked (see `prisma/migrations`) to avoid drift between environments.
- `.env.local` is gitignored and only for local development.

## Google Calendar Integration

- Two modes:
  - Embed (read-only view): set `NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL` to a public/embed URL and open `/hrms/calendar`.
  - API (read/write): set these server env vars and use the Calendar UI or API:
    - `GOOGLE_CALENDAR_ID`
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`
    - `GOOGLE_REFRESH_TOKEN`

- Getting a refresh token (one-time):
  - Create an OAuth Client (Web) in Google Cloud Console.
  - Run a small CLI or use a temporary route to perform OAuth consent with `access_type=offline` and grant Calendar scopes.
  - Capture the refresh token and place it in `.env`.
  - Share the target Google Calendar with the account whose refresh token you used.

- Endpoints:
  - `GET /api/calendar/events` → upcoming events (server-side Google API)
  - `POST /api/calendar/events` → create event (summary, start.dateTime, end.dateTime)
  - UI: `/hrms/calendar`
