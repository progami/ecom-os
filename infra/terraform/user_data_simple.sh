#!/bin/bash
set -e

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "Starting WMS setup at $(date)"

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
CREATE USER wms WITH PASSWORD 'wms_secure_password_2024';
CREATE DATABASE wms_production OWNER wms;
GRANT ALL PRIVILEGES ON DATABASE wms_production TO wms;
ALTER USER wms CREATEDB;
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