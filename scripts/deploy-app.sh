#!/usr/bin/env bash
# Deploy script for CI/CD - pulls, clears caches, builds, and restarts an app
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: deploy-app.sh <app-key> <environment>" >&2
  echo "  app-key: wms, ecomos, website, xplan, hrms" >&2
  echo "  environment: dev, main" >&2
  exit 1
fi

app_key="$1"
environment="$2"

# Determine directories based on environment
if [[ "$environment" == "dev" ]]; then
  REPO_DIR="${ECOM_OS_DEV_DIR:-/Users/jarraramjad/ecom-os-dev}"
  PM2_PREFIX="dev"
  BRANCH="dev"
elif [[ "$environment" == "main" ]]; then
  REPO_DIR="${ECOM_OS_MAIN_DIR:-/Users/jarraramjad/ecom-os-main}"
  PM2_PREFIX="main"
  BRANCH="main"
else
  echo "Unknown environment: $environment" >&2
  exit 1
fi

# Map app keys to workspace names and directories
case "$app_key" in
  wms)
    workspace="@ecom-os/wms"
    app_dir="$REPO_DIR/apps/wms"
    pm2_name="${PM2_PREFIX}-wms"
    prisma_cmd="pnpm --filter $workspace db:generate"
    build_cmd="pnpm --filter $workspace build"
    ;;
  ecomos)
    workspace="@ecom-os/ecomos"
    app_dir="$REPO_DIR/apps/ecomos"
    pm2_name="${PM2_PREFIX}-ecomos"
    prisma_cmd=""
    build_cmd="pnpm --filter $workspace build"
    ;;
  website)
    workspace="@ecom-os/website"
    app_dir="$REPO_DIR/apps/website"
    pm2_name="${PM2_PREFIX}-website"
    prisma_cmd=""
    build_cmd="pnpm --filter $workspace build"
    ;;
  xplan|x-plan)
    workspace="@ecom-os/x-plan"
    app_dir="$REPO_DIR/apps/x-plan"
    pm2_name="${PM2_PREFIX}-x-plan"
    prisma_cmd="pnpm --filter $workspace prisma:generate"
    build_cmd="pnpm --filter $workspace build"
    ;;
  hrms)
    workspace="@ecom-os/hrms"
    app_dir="$REPO_DIR/apps/hrms"
    pm2_name="${PM2_PREFIX}-hrms"
    prisma_cmd="cd $app_dir && npx prisma generate"
    build_cmd="cd $app_dir && pnpm run build"
    ;;
  *)
    echo "Unknown app key: $app_key" >&2
    exit 1
    ;;
esac

log() { printf '\033[36m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*"; }
warn() { printf '\033[33m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*"; }
error() { printf '\033[31m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*" >&2; }

log "=========================================="
log "Starting deployment of $app_key to $environment"
log "Repository: $REPO_DIR"
log "App directory: $app_dir"
log "PM2 process: $pm2_name"
log "=========================================="

# Step 1: Pull latest code
log "Step 1: Pulling latest code from $BRANCH branch"
cd "$REPO_DIR"
git fetch origin "$BRANCH" --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
log "Git pull complete"

# Step 2: Install dependencies
log "Step 2: Installing dependencies"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
log "Dependencies installed"

# Step 3: Generate Prisma client if needed
if [[ -n "$prisma_cmd" ]]; then
  log "Step 3: Generating Prisma client"
  cd "$REPO_DIR"
  eval "$prisma_cmd" || warn "Prisma generate had warnings"
  log "Prisma client generated"
else
  log "Step 3: Skipping Prisma generation (not needed)"
fi

# Step 4: Stop PM2 app
log "Step 4: Stopping $pm2_name"
pm2 stop "$pm2_name" 2>/dev/null || warn "$pm2_name was not running"

# Step 5: Clear build caches (keep .next for incremental builds)
log "Step 5: Clearing build caches (preserving Next.js cache)"
rm -rf "$app_dir/.turbo" \
       "$app_dir/.cache" \
       "$app_dir/.swc" \
       "$app_dir/node_modules/.cache" \
       2>/dev/null || true
log "Caches cleared (Next.js cache preserved for faster builds)"

# Step 6: Build the app
log "Step 6: Building $app_key"
cd "$REPO_DIR"
eval "$build_cmd"
log "Build complete"

# Step 7: Restart PM2 app
log "Step 7: Starting $pm2_name"
pm2 start "$pm2_name" --update-env 2>/dev/null || pm2 restart "$pm2_name" --update-env
log "$pm2_name started"

# Step 8: Save PM2 state
log "Step 8: Saving PM2 state"
pm2 save
log "PM2 state saved"

log "=========================================="
log "Deployment complete for $app_key to $environment"
log "=========================================="
