#!/bin/bash
# Server setup script for Targon Global frontend deployment

set -e

echo "Setting up Targon Global frontend deployment..."

# Create application directory
sudo mkdir -p /var/www/targonglobal
sudo chown -R $USER:$USER /var/www/targonglobal

# Create log directories
sudo mkdir -p /var/log/pm2
sudo mkdir -p /var/log/nginx
sudo chown -R $USER:$USER /var/log/pm2

# Create error pages directory
sudo mkdir -p /var/www/error-pages

# Create custom 404 page
cat > /tmp/404.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Not Found | Targon Global</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 3rem;
            color: #16a34a;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            margin-bottom: 2rem;
        }
        a {
            color: #16a34a;
            text-decoration: none;
            padding: 0.75rem 2rem;
            border: 2px solid #16a34a;
            border-radius: 0.5rem;
            transition: all 0.3s;
        }
        a:hover {
            background-color: #16a34a;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>Sorry, the page you're looking for doesn't exist.</p>
        <a href="/">Return to Homepage</a>
    </div>
</body>
</html>
EOF

# Create custom 50x page
cat > /tmp/50x.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Error | Targon Global</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-size: 3rem;
            color: #dc2626;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
            margin-bottom: 2rem;
        }
        a {
            color: #16a34a;
            text-decoration: none;
            padding: 0.75rem 2rem;
            border: 2px solid #16a34a;
            border-radius: 0.5rem;
            transition: all 0.3s;
        }
        a:hover {
            background-color: #16a34a;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>500</h1>
        <h2>Server Error</h2>
        <p>We're experiencing technical difficulties. Please try again later.</p>
        <a href="/">Return to Homepage</a>
    </div>
</body>
</html>
EOF

# Move error pages
sudo mv /tmp/404.html /var/www/error-pages/
sudo mv /tmp/50x.html /var/www/error-pages/
sudo chmod 644 /var/www/error-pages/*.html

# Clone repository (if not already cloned)
if [ ! -d "/var/www/targonglobal/.git" ]; then
    cd /var/www/targonglobal
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
fi

# Install Node.js dependencies
cd /var/www/targonglobal
npm ci --production

# Build the application
npm run build

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Start the application with PM2
pm2 start ecosystem.config.js

# Setup PM2 to start on system boot
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Copy nginx configuration
sudo cp /var/www/targonglobal/deployment/nginx.conf /etc/nginx/sites-available/targonglobal.conf

# Enable the site
sudo ln -sf /etc/nginx/sites-available/targonglobal.conf /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

echo "Setup completed successfully!"
echo "Make sure to:"
echo "1. Update the GitHub repository URL in this script"
echo "2. Set up SSL certificates with Let's Encrypt"
echo "3. Configure GitHub secrets for automated deployment"
echo "4. Ensure the WMS application is running on port 3001"