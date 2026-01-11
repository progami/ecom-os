#!/usr/bin/env bash
# Deploy script for CI/CD - pulls, clears caches, builds, and restarts an app
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: deploy-app.sh <app-key> <environment>" >&2
  echo "  app-key: talos, sso, website, xplan, kairos, atlas, plutus" >&2
  echo "  environment: dev, main" >&2
  exit 1
fi

app_key="$1"
environment="$2"

is_truthy() {
  case "${1:-}" in
    [Tt][Rr][Uu][Ee] | 1 | [Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

skip_git="${DEPLOY_SKIP_GIT:-false}"
skip_install="${DEPLOY_SKIP_INSTALL:-false}"
skip_pm2_save="${DEPLOY_SKIP_PM2_SAVE:-false}"
deploy_git_sha="${DEPLOY_GIT_SHA:-}"
migrate_cmd=""

# Determine directories based on environment
if [[ "$environment" == "dev" ]]; then
  REPO_DIR="${TARGONOS_DEV_DIR:-${TARGON_DEV_DIR:-/Users/jarraramjad/targonos-dev}}"
  PM2_PREFIX="dev"
  BRANCH="dev"
elif [[ "$environment" == "main" ]]; then
  REPO_DIR="${TARGONOS_MAIN_DIR:-${TARGON_MAIN_DIR:-/Users/jarraramjad/targonos-main}}"
  PM2_PREFIX="main"
  BRANCH="main"
else
  echo "Unknown environment: $environment" >&2
  exit 1
fi

# Map app keys to workspace names and directories
case "$app_key" in
  talos)
    workspace="@targon/talos"
    app_dir="$REPO_DIR/apps/talos"
    pm2_name="${PM2_PREFIX}-talos"
    legacy_app_dir="$REPO_DIR/apps/wms"
    legacy_pm2_name="${PM2_PREFIX}-wms"
    prisma_cmd="pnpm --filter $workspace db:generate"
    migrate_cmd="pnpm --filter $workspace db:migrate:tenant-schema && pnpm --filter $workspace db:migrate:sku-dimensions && pnpm --filter $workspace db:migrate:sku-batch-attributes && pnpm --filter $workspace db:migrate:sku-batch-amazon-defaults && pnpm --filter $workspace db:migrate:supplier-defaults && pnpm --filter $workspace db:migrate:warehouse-sku-storage-configs && pnpm --filter $workspace db:migrate:purchase-order-documents && pnpm --filter $workspace db:migrate:fulfillment-orders-foundation"
    build_cmd="pnpm --filter $workspace build"
    ;;
  sso|targon|targonos)
    workspace="@targon/sso"
    app_dir="$REPO_DIR/apps/sso"
    pm2_name="${PM2_PREFIX}-targonos"
    prisma_cmd=""
    build_cmd="pnpm --filter $workspace build"
    ;;
  website)
    workspace="@targon/website"
    app_dir="$REPO_DIR/apps/website"
    pm2_name="${PM2_PREFIX}-website"
    prisma_cmd=""
    build_cmd="pnpm --filter $workspace build"
    ;;
  xplan|x-plan)
    workspace="@targon/x-plan"
    app_dir="$REPO_DIR/apps/x-plan"
    pm2_name="${PM2_PREFIX}-x-plan"
    prisma_cmd="pnpm --filter $workspace prisma:generate"
    migrate_cmd="pnpm --filter $workspace prisma:migrate:deploy"
    build_cmd="pnpm --filter $workspace build"
    ;;
  kairos)
    workspace="@targon/kairos"
    app_dir="$REPO_DIR/apps/kairos"
    pm2_name="${PM2_PREFIX}-kairos"
    prisma_cmd="pnpm --filter $workspace prisma:generate"
    migrate_cmd="pnpm --filter $workspace prisma:migrate:deploy"
    build_cmd="pnpm --filter $workspace build"
    ;;
  atlas)
    workspace="@targon/atlas"
    app_dir="$REPO_DIR/apps/atlas"
    pm2_name="${PM2_PREFIX}-atlas"
    prisma_cmd="cd $app_dir && npx prisma generate"
    migrate_cmd="cd $app_dir && pnpm run db:migrate:deploy --schema prisma/schema.prisma"
    build_cmd="cd $app_dir && pnpm run build"
    ;;
  plutus)
    workspace="@targon/plutus"
    app_dir="$REPO_DIR/apps/plutus"
    pm2_name="${PM2_PREFIX}-plutus"
    prisma_cmd=""
    build_cmd="pnpm --filter $workspace build"
    ;;
  *)
    echo "Unknown app key: $app_key" >&2
    exit 1
    ;;
