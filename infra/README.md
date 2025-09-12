# Ecom OS Infra (Single EC2)

This folder is the single source of truth for infra used by CD. It deploys to a single EC2 host (Nginx + PM2) and can deploy the entire monorepo.

## Layout
- ansible/: provisioning and deploy (used by CD)
  - deploy-monorepo.yml – monorepo deploy (PM2 for apps, Nginx vhosts)
  - nginx-monorepo.conf.j2 – nginx vhosts
  - group_vars/all.yml – hostnames/ports for health checks
- legacy/: archived WMS‑specific playbooks and old inventory templates (removed)
- terraform/: EC2 + SG + EIP + IAM role, S3 bucket, etc. (optional; not used by CD)

## Quick start
```bash
cd infra/terraform
terraform init
terraform plan
# terraform apply  # when ready
```

## Ports and hosts (example defaults)
- website: 3000 → www.targonglobal.com
- wms: 3001 → wms.targonglobal.com
- fcc: 3003 → fcc.targonglobal.com
- hrms: 3006 → hrms.targonglobal.com
- central-db: 3004 → centraldb.targonglobal.com (optional)
- margin-master: 3007 → margin.targonglobal.com (optional)

CD runs ansible/deploy-monorepo.yml on push to main (or manual dispatch) and handles inventory/host selection.
