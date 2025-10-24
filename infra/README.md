# Ecom OS Infra (Single EC2)

This folder is the single source of truth for infrastructure, migrated from WMS's mature Terraform + Ansible stack. It deploys to a single EC2 host (Nginx + PM2) and can deploy the entire monorepo.

## Layout
- terraform/: EC2 + SG + EIP + IAM role, S3 bucket, etc. (from WMS stack)
- ansible/: Provisioning (node/nginx/postgres/pm2) + deployments
  - playbook.yml, wms-deploy.yml – original WMS playbooks
  - deploy-monorepo.yml – monorepo deploy (PM2 for apps, Nginx vhosts)

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
- portal-db: 3004 → portaldb.targonglobal.com (optional)
- margin-master: 3007 → margin.targonglobal.com (optional)

```bash
# Ansible deploy (GitHub Actions does this on push to main):
ansible-playbook -i ansible/inventory/hosts.ini ansible/deploy-monorepo.yml
```
