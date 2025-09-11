#!/bin/bash
set -e

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "Starting WMS deployment at $(date)"

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
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
CREATE USER ${db_user} WITH PASSWORD '${db_password}';
CREATE DATABASE ${db_name} OWNER ${db_user};
GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${db_user};
ALTER USER ${db_user} CREATEDB;
EOF

# Create app user
useradd -m -s /bin/bash wms

# Clone repository
cd /home/wms
sudo -u wms git clone https://github.com/progami/WMS_EcomOS.git app

# Create .env file
cat > /home/wms/app/.env <<EOF
DATABASE_URL="postgresql://${db_user}:${db_password}@localhost:5432/${db_name}"
NEXTAUTH_URL="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):${app_port}"
NEXTAUTH_SECRET="production_secret_key_change_in_production"
NODE_ENV="production"
DEMO_ADMIN_PASSWORD="SecureWarehouse2024!"
DEMO_STAFF_PASSWORD="DemoStaff2024!"
PORT=${app_port}
EOF
chown wms:wms /home/wms/app/.env

# Install dependencies and build
cd /home/wms/app
sudo -u wms npm ci
sudo -u wms npx prisma generate

# Check for migrations and apply schema
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
  sudo -u wms npx prisma migrate deploy
else
  sudo -u wms npx prisma db push --skip-generate
fi

# Seed database
sudo -u wms npx prisma db seed || true

# Build application
sudo -u wms npm run build

# Start with PM2
sudo -u wms PORT=${app_port} pm2 start npm --name wms-app -- start
sudo -u wms pm2 save

# Setup PM2 startup
pm2 startup systemd -u wms --hp /home/wms
systemctl enable pm2-wms

# Configure Nginx
cat > /etc/nginx/sites-available/wms <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:${app_port}/api/health;
        access_log off;
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
ufw allow ${app_port}/tcp

# Setup demo data
sleep 10
curl -X POST http://localhost:${app_port}/api/demo/setup -H "Content-Type: application/json" || true

echo "WMS deployment completed at $(date)"