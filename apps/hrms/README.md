# HRMS App

Human Resources Management System built with Next.js 16, Prisma, and PostgreSQL.

## Features

- Employee directory and profiles
- Organization chart (by person or department)
- Performance reviews and disciplinary tracking
- Company policies and resources
- HR calendar with Google Calendar integration
- Google Workspace Admin sync (auto-import employees)
- Notification system

## Requirements

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

## Local Development

### Database Setup

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16
psql -U postgres -c "CREATE DATABASE hrms;"

# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE DATABASE hrms;"
```

### Environment

Copy `.env.dev.ci` to `.env.local` and update values:

```bash
cp .env.dev.ci .env.local
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth secret (must match portal)
- `PORTAL_AUTH_URL` - Portal auth endpoint
- `PORTAL_AUTH_SECRET` - Shared auth secret

### Prisma

HRMS uses `@ecom-os/prisma-hrms` workspace package for the Prisma client.

```bash
# Generate client
pnpm -F @ecom-os/hrms db:generate

# Run migrations
pnpm -F @ecom-os/hrms db:migrate:dev

# Open Prisma Studio
pnpm -F @ecom-os/hrms db:studio
```

### Run

```bash
pnpm -F @ecom-os/hrms dev
```

Default port: 3006 (main), 3106 (dev branch)

## Seeding Data

Place JSON files in `prisma/seed/`:
- `employees.json`
- `resources.json`
- `policies.json`

See `*.sample.json` files for schema.

```bash
pnpm -F @ecom-os/hrms db:seed
```

## Google Workspace Integration

### Google Admin Sync

Syncs employees from Google Workspace directory. Runs automatically on startup and every 30 minutes.

Required env vars:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ADMIN_REFRESH_TOKEN` - OAuth token with Admin SDK scope
- `GOOGLE_ADMIN_DOMAIN` - Workspace domain (default: targonglobal.com)

Manual sync: `POST /api/google-admin/sync`

### Google Calendar

For calendar integration:
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_REFRESH_TOKEN` - OAuth token with Calendar scope
- `NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL` - Public calendar embed URL

## Production Deployment

```bash
pnpm -F @ecom-os/hrms db:generate
pnpm -F @ecom-os/hrms db:migrate:deploy
pnpm -F @ecom-os/hrms build
pnpm -F @ecom-os/hrms start
```

Provide `DATABASE_URL` and auth secrets via environment variables.
