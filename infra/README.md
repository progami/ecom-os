# Ecom OS Infra (Single EC2)

This folder contains Terraform + Ansible to deploy all apps (website, wms, hrms, fcc) on a single EC2 host, fronted by Nginx and managed by PM2. We do not deploy until everything runs locally.

## Layout
- terraform/: EC2 + SG + EIP + IAM role and outputs.
- ansible/: One playbook to provision node/nginx/pm2 and run apps.

## Quick start (dev/prototype)
- terraform:
  - Set variables in `terraform/terraform.tfvars` (copy `.example` → remove `.example`).
  - `make` style commands are similar to WMS infra; run:

```bash
cd infra/terraform
terraform init
terraform plan
# terraform apply  # when ready
```

- ansible:
  - After terraform apply, get public_ip from outputs.
  - Fill ansible inventory `infra/ansible/inventory/hosts.ini` with the EC2 IP and SSH key.
  - `ansible-playbook -i ansible/inventory/hosts.ini ansible/deploy-monorepo.yml`

## Ports and hosts
- website: 3000 → www.targonglobal.com
- wms: 3001 → wms.targonglobal.com
- fcc: 3003 → fcc.targonglobal.com
- hrms: 3006 → hrms.targonglobal.com

Set DNS A records to the EC2 elastic IP or use certbot to issue host certs.
