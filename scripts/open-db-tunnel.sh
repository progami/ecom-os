#!/usr/bin/env bash
set -euo pipefail

# Opens (or refreshes) an SSH tunnel to the shared RDS instance so local tools
# can connect via localhost:6543. Requires the `targon` host entry in ~/.ssh/config.

PORT=${DB_TUNNEL_PORT:-6543}
RDS_HOST=${RDS_HOST:-targon-prod.cyx0i8s6srto.us-east-1.rds.amazonaws.com}
RDS_PORT=${RDS_PORT:-5432}
BASTION_HOST=${BASTION_HOST:-targon}

if lsof -ti TCP:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT already in use. Killing existing tunnel..."
  lsof -ti TCP:"$PORT" | xargs kill -9 || true
fi

echo "Opening tunnel: localhost:$PORT -> $RDS_HOST:$RDS_PORT via $BASTION_HOST"
ssh -fN -L "$PORT":"$RDS_HOST":"$RDS_PORT" "$BASTION_HOST"
echo "Tunnel established. Example: psql postgresql://portal_admin:<password>@localhost:$PORT/portal_db"
