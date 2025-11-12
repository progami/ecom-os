#!/usr/bin/env bash
set -euo pipefail

# This hook updates the shared nginx deploy headers and optionally purges the
# Cloudflare zone cache so end users immediately receive the latest bundles.
#
# It is safe to run multiple times; each invocation overwrites the headers with
# the latest commit hashes and UTC timestamp.

DEV_ROOT=${DEV_ROOT:-/home/ec2-user/dev}
PROD_ROOT=${PROD_ROOT:-/home/ec2-user/prod}
HEADER_FILE=${NGINX_DEPLOY_HEADER_FILE:-/etc/nginx/conf.d/deploy-headers.conf}
TOKEN_FILE=${CLOUDFLARE_TOKEN_FILE:-/home/ec2-user/.cloudflare_token}
ZONE_ID=${CLOUDFLARE_ZONE_ID:-2025e49f450d3a8474f9bf191337ab82}
PURGE=${CLOUDFLARE_PURGE:-true}

timestamp=${DEPLOY_TIMESTAMP:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}

short_commit() {
  local repo=$1
  if [[ -e "$repo/.git" ]]; then
    git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo "n/a"
  else
    echo "n/a"
  fi
}

dev_commit=$(short_commit "$DEV_ROOT")
prod_commit=$(short_commit "$PROD_ROOT")

echo "Updating nginx deploy headers (dev@$dev_commit, prod@$prod_commit @ $timestamp)"
sudo tee "$HEADER_FILE" >/dev/null <<EOF
add_header X-Deploy-Commit "dev@$dev_commit,prod@$prod_commit" always;
add_header X-Deploy-Time "$timestamp" always;
EOF

sudo systemctl reload nginx

should_purge() {
  [[ "${PURGE,,}" == "true" || "${PURGE,,}" == "1" ]]
}

if should_purge; then
  if [[ -f "$TOKEN_FILE" ]]; then
    CF_TOKEN=$(tr -d '\n\r' < "$TOKEN_FILE")
    echo "Purging Cloudflare cache for zone $ZONE_ID"
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CF_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}')
    if echo "$response" | grep -q '"success":true'; then
      echo "Cloudflare purge succeeded."
    else
      echo "Cloudflare purge failed: $response" >&2
    fi
  else
    echo "Cloudflare token file ($TOKEN_FILE) not found; skipping purge." >&2
  fi
else
  echo "Cloudflare purge skipped (CLOUDFLARE_PURGE=$PURGE)."
fi
