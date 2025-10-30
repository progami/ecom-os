# @ecom-os/website

Marketing site and landing hub for the Ecom OS platform.

## Local Development
- Install dependencies once from the repo root with `pnpm install`.
- Start the app with `pnpm --filter @ecom-os/website dev` (runs on port 3005 by default).
- Run linting and static checks with `pnpm --filter @ecom-os/website lint` and `pnpm --filter @ecom-os/website type-check`.

## Production Workflow
- We work directly on the EC2 host; no Terraform or Ansible automation is required.
- Pull the latest changes, then run `pnpm install` followed by `pnpm --filter @ecom-os/website build`.
- Serve the production build with `pnpm --filter @ecom-os/website start` or your preferred process manager.

## Environment
Required values live in the app's `.env` file on the host (see `.env.example`). Update the file before rebuilding when configuration changes.
