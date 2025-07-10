# Deployment Instructions for Targon Global Frontend

Based on the server analysis, here's how to deploy the new Targon Global frontend to your existing EC2 instance.

## Server Details
- **IP**: 54.204.215.11
- **Current Setup**: WMS running on port 3001 at `/WMS/` path
- **Available**: Port 3000 and root path `/` (currently returns 404)

## Deployment Options

### Option 1: GitHub Actions (Automated)

1. **Add GitHub Secrets** (Settings → Secrets → Actions):
   - `EC2_SSH_KEY`: Your SSH private key content
   - `EC2_HOST`: 54.204.215.11
   - `EC2_USER`: ubuntu (or your SSH user)
   - `PRODUCTION_URL`: https://targonglobal.com

2. **Update Repository URL** in `.github/workflows/deploy.yml`

3. **Push to main branch** to trigger deployment

### Option 2: Manual Deployment

1. **Copy files to server**:
   ```bash
   scp -r ./* ubuntu@54.204.215.11:/tmp/targon-frontend/
   ```

2. **SSH into server**:
   ```bash
   ssh ubuntu@54.204.215.11
   ```

3. **Run deployment script**:
   ```bash
   cd /tmp/targon-frontend
   chmod +x deployment/deploy-manual.sh
   ./deployment/deploy-manual.sh
   ```

4. **Update nginx configuration**:
   - The existing nginx config needs to be updated to route `/` to port 3000
   - Add the location blocks from `deployment/nginx-update.conf` to the existing server block
   - DO NOT remove the existing `/WMS/` configuration

## Important Notes

1. **Port Configuration**:
   - Frontend: Port 3000 (new)
   - WMS: Port 3001 (existing, don't change)

2. **URL Structure**:
   - Main site: https://targonglobal.com/
   - WMS: https://targonglobal.com/WMS/

3. **User Setup**:
   - The deployment creates a new `targon` user for the frontend
   - WMS continues to run under the `wms` user

4. **PM2 Processes**:
   - `targon-frontend`: New frontend (port 3000)
   - `wms-app`: Existing WMS (port 3001)

## Quick Deployment Commands

If you want to deploy quickly:

```bash
# On your local machine
git add .
git commit -m "Deploy Targon Global frontend"
git push origin main

# On the server (as ubuntu user)
cd /home/targon/app
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
npm ci --production
npm run build
PORT=3000 pm2 start npm --name "targon-frontend" -- start
pm2 save

# Update nginx (add the location blocks to existing config)
sudo nano /etc/nginx/sites-available/default
# Add the location blocks from nginx-update.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

After deployment:
1. Check main site: https://targonglobal.com
2. Verify WMS still works: https://targonglobal.com/WMS/
3. Monitor logs: `pm2 logs targon-frontend`

## Troubleshooting

- If port 3000 is occupied: `sudo lsof -i :3000`
- Check PM2 status: `pm2 status`
- View nginx error log: `sudo tail -f /var/log/nginx/error.log`
- Ensure proper permissions: `sudo chown -R targon:targon /home/targon/app`