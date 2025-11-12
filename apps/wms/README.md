# @ecom-os/wms

Warehouse Management System powering inventory, billing, and operations for Ecom OS.

## Local Development
- Install dependencies from the monorepo root with `pnpm install`.
- Launch the app with `pnpm --filter @ecom-os/wms dev` (default port 3001).
- Keep Prisma in sync using `pnpm --filter @ecom-os/wms db:push` and regenerate the client with `pnpm --filter @ecom-os/wms db:generate`.
- Run end-to-end tests through `pnpm --filter @ecom-os/wms test`.

## Production Workflow
- Deployments happen manually on the EC2 host—no Terraform or Ansible flows remain.
- From the host, pull the latest code, run `pnpm install`, and build with `pnpm --filter @ecom-os/wms build`.
- Start the production server via `pnpm --filter @ecom-os/wms start` (wrap with pm2/systemd if you need process management).

## Environment
Configuration is supplied through `.env` files stored on the host. Update env values before rebuilding when secrets or service endpoints change.

The auth bootstrap fails fast when a required variable is missing. Make sure every WMS environment defines:
- `NEXTAUTH_SECRET` (or `PORTAL_AUTH_SECRET`)
- `NEXTAUTH_URL`, `PORTAL_AUTH_URL`, and `NEXT_PUBLIC_PORTAL_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `COOKIE_DOMAIN` (use `localhost` for local dev, `.targonglobal.com` for shared environments)
- `PRISMA_SCHEMA` (per-environment Postgres schema, e.g. `wms_dev` or `wms`)
