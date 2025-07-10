# Targon Global Frontend Deployment Guide

This guide explains how to deploy the Targon Global frontend alongside the existing WMS application.

## Architecture Overview

- **Main Site**: Runs on port 3000, accessible at https://www.targonglobal.com
- **WMS Application**: Runs on port 3001, accessible at https://www.targonglobal.com/WMS
- **Web Server**: Nginx reverse proxy handles routing
- **Process Manager**: PM2 manages Node.js applications

## Prerequisites

1. Ubuntu/Debian server with:
   - Node.js 18.x or higher
   - npm
   - nginx
   - git
   - PM2 (will be installed by setup script)

2. Domain configuration:
   - Domain pointing to server IP
   - SSL certificates (Let's Encrypt recommended)

## Initial Server Setup

1. **SSH into your server** and run:
   ```bash
   cd /tmp
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO/deployment
   ./setup-server.sh
   ```

2. **Update GitHub repository URL** in the setup script before running

3. **Set up SSL certificates**:
   ```bash
   sudo certbot --nginx -d targonglobal.com -d www.targonglobal.com
   ```

## GitHub Actions Configuration

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

- `EC2_SSH_KEY`: Private SSH key for server access
- `EC2_HOST`: Server IP address or hostname
- `EC2_USER`: SSH username (e.g., ubuntu)
- `PRODUCTION_URL`: https://www.targonglobal.com

## Manual Deployment

If you need to deploy manually:

```bash
cd /var/www/targonglobal
git pull origin main
npm ci --production
npm run build
pm2 restart targon-frontend
```

## Port Configuration

Ensure these ports are configured correctly:

- **Port 3000**: Targon Global frontend (this application)
- **Port 3001**: WMS application (existing)
- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: HTTPS

## Nginx Configuration

The nginx configuration handles:
- SSL termination
- HTTP to HTTPS redirect
- Routing to main site (/)
- Routing to WMS (/WMS)
- Static file caching
- Security headers

## Monitoring

### Check application status:
```bash
pm2 status
pm2 logs targon-frontend
```

### Check nginx logs:
```bash
sudo tail -f /var/log/nginx/targonglobal.access.log
sudo tail -f /var/log/nginx/targonglobal.error.log
```

## Troubleshooting

### Application not starting:
```bash
pm2 logs targon-frontend --lines 100
```

### Nginx configuration issues:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Port conflicts:
```bash
sudo lsof -i :3000
sudo lsof -i :3001
```

## Important Notes

1. **Do not modify WMS configuration** - The WMS application should continue running on port 3001
2. **Backup before deployment** - Always backup your configuration before making changes
3. **Test locally first** - Run `npm run build` locally to ensure no build errors

## Environment Variables

The application uses these environment variables in production:

- `NODE_ENV=production`
- `PORT=3000`

Add any additional environment variables to the PM2 ecosystem file.

## Security Considerations

1. Keep dependencies updated: `npm audit fix`
2. Use strong SSL configuration
3. Implement rate limiting for API endpoints
4. Regular security updates: `sudo apt update && sudo apt upgrade`

## Support

For issues or questions:
- Check PM2 logs: `pm2 logs`
- Check nginx error logs
- Verify DNS configuration
- Ensure firewall allows ports 80 and 443