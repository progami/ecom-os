# Ecom OS Architecture Overview (ECS Edition)

Small team, small load: the goal is to keep the stack lean while removing snowflake EC2 configuration. Everything below is the minimum we need to replicate today’s behaviour on ECS with managed PostgreSQL.

## Topology (Minimal)

```mermaid
graph TD
    DNS[Route53 / Cloudflare] --> ALB

    subgraph VPC (two subnets total)
        ALB[Application Load Balancer<br/>:80]
        EC2[ECS Cluster (EC2 launch type)<br/>t3.small x 1-2 nodes]
        RDS[(Amazon RDS PostgreSQL<br/>db.t4g.small, single-AZ)]
    end

    ALB -->|host=/ path| Portal
    ALB -->|/wms| WMS
    ALB -->|/xplan| XPlan
    ALB -->|www.targonglobal.com| Website

    Portal --> RDS
    WMS --> RDS
    XPlan --> RDS
```

### Why this is enough
- Cloudflare/Route53 terminates TLS; the ALB only needs HTTP routing with simple host/path rules.
- ECS tasks sit on the same subnets as the EC2 hosts and get public IPs, so no NAT gateway needed.
- RDS uses the smallest burstable instance with automated snapshots; no replica until usage grows.
- S3 buckets from the old setup stay as-is; we grant the ECS task role access only if/when the app calls S3.

## Containers in Production

| Service | Workspace | Ports | Notes |
|---------|-----------|-------|-------|
| Portal / Auth | `apps/ecomos` | 3000 | Issues auth cookies, renders navigation hub. |
| WMS | `apps/wms` | 3001 | Served under `/wms`; requires `BASE_PATH=/wms`. |
| XPlan | `apps/x-plan` | 3009 | Served under `/xplan`. |
| Website | `apps/website` | 3005 | Full Next.js server, not static export yet. |

Exactly four steady tasks in prod, each pinned to a small CPU/memory reservation (e.g., 0.5 vCPU / 1 GB). No autoscaling or sidecars until we outgrow the comfort zone.

## Data Layer
- **RDS PostgreSQL** keeps the single database `portal_db` with schemas `auth`, `wms`, `xplan`. Same schema split we have today.
- Credentials stay in GitHub Secrets; the deploy workflow injects env vars (`DATABASE_URL`, `PORTAL_DB_URL`, etc.) when registering task definitions.
- Backups rely on RDS automated snapshots. If we want off-site dumps later we can add a weekly ECS scheduled task.
- Migration steps (once):
  1. Spin up RDS through Terraform.
  2. Dump the EC2 Postgres (`pg_dump`), import into RDS, run Prisma checks.
  3. Point staging tasks at RDS, smoke test.
  4. Schedule maintenance window, re-run dump/import, flip production tasks to RDS, retire EC2 Postgres.

## Networking & Security (Keep It Simple)
- VPC with two subnets (one per AZ). The ALB and ECS instances share the public subnets; tasks get public IPs for outbound calls (npm, APIs).
- Security groups:
  - ALB: allow port 80 from the world (Cloudflare still fronts the domains for TLS).
  - ECS instances: allow 3000/3001/3005/3009 only from the ALB SG; allow outbound everywhere.
  - RDS: allow 5432 from the ECS SG only.
- IAM task role stays minimal (S3 access when needed); secrets are injected by the deploy workflow so no AWS-side secret store is required for now.

## Build & Deploy Flow
1. GitHub Actions runs lint/type-check/tests (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @ecom-os/{ecomos,wms,x-plan,website} test` as needed).
2. Multistage Dockerfiles (one per app) create images; outputs pushed to a single ECR repo per app with tag = commit SHA.
3. Terraform updates:
   - ECS cluster + Launch Template (Amazon Linux 2023, container-optimized, small ASG).
   - Task definitions referencing latest image and secrets.
   - ALB listener rules pointing to each target group.
   - RDS instance + subnet group + parameter group.
4. Deployment = update task definition, run `terraform apply`, watch ECS replace the task (one at a time). Because we have single-task services we do this during a short maintenance window.

## Local & Staging
- Local dev unchanged (`pnpm dev`). Optional `docker-compose.yml` spins up the same four services plus a local Postgres container for parity testing.
- Staging reuses the same Terraform stack in another workspace, but with tiny EC2 (t3.micro) and RDS (db.t4g.micro) to keep cost minimal.

## Operations Checklist
- **Logging**: CloudWatch Logs retains 7 days (extend later if needed). One metric alarm on “any task exits” + ALB 5xx > threshold.
- **Backups**: RDS automated daily snapshot. Document manual restore procedure.
- **Access**: Bastion/SSM isn’t necessary; we can SSH directly to the ECS instance for debugging, but aim to keep everything scripted.
- **Growth trigger**: when CPU > 50% sustained or more users arrive, add second ECS instance and dial service desired counts up.

This setup mirrors the current EC2 behaviour without introducing unnecessary moving parts, and keeps the door open for future scaling when the user base grows.
