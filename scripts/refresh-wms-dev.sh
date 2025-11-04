#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_dir="$repo_root/apps/wms"

info() { printf '\e[36m[refresh-wms-dev]\e[0m %s\n' "$*"; }
warn() { printf '\e[33m[refresh-wms-dev]\e[0m %s\n' "$*"; }

info "Stopping wms-dev (if running)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop wms-dev >/dev/null 2>&1 || warn "wms-dev was not running"
else
  warn "pm2 is not available on PATH; skipping process stop"
fi

info "Cleaning Next.js build artifacts"
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @ecom-os/wms clean >/dev/null 2>&1 || warn "pnpm clean failed; falling back to manual cleanup"
else
  warn "pnpm not found; falling back to manual cleanup"
fi
rm -rf "$app_dir/.next" "$app_dir/.turbo" "$app_dir/.cache" "$app_dir/.swc" "$app_dir/.servenext" 2>/dev/null || true

info "Restarting wms-dev with a fresh build cache"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 start wms-dev --update-env >/dev/null 2>&1; then
    info "wms-dev started"
  elif pm2 restart wms-dev --update-env >/dev/null 2>&1; then
    info "wms-dev restarted"
  else
    warn "Could not start or restart wms-dev via pm2; please check process configuration"
  fi
else
  warn "pm2 is not available on PATH; start wms-dev manually"
fi

info "Done"
