# Automated Release & Deployment

## Overview

This system now supports automated releases and deployments through GitHub Actions.

## How It Works

### 1. PR Merge → Version Bump
When a PR is merged to main:
- **Version Bump Workflow** automatically determines version increment:
  - `BREAKING CHANGE` or `!` in title → Major version (1.0.0 → 2.0.0)
  - `feat` in title → Minor version (1.0.0 → 1.1.0)
  - Everything else → Patch version (1.0.0 → 1.0.1)
- Commits the version change with `[skip ci]` to avoid loops

### 2. Version Change → Auto Release
When version changes in package.json:
- **CI Workflow** detects version change
- Creates a GitHub release with auto-generated notes
- Tags the commit with the new version

### 3. Release → Auto Deploy
When a release is published:
- **Deploy Workflow** automatically triggers
- Deploys to production server
- Runs health checks
- Rolls back on failure

## Setup Required

### GitHub Secrets Configuration

Go to Settings → Secrets and variables → Actions and add:

#### Required Secrets:
```
SERVER_HOST=your-server-ip
SERVER_USER=ubuntu
SERVER_SSH_KEY=<your-private-ssh-key>
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.com
```

#### Optional Secrets:
```
NODE_ENV=production
PORT=3001
LOG_DIR=/home/ubuntu/wms-ecomos/logs
S3_BUCKET_NAME=your-bucket
S3_BUCKET_REGION=us-east-1
AWS_REGION=us-east-1
```

### Server Setup

Ensure your server has:
1. Node.js 20+ installed
2. PM2 installed globally
3. PostgreSQL accessible
4. Application cloned at `/home/ubuntu/wms-ecomos`
5. PM2 ecosystem config or app named `wms-app-ubuntu`

## Manual Controls

### Trigger Deployment Manually
1. Go to Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Choose environment (production/staging)

### Skip Auto-deployment
Add `[skip deploy]` to your commit message

### Force Version Type
Use PR labels:
- `breaking` → Major version
- `enhancement` → Minor version
- `bug` → Patch version

## Workflow Files

- `.github/workflows/version-bump.yml` - Auto version bumping
- `.github/workflows/ci.yml` - CI and auto-release
- `.github/workflows/deploy.yml` - Auto deployment

## Monitoring

- Check Actions tab for workflow status
- Each PR shows version bump in comments
- Deployment status shown in GitHub deployments
- Health checks verify deployment success

## Rollback

If deployment fails:
1. Automatic rollback occurs
2. Previous build is restored
3. PM2 reloads with old version
4. Manual intervention may be needed

## Best Practices

1. **Use Conventional Commits**:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `chore:` for maintenance
   - `BREAKING CHANGE:` for breaking changes

2. **Test Before Merging**:
   - All CI checks must pass
   - Review deployment logs

3. **Monitor After Deploy**:
   - Check health endpoint
   - Monitor logs with `pm2 logs`
   - Verify functionality

## Troubleshooting

### Version not bumping?
- Check if PR title follows conventions
- Verify workflow has write permissions

### Deployment failing?
- Check GitHub Secrets are set
- Verify SSH key has access
- Check PM2 is running on server

### Release not created?
- Ensure version in package.json changed
- Check CI workflow completed successfully