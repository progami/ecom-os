# Deployment Strategy

This document records how we provision infrastructure and ship builds into production for the Ecom OS monorepo.

## 1. Infrastructure Provisioning
- Terraform (`infra/terraform/`) creates the single EC2 host, security group, IAM instance profile, Elastic IP, and shared S3 bucket.
- Run `terraform init && terraform plan` (and `terraform apply` when ready) from within `infra/terraform/` to ensure the EC2 resources match the desired state.
- Terraform writes `infra/ansible/inventory/production.yml` so Ansible and GitHub Actions have a consistent inventory entry for the target host.

## 2. Required Secrets & Credentials
Populate the following repository secrets in GitHub before enabling the deploy workflow:
- `SSH_PRIVATE_KEY` – PEM key with access to the EC2 box.
- `AWS_ROLE_TO_ASSUME`, `AWS_REGION`, optionally `EC2_INSTANCE_ID` – used to discover the host via AWS APIs.
- `EC2_HOST`, `EC2_USER` – fallback connection details when discovery is skipped.
- `CF_API_TOKEN` – Cloudflare API token for DNS updates (optional but recommended).
- Application env payloads: `WEBSITE_ENV`, `WMS_ENV`, `HRMS_ENV`, `FCC_ENV`, `CENTRAL_DB_ENV`, `MARGIN_MASTER_ENV`, `JASON_ENV`, `ECOMOS_ENV`.
- `ECOMOS_ENV` should contain authentication secrets consumed by the central portal and WMS. Store each `.env` file as a newline-delimited string.

## 3. CI/CD Entry Points
- Pull requests into `dev` and `main` run `.github/workflows/ci.yml` (lint, type check, build for Website and WMS).
- A push to `main` touching app, package, infra, or pnpm files triggers `.github/workflows/deploy-prod.yml`, which performs the production deployment via Ansible.
- The deploy workflow can also be launched manually with `workflow_dispatch` for testing.

## 4. Deploy Workflow Breakdown (`deploy-prod.yml`)
1. Check out the repository and install pnpm 9 on Node 20 runners.
2. Install project dependencies and build the applications required in production (`pnpm turbo run build --filter=@ecom-os/website --filter=@ecom-os/ecomos --filter=@ecom-os/wms`).
3. Configure SSH credentials for the runner (including optional EC2 Instance Connect key injection when AWS IAM is available).
4. Resolve the target host either through AWS lookup or fallback secrets; append the host key to `known_hosts`.
5. Run a disk-usage preflight to track available space on the EC2 node.
6. Optionally update Cloudflare DNS A records to the resolved host IP.
7. Emit `infra/ansible/inventory/hosts.ini` matching the resolved host + SSH user.
8. Execute `ansible-playbook infra/ansible/deploy-monorepo.yml` with secrets forwarded as env vars.
9. Perform HTTP health checks against the Website and WMS using the domains defined in `group_vars/all.yml`.

## 5. Ansible Deployment Flow (`deploy-monorepo.yml`)
- Ensures system dependencies are present and runs `apt` to refresh critical packages (`update_cache: yes`, `upgrade: dist`, `autoremove: yes`).
- Installs Node 20 via Nodesource and global `pm2`/`pnpm`.
- Synchronizes the GitHub Actions workspace into `/opt/ecom-os/repo` on the host, excluding `.git`, `node_modules`, and `.turbo` caches.
- Runs `pnpm install` on the host to rebuild the lockfile dependencies.
- Provisions PostgreSQL schemas and credentials via `tasks/database-setup.yml`, including daily backups.
- Writes per-app `.env` files from the secrets provided by GitHub Actions.
- Renders the Nginx configuration (`nginx-monorepo.conf.j2`) mapping each domain to the appropriate local port.
- Issues/renews Let’s Encrypt certificates for apex, www, ecomos, and wms domains.
- Rebuilds and restarts services with pm2:
  - Website (`PORT=3005`, `server.js` under `apps/website`)
  - EcomOS portal (`PORT=3000`, `pnpm start` under `apps/ecomos` with central auth env vars)
  - WMS (`PORT=3001`, rebuild + `server.js` under `apps/wms` with `BASE_PATH=/wms`)
- Saves the pm2 process list and verifies local health for each service.
- Installs housekeeping scripts for log cleanup.

## 6. Health Verification
- The workflow performs curl-based checks against Website (expected marketing copy) and WMS (`/wms/api/health` must return `status":"ok"`).
- Post-deploy monitoring should include manual spot checks of `https://www.targonglobal.com`, `https://ecomos.targonglobal.com`, and `https://ecomos.targonglobal.com/wms` to confirm routing.

## 7. Manual Operations
- For targeted deployments or debugging, run `ansible-playbook -i infra/ansible/inventory/hosts.ini infra/ansible/deploy-monorepo.yml` from the repo root after setting the same env vars that GitHub Actions supplies.
- Use `--check` for dry-runs or limit hosts/tasks as needed.
- pm2 processes run under the default OS user (typically `ubuntu`), and the application checkout resides at `/opt/ecom-os/repo`.

## 8. Maintenance & Upgrades
- Update system packages by adjusting the early `apt` task in `deploy-monorepo.yml`; every production deploy will then enforce the desired package versions.
- Bump Node, pnpm, or pm2 versions in the playbook to roll forward runtimes consistently.
- When adding new applications, extend the Ansible vars (ports, domains), add build steps in the workflow, and ensure secrets for the new app are configured.
- Keep `group_vars/all.yml` aligned with real infrastructure values (domains, database credentials, S3 config).

## 9. Preconditions Before a Production Deploy
- `pnpm lint`, `pnpm typecheck`, and app-specific builds succeed locally.
- Terraform state is up to date, and the EC2 host is reachable via SSH.
- All target domains resolve to the EC2 public IP, or Cloudflare credentials are available for the workflow to update records.
- Required secrets have been uploaded or rotated as needed.
- Database migrations for WMS or central auth have been validated on staging.

Following this process keeps provisioning, configuration, and deployment deterministic, with GitHub Actions driving the same Ansible playbook that we can execute manually for troubleshooting.
