HRMS Deployment (EC2 + Postgres + S3)

Overview
- Runtime: Next.js (custom server.js, PM2/Nginx; WMS-aligned)
- DB: Postgres via Prisma (`DATABASE_URL`)
- Files: S3 (bucket already created)

Environment Variables
- DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
- S3_REGION=us-east-1
- S3_BUCKET=hrms-ecom-os-dev-ACCOUNT
- S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (or use an EC2 instance role)

Build & Run
1) Install deps: npm ci
2) Generate Prisma: npx prisma generate
3) Build: npm run build
4) Migrate: npx prisma migrate deploy
5) Start (custom server): npm run start (uses server.js, port 3006)

EC2 Guidance (WMS-aligned)
- Use an EC2 Instance Role (no access keys in code):
  - s3:PutObject, s3:GetObject, s3:DeleteObject for the HRMS bucket
  - ssm:GetParameter (if storing secrets in SSM)
- Keep env files per env: .env.production, .env.development (server.js loads by NODE_ENV)
- Prefer Nginx reverse proxy → PM2 app (see ecosystem.config.js)
- Security group: allow ALB/Nginx (80/443) and internal 3006 if needed

PM2 Example
[Install]
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow instructions

Systemd Example (alternative)
[Unit]
Description=HRMS Service
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
EnvironmentFile=/etc/hrms.env
WorkingDirectory=/opt/apps/hrms
ExecStart=/usr/bin/npm run start --silent
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target

S3 Notes
- Bucket created: see .env S3_BUCKET.
- For production, prefer instance role instead of static keys.
