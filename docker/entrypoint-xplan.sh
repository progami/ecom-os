#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running Prisma generate for X-Plan..."
  pnpm prisma:generate
  echo "Applying schema updates (prisma:push)..."
  pnpm prisma:push
else
  echo "DATABASE_URL not set, skipping Prisma steps."
fi

exec "$@"
