#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running Prisma generate for WMS..."
  pnpm db:generate
  echo "Applying schema updates (db:push)..."
  pnpm db:push
else
  echo "DATABASE_URL not set, skipping Prisma steps."
fi

exec "$@"
