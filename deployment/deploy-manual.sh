#!/bin/bash
# Manual deployment script for Targon Global frontend
# Run this on the server as the deployment user

set -e

echo "🚀 Starting Targon Global frontend deployment..."

# Configuration
APP_USER="targon"
APP_DIR="/home/$APP_USER/app"
APP_NAME="targon-frontend"
APP_PORT=3000
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"

# Create user if it doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    echo "Creating user $APP_USER..."
    sudo useradd -m -s /bin/bash $APP_USER
fi

# Create application directory
echo "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $APP_USER:$APP_USER /home/$APP_USER

# Switch to app user for deployment
sudo -u $APP_USER bash << 'EOF'
cd /home/targon/app

# Clone or update repository
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
else
    echo "Updating repository..."
    git pull origin main
fi

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Build application
echo "Building application..."
npm run build

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Stop existing process if running
pm2 stop targon-frontend || true
pm2 delete targon-frontend || true

# Start application with PM2
echo "Starting application with PM2..."
PORT=3000 pm2 start npm --name "targon-frontend" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup systemd -u targon --hp /home/targon || true
EOF

# Update nginx configuration
echo "Updating nginx configuration..."
sudo tee /etc/nginx/sites-available/targon-frontend << 'NGINX_EOF'
# Add this to the existing server block for targonglobal.com

# Main website (Targon Global frontend) - serves at root /
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

# Next.js static files for main site
location /_next/static {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Cache static assets
    expires 1y;
    add_header Cache-Control "public, immutable";
}
NGINX_EOF

# The nginx config for WMS should remain unchanged at /WMS/

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update REPO_URL in this script with your GitHub repository"
echo "2. Verify the site is accessible at https://targonglobal.com"
echo "3. WMS should still be accessible at https://targonglobal.com/WMS/"
echo ""
echo "🔍 To check status:"
echo "   pm2 status"
echo "   pm2 logs targon-frontend"
echo "   sudo systemctl status nginx"