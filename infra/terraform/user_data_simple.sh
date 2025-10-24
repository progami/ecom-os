#!/bin/bash
set -e

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "Starting WMS setup at $(date)"

# Default database parameters if not provided
: "${portal_db_name:=portal_db}"
: "${auth_db_user:=portal_auth}"
: "${auth_db_password:=portal_auth_password_2024}"
: "${wms_db_user:=portal_wms}"
: "${wms_db_password:=portal_wms_password_2024}"

# Update system
apt-get update
apt-get upgrade -y

# Install basic dependencies
apt-get install -y \
  curl \
  git \
  nginx \
  postgresql \
  postgresql-contrib \
  python3-pip \
  build-essential \
  ufw

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Configure PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE ${portal_db_name} OWNER postgres;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${auth_db_user}') THEN
    EXECUTE 'CREATE USER ${auth_db_user} WITH PASSWORD ''${auth_db_password}''';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${wms_db_user}') THEN
    EXECUTE 'CREATE USER ${wms_db_user} WITH PASSWORD ''${wms_db_password}''';
  END IF;
END$$;
\c ${portal_db_name}
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'CREATE SCHEMA auth AUTHORIZATION ${auth_db_user}';
  ELSE
    EXECUTE 'ALTER SCHEMA auth OWNER TO ${auth_db_user}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'wms') THEN
    EXECUTE 'CREATE SCHEMA wms AUTHORIZATION ${wms_db_user}';
  ELSE
    EXECUTE 'ALTER SCHEMA wms OWNER TO ${wms_db_user}';
  END IF;
END$$;
ALTER ROLE ${auth_db_user} IN DATABASE ${portal_db_name} SET search_path TO auth;
ALTER ROLE ${wms_db_user} IN DATABASE ${portal_db_name} SET search_path TO wms;
EOF

# Create app user
useradd -m -s /bin/bash wms

# Configure Nginx for port 80 redirect to 3000
cat > /etc/nginx/sites-available/wms <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/wms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# Configure firewall
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Install AWS SSM agent (if not already installed)
snap install amazon-ssm-agent --classic
systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service

echo "WMS setup completed at $(date)"
echo "Ready for application deployment"