esac

kairos_ml_dir=""
kairos_ml_pm2_name=""
kairos_ml_port=""

if [[ "$app_key" == "kairos" ]]; then
  kairos_ml_dir="$REPO_DIR/services/kairos-ml"
  kairos_ml_pm2_name="${PM2_PREFIX}-kairos-ml"
  if [[ "$environment" == "dev" ]]; then
    kairos_ml_port="3111"
  else
    kairos_ml_port="3011"
  fi
fi

log() { printf '\033[36m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*"; }
warn() { printf '\033[33m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*"; }
error() { printf '\033[31m[deploy-%s-%s]\033[0m %s\n' "$app_key" "$environment" "$*" >&2; }

load_env_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 1
  fi

  # Parse dotenv-style env files safely (values may contain '&', '?', etc.).
  # Avoid `source`, which treats those characters as shell operators.
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
      continue
    fi

    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="${line#"${line%%[![:space:]]*}"}"
    fi

    if [[ "$line" != *"="* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"

    if [[ -z "$key" || ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value#\"}"
      value="${value%\"}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value#\'}"
      value="${value%\'}"
    fi

    export "${key}=${value}"
  done < "$file"

  return 0
}

set_env_var_in_file() {
  local file="$1"
  local key="$2"
  local value="$3"

  local tmp
  tmp="$(mktemp)"

  local found=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "${key}="* || "$line" == "export ${key}="* ]]; then
      printf '%s=%s\n' "$key" "$value" >> "$tmp"
      found=1
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < "$file"

  if [[ "$found" -eq 0 ]]; then
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  mv "$tmp" "$file"
}

bootstrap_talos_env_local_if_missing() {
  if [[ "$app_key" != "talos" ]]; then
    return 0
  fi

  if [[ -z "${legacy_app_dir:-}" || -z "${app_dir:-}" ]]; then
    return 0
  fi

  if [[ ! -d "$legacy_app_dir" ]]; then
    return 0
  fi

  local candidates=(".env.local" ".env.production" ".env.dev" ".env")
  local file=""

  for file in "${candidates[@]}"; do
    if [[ ! -f "$app_dir/$file" && -f "$legacy_app_dir/$file" ]]; then
      warn "Migrating ${file} from legacy Talos directory"
      mkdir -p "$app_dir"
      cp "$legacy_app_dir/$file" "$app_dir/$file"
    fi
  done

  local env_file="$app_dir/.env.local"
  if [[ -f "$env_file" ]]; then
    local desired_base_path="/talos"
    local desired_app_url=""

    if [[ "$environment" == "dev" ]]; then
      desired_app_url="https://dev-targonos.targonglobal.com/talos"
    else
      desired_app_url="https://targonos.targonglobal.com/talos"
    fi

    set_env_var_in_file "$env_file" "BASE_PATH" "$desired_base_path"
    set_env_var_in_file "$env_file" "NEXT_PUBLIC_BASE_PATH" "$desired_base_path"
    set_env_var_in_file "$env_file" "NEXT_PUBLIC_APP_URL" "$desired_app_url"
    set_env_var_in_file "$env_file" "NEXTAUTH_URL" "$desired_app_url"
  fi
}

ensure_database_url() {
  if [[ -n "${DATABASE_URL:-}" || -n "${DATABASE_URL_US:-}" || -n "${DATABASE_URL_UK:-}" ]]; then
    return 0
  fi

  bootstrap_talos_env_local_if_missing

  # Match Next.js env precedence: .env.local overrides everything in production.
  local candidates=("$app_dir/.env.local" "$app_dir/.env.production" "$app_dir/.env.dev" "$app_dir/.env")

  for file in "${candidates[@]}"; do
    if load_env_file "$file" && [[ -n "${DATABASE_URL:-}" || -n "${DATABASE_URL_US:-}" || -n "${DATABASE_URL_UK:-}" ]]; then
      if [[ -n "${DATABASE_URL:-}" ]]; then
        log "Loaded DATABASE_URL from $(basename "$file")"
      else
        log "Loaded tenant database URLs from $(basename "$file")"
      fi
      return 0
    fi
  done

  return 1
}

log "=========================================="
log "Starting deployment of $app_key to $environment"
log "Repository: $REPO_DIR"
log "App directory: $app_dir"
log "PM2 process: $pm2_name"
log "=========================================="

# Step 1: Pull latest code
if is_truthy "$skip_git"; then
  log "Step 1: Skipping git update (DEPLOY_SKIP_GIT=$skip_git)"
else
  log "Step 1: Pulling latest code from $BRANCH branch"
  cd "$REPO_DIR"
  git fetch origin "$BRANCH" --prune
  git checkout "$BRANCH"
  if [[ -n "$deploy_git_sha" ]]; then
    log "Step 1: Resetting to pinned commit $deploy_git_sha"
    git reset --hard "$deploy_git_sha"
  else
    git reset --hard "origin/$BRANCH"
  fi
  log "Git pull complete"
fi

# Step 2: Install dependencies
if is_truthy "$skip_install"; then
  log "Step 2: Skipping dependency install (DEPLOY_SKIP_INSTALL=$skip_install)"
else
  log "Step 2: Installing dependencies"
  cd "$REPO_DIR"
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  log "Dependencies installed"
fi

if [[ "$app_key" == "kairos" ]]; then
  log "Step 2b: Installing Kairos ML service dependencies (Python)"
  if [[ ! -d "$kairos_ml_dir" ]]; then
    error "Kairos ML service directory not found: $kairos_ml_dir"
    exit 1
  fi

  cd "$kairos_ml_dir"

  python_bin=""
  if command -v python3 >/dev/null 2>&1; then
    python_bin="python3"
  elif command -v python >/dev/null 2>&1; then
    python_bin="python"
  else
    error "python3 is required to run the Kairos ML service"
    exit 1
  fi

  "$python_bin" -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt

  log "Kairos ML service dependencies installed (port ${kairos_ml_port})"
fi

# Step 3: Generate Prisma client if needed
if [[ -n "$prisma_cmd" ]]; then
  log "Step 3: Generating Prisma client"
  cd "$REPO_DIR"
  eval "$prisma_cmd" || warn "Prisma generate had warnings"
  log "Prisma client generated"
else
  log "Step 3: Skipping Prisma generation (not needed)"
fi

# Step 3b: Apply Prisma migrations if needed
if [[ -n "$migrate_cmd" ]]; then
  log "Step 3b: Applying Prisma migrations"
  if ensure_database_url; then
    cd "$REPO_DIR"
    if [[ "$app_key" == "atlas" && "$environment" == "dev" ]]; then
      if eval "$migrate_cmd"; then
        log "Migrations applied"
      else
        warn "Prisma migrate deploy failed for atlas dev; falling back to non-destructive db push"
        if eval "cd $app_dir && pnpm exec prisma db push --schema prisma/schema.prisma --skip-generate"; then
          log "Database schema synced"
        else
          error "Prisma db push failed for atlas dev; aborting deployment to avoid a broken app"
          exit 1
        fi
      fi
    else
      eval "$migrate_cmd"
      log "Migrations applied"
    fi
  else
    error "DATABASE_URL is not set and no env file found; cannot apply migrations"
    exit 1
  fi
else
  log "Step 3b: Skipping Prisma migrations (not needed)"
fi

# Step 4: Stop PM2 app
log "Step 4: Stopping $pm2_name"
pm2 stop "$pm2_name" 2>/dev/null || warn "$pm2_name was not running"

if [[ "$app_key" == "kairos" ]]; then
  log "Step 4: Stopping $kairos_ml_pm2_name"
  pm2 stop "$kairos_ml_pm2_name" 2>/dev/null || warn "$kairos_ml_pm2_name was not running"
fi

if [[ "$app_key" == "talos" && -n "${legacy_pm2_name:-}" ]]; then
  log "Step 4: Stopping legacy $legacy_pm2_name"
  pm2 stop "$legacy_pm2_name" 2>/dev/null || warn "$legacy_pm2_name was not running"
  pm2 delete "$legacy_pm2_name" 2>/dev/null || true
fi

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
if [[ "$app_key" == "kairos" ]]; then
  log "Step 7: Starting $kairos_ml_pm2_name"
  CI= \
  GITHUB_ACTIONS= \
  GITHUB_PERSONAL_ACCESS_TOKEN= \
  GITHUB_TOKEN= \
  GH_TOKEN= \
  GEMINI_API_KEY= \
  CLAUDECODE= \
  CLAUDE_CODE_ENTRYPOINT= \
  CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
  pm2 start "$kairos_ml_pm2_name" --update-env 2>/dev/null || \
  CI= \
  GITHUB_ACTIONS= \
  GITHUB_PERSONAL_ACCESS_TOKEN= \
  GITHUB_TOKEN= \
  GH_TOKEN= \
  GEMINI_API_KEY= \
  CLAUDECODE= \
  CLAUDE_CODE_ENTRYPOINT= \
  CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
  pm2 restart "$kairos_ml_pm2_name" --update-env 2>/dev/null || \
  CI= \
  GITHUB_ACTIONS= \
  GITHUB_PERSONAL_ACCESS_TOKEN= \
  GITHUB_TOKEN= \
  GH_TOKEN= \
  GEMINI_API_KEY= \
  CLAUDECODE= \
  CLAUDE_CODE_ENTRYPOINT= \
  CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
  pm2 start "$REPO_DIR/ecosystem.config.js" --only "$kairos_ml_pm2_name" --update-env
  log "$kairos_ml_pm2_name started"
fi

log "Step 7: Starting $pm2_name"
CI= \
GITHUB_ACTIONS= \
GITHUB_PERSONAL_ACCESS_TOKEN= \
GITHUB_TOKEN= \
GH_TOKEN= \
GEMINI_API_KEY= \
CLAUDECODE= \
CLAUDE_CODE_ENTRYPOINT= \
CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
pm2 start "$pm2_name" --update-env 2>/dev/null || \
CI= \
GITHUB_ACTIONS= \
GITHUB_PERSONAL_ACCESS_TOKEN= \
GITHUB_TOKEN= \
GH_TOKEN= \
GEMINI_API_KEY= \
CLAUDECODE= \
CLAUDE_CODE_ENTRYPOINT= \
CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
pm2 restart "$pm2_name" --update-env 2>/dev/null || \
CI= \
GITHUB_ACTIONS= \
GITHUB_PERSONAL_ACCESS_TOKEN= \
GITHUB_TOKEN= \
GH_TOKEN= \
GEMINI_API_KEY= \
CLAUDECODE= \
CLAUDE_CODE_ENTRYPOINT= \
CLAUDE_CODE_MAX_OUTPUT_TOKENS= \
pm2 start "$REPO_DIR/ecosystem.config.js" --only "$pm2_name" --update-env
log "$pm2_name started"

# Step 8: Save PM2 state
if is_truthy "$skip_pm2_save"; then
  log "Step 8: Skipping PM2 save (DEPLOY_SKIP_PM2_SAVE=$skip_pm2_save)"
else
  log "Step 8: Saving PM2 state"
  pm2 save
  log "PM2 state saved"
fi

log "=========================================="
log "Deployment complete for $app_key to $environment"
log "=========================================="
