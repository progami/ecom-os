#!/bin/bash

# Test if we can fetch Bank Summary data directly
echo "Testing Bank Summary API endpoint..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

# Test a specific period
echo "Testing Bank Summary for 2024-05-01 to 2024-05-31..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-summary?fromDate=2024-05-01&toDate=2024-05-31" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.'

echo ""
echo "Checking if we can access the cash-summary endpoint..."
response=$(curl -k -s -w "\n%{http_code}" "https://localhost:3003/api/v1/xero/reports/cash-summary?fromDate=2024-05-01&toDate=2024-05-31" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES")
  
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

echo "HTTP Status Code: $http_code"
if [[ "$http_code" == "200" ]]; then
  echo "✓ Successfully accessed cash-summary endpoint"
  accounts=$(echo "$body" | jq -r '.accounts | length' 2>/dev/null || echo "0")
  echo "Accounts found: $accounts"
else
  echo "✗ Failed to access cash-summary endpoint"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
fi
