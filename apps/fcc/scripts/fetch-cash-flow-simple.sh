#!/bin/bash

# Simple test to fetch cash flow data
echo "Fetching Cash Flow data with simple date range..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

echo "1. Testing July 2025 (current month)..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-07-01&toDate=2025-07-31&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" \
  -o /tmp/cash-flow-2025-07.json

if [ -s /tmp/cash-flow-2025-07.json ]; then
  source=$(jq -r '.source' /tmp/cash-flow-2025-07.json 2>/dev/null)
  error=$(jq -r '.error' /tmp/cash-flow-2025-07.json 2>/dev/null)
  
  if [[ "$error" != "null" ]]; then
    echo "✗ Error: $error"
    jq '.details' /tmp/cash-flow-2025-07.json 2>/dev/null
  elif [[ "$source" == "xero" ]]; then
    echo "✓ Got data from Xero!"
    jq '{totalNetCashFlow, netOperatingCashFlow, source}' /tmp/cash-flow-2025-07.json 2>/dev/null
  else
    echo "Source: $source"
  fi
fi

echo ""
echo "2. Testing June 2025 (last month)..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-06-01&toDate=2025-06-30&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" \
  -o /tmp/cash-flow-2025-06.json

if [ -s /tmp/cash-flow-2025-06.json ]; then
  source=$(jq -r '.source' /tmp/cash-flow-2025-06.json 2>/dev/null)
  error=$(jq -r '.error' /tmp/cash-flow-2025-06.json 2>/dev/null)
  
  if [[ "$error" != "null" ]]; then
    echo "✗ Error: $error"
    jq '.details' /tmp/cash-flow-2025-06.json 2>/dev/null
  elif [[ "$source" == "xero" ]]; then
    echo "✓ Got data from Xero!"
    jq '{totalNetCashFlow, netOperatingCashFlow, source}' /tmp/cash-flow-2025-06.json 2>/dev/null
  else
    echo "Source: $source"
  fi
fi

echo ""
echo "3. Checking development.log for errors..."
tail -20 development.log | grep -i "error\|fail\|exception" || echo "No recent errors found"
