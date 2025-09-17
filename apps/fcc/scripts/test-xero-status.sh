#!/bin/bash

# Test Xero connection status
echo "Testing Xero connection status..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

echo "1. Checking Xero status endpoint..."
curl -k -s "https://localhost:3003/api/v1/xero/status" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.'

echo ""
echo "2. Checking current time..."
date

echo ""
echo "3. Checking token expiry..."
expires_at=1751476898
current_time=$(date +%s)
if [ $current_time -lt $expires_at ]; then
  echo "✓ Token is still valid (expires at $(date -d @$expires_at 2>/dev/null || date -r $expires_at))"
else
  echo "✗ Token has expired"
fi

echo ""
echo "4. Testing P&L endpoint (which was working)..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/profit-loss?fromDate=2024-05-01&toDate=2024-05-31" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.revenue, .expenses' 2>/dev/null && echo "✓ P&L endpoint working" || echo "✗ P&L endpoint failed"
