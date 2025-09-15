HRMS (WMS‑aligned Dev Pattern)

Prerequisites
- Node.js 18+
- PostgreSQL running locally (or reachable), with a database you can access. Example:
  - postgresql://postgres:postgres@localhost:5432/hrms
- Set `DATABASE_URL` in `.env` accordingly.

First‑time Setup
```
npm ci
npm run db:generate     # prisma generate
npm run db:push         # or: npm run db:migrate
```

Run Dev Server
```
npm run dev
```
App runs at http://localhost:3006

Seed (via API)
With the server running:
```
npm run seed:dev
```
This posts sample Employees, Resources (service providers), and Policies through live API routes.

Scripts (WMS‑style)
- `dev`: start Next dev server (no automatic DB boot/migrate)
- `db:generate`: prisma generate
- `db:push`: apply schema to DB
- `db:migrate`: create/apply migrations in dev
- `start`: production start (custom server.js)
- `dev:logged`: start custom server locally with logging
- `seed:dev`: seed via API calls

Notes
- No Docker in this project. Provide a reachable Postgres and ensure your DB user has permissions to create/alter tables in the target DB.
- Storage integrates with S3 using envs compatible with WMS naming: `S3_BUCKET_NAME`, `S3_BUCKET_REGION` (or `S3_BUCKET`, `S3_REGION`).

