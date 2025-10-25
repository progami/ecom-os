# Deployment Strategy (ECS + RDS)

This guide explains how we provision infrastructure, build containers, and ship updates now that the monolith is running on Amazon ECS (EC2 launch type) with Amazon RDS PostgreSQL. The goals were:

- identical container images for local dev and production;
- lean infrastructure sized for a ~10 user workload;
- a single GitHub Actions pipeline that builds, pushes, and deploys without extra manual steps.

## 1. Infrastructure Overview

- **VPC:** one VPC (`10.40.0.0/16`) with two public subnets (ALB + ECS instances) and two private subnets (RDS). No NAT gateway; ECS instances receive public IPs for outbound traffic.
- **ECS Cluster:** a t3.medium Auto Scaling Group (min/des/ max = 1/1/2) registered as an ECS capacity provider. Desired count is one task per service.
- **Services & Target Groups:**
  - `@ecom-os/ecomos` → `/` on the ALB.
  - `@ecom-os/wms` → `/wms` (path rule).
  - `@ecom-os/x-plan` → `/xplan` (path rule).
  - `@ecom-os/website` → `www.targonglobal.com` (host rule).
- **Database:** single-AZ Amazon RDS PostgreSQL (`db.t4g.small`) hosting `portal_db` with schemas `auth`, `wms`, `xplan`.
- **Repositories:** four dedicated ECR repositories managed by Terraform.
- **Observability:** per-service CloudWatch log groups (7-day retention).

Terraform definitions live in `infra/terraform/`. Outputs expose the ALB DNS name, ECS cluster name, RDS endpoint, and ECR repository URLs.

## 2. Required GitHub Secrets & Variables

| Name | Type | Description |
|------|------|-------------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Secret | IAM user or role credentials with permissions for ECR, ECS, EC2, RDS, and networking. |
| `RDS_MASTER_USERNAME`, `RDS_MASTER_PASSWORD` | Secret | Master auth used to create and access `portal_db`. |
| `ECOMOS_ENV`, `WMS_ENV`, `XPLAN_ENV`, `WEBSITE_ENV` | Secret | Exact `.env` payloads for each app (same as local). They are parsed into JSON and injected into task definitions. |
| `vars.PORTAL_DOMAIN` | Repository variable | e.g., `ecomos.targonglobal.com`. |
| `vars.WEBSITE_DOMAIN` | Repository variable | e.g., `www.targonglobal.com`. |
| `vars.COOKIE_DOMAIN` | Repository variable (optional) | Defaults to `.targonglobal.com` when unset. |

> GitHub Secrets remain the single source of truth for runtime env values. Terraform consumes them at deploy time; nothing is duplicated in AWS Secrets Manager.

## 3. Build & Release Pipeline

Workflow file: `.github/workflows/deploy.yml`.

1. **verify job**
   - Checkout repo, install dependencies via pnpm, run `pnpm lint` and `pnpm typecheck`.
2. **build-and-deploy job**
   - Configures AWS credentials and logs into ECR.
   - Ensures the four ECR repositories exist (idempotent).
   - Builds Docker images for portal, WMS, X-Plan, and website using the workspace Dockerfiles, tagging each with `:${GITHUB_SHA}` and `:latest`, then pushes to ECR.
   - Converts the `.env` secrets into Terraform map variables, sets image URIs, domains, and RDS credentials as `TF_VAR_*`.
   - Runs `terraform init`, `plan`, and `apply` from `infra/terraform/`, replacing task definitions, ECS services, ALB rules, and RDS parameters when changes are detected.

The workflow can be triggered on pushes to `dev` or `main`, or manually via `workflow_dispatch`.

## 4. Local Development & Parity

- `docker-compose.yml` spins up Postgres plus the same four containers with production entrypoints. The compose stack uses the same Dockerfiles and entrypoint scripts, ensuring no divergence.
- Non-container dev still works (`pnpm dev`), but the compose stack is the quickest way to test multi-app flows with the shared auth cookie.

## 5. Initial Provisioning & Migration Checklist

1. **Bootstrap AWS resources**
   - Populate GitHub secrets/variables.
   - Run the GitHub workflow once; Terraform will create the VPC, ECS cluster, ALB, RDS instance, and ECR repos. (First run may take ~10 minutes while RDS starts.)
2. **Database migration**
   - Dump existing EC2 Postgres (`pg_dump portal_db > portal.sql`).
   - Restore into the new RDS instance (`psql -h <rds-endpoint> -U $RDS_MASTER_USERNAME portal_db < portal.sql`).
   - Re-run the workflow to ensure Prisma migrations (executed at container boot) align with the restored data.
3. **DNS cutover**
   - Update Route53/Cloudflare records so portal + website domains point to the ALB.
   - TLS stays at Cloudflare; the ALB only needs HTTP (port 80) listeners.
4. **Decommission legacy EC2**
   - After traffic stabilises on ECS/RDS, shut down the old instance and remove Ansible/Terraform EC2 resources.

## 6. Ongoing Operations

- **Scaling:** bump `ecs_desired_capacity` or task CPU/memory variables in Terraform. Desired count stays at one unless traffic grows.
- **Logs:** view application logs in CloudWatch (`/ecs/ecom-os-prod/<service>`). Retention is seven days; adjust via Terraform if needed.
- **Backups:** RDS automated snapshots retain the last three days. Increase `db_backup_retention` when we need longer history.
- **Secrets rotation:** update GitHub secrets/variables and rerun the deploy workflow. Terraform will roll tasks with the new env values.
- **Metrics & alerts:** add CloudWatch alarms or Grafana dashboards as follow-ups (not part of the minimal uplift).

## 7. Troubleshooting

- **Terraform apply fails** — check that all required `TF_VAR_*` values were exported (workflow step “Prepare Terraform variable environment”).
- **ECS task cannot reach Postgres** — ensure RDS SG allows the ECS SG, and the container received the updated `DATABASE_URL`.
- **ALB returns 5xx** — verify task health status in ECS console; container logs stream to CloudWatch.

With this setup the same containers run locally, in staging, and in production, and the entire environment is reproducible from Terraform + GitHub Actions. Tailwind, SSO behaviour, and Prisma migrations remain unchanged—only the hosting surface moved from a snowflake EC2 box to a small ECS cluster.
