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
