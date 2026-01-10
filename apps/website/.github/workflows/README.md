# Master Repository Workflows

This repository uses shared workflows from [progami/shared-workflows](https://github.com/progami/shared-workflows) to reduce code duplication and maintain consistency across all Targon repositories.

## Workflows

### CI (`ci.yml`)
- **Trigger**: Push to main/dev branches or pull requests to main
- **Purpose**: Run linting and build checks
- **Shared Workflow**: `ci-base.yml`
- **Configuration**:
  - Node.js 18
  - TypeScript checking disabled (no TypeScript in this project)
  - Production build environment

### Deploy (`deploy.yml`)
- **Trigger**: After successful CI on main branch or manual dispatch
- **Purpose**: Deploy application to production server
- **Shared Workflow**: `deploy-ssh.yml`
- **Configuration**:
  - PM2 app name: `targon-frontend`
  - Deployment path: `/home/targon`
  - Health check: https://targonglobal.com
  - Node.js 18

### PR Checks (`pr-checks.yml`)
- **Trigger**: Pull request events
- **Purpose**: Validate PR format, add size labels, and analyze changes
- **Shared Workflow**: `pr-checks.yml`
- **Features**:
  - Conventional commit title validation
  - Automatic size labeling
  - File change analysis
  - Sensitive file detection

## Required Secrets

- `SERVER_HOST`: Production server hostname/IP
- `SERVER_USER`: SSH username for deployment
- `SERVER_SSH_KEY`: SSH private key for deployment

## Migration Notes

- Migrated from standalone workflows to shared workflows on $(date +%Y-%m-%d)
- Original workflows backed up with the same functionality
- Deployment process remains unchanged (PM2 restart)
- Health checks continue to verify https://targonglobal.com