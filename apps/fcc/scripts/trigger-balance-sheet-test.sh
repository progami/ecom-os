#!/bin/bash

# Clear logs
echo "" > logs/development.log

# Trigger the API call in background
if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

curl -s "http://localhost:3003/api/v1/xero/reports/balance-sheet?dev_bypass=true" \
  -H "Accept: application/json" \
  -H "Cookie: $FCC_AUTH_COOKIE" &

# Give it time to process
sleep 5

# Read the logs
echo "=== Development Logs ==="
cat logs/development.log | grep -E "(Balance|balance|xero-report-fetcher|Processing Section|Found|Row |Structure)" | tail -50

echo ""
echo "=== Full Balance Sheet Logs ==="
cat logs/development.log | tail -100
