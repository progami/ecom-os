#!/bin/bash

# Trigger real Xero sync using the sync endpoint
echo "Triggering Xero sync for Cash Flow reports..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

# Fetch bank summary (cash summary) endpoint directly for various months
echo "Fetching bank summary data from Xero..."

periods=(
  "2023-06-01:2023-06-30"
  "2023-12-01:2023-12-31"
  "2024-01-01:2024-01-31"
  "2024-05-01:2024-05-31"
)

for period in "${periods[@]}"; do
  IFS=':' read -r from_date to_date <<< "$period"
  echo ""
  echo "Fetching for $from_date to $to_date..."
  
  response=$(curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-summary?fromDate=$from_date&toDate=$to_date" \
    -H "Accept: application/json" \
    -H "Cookie: $COOKIES")
  
  if echo "$response" | jq -e '.accounts | length > 0' >/dev/null 2>&1; then
    echo "✓ Got real bank data!"
    accounts=$(echo "$response" | jq -r '.accounts | length')
    total_movement=$(echo "$response" | jq -r '[.accounts[].netMovement] | add')
    echo "  Accounts: $accounts"
    echo "  Total Net Movement: $total_movement"
    
    echo "  Fetching transformed Cash Flow..."
    curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=$from_date&toDate=$to_date&forceRefresh=true" \
      -H "Accept: application/json" \
      -H "Cookie: $COOKIES" \
      > /tmp/real-cash-flow-$from_date.json
  else
    echo "✗ No real data returned"
  fi
done

echo ""
echo "Checking database for imported records..."
sqlite3 prisma/dev.db "SELECT COUNT(*) as count, MAX(datetime(importedAt/1000, 'unixepoch')) as latest FROM ImportedReport WHERE type='CASH_FLOW' AND status='COMPLETED';"
