#!/bin/bash

# Fetch real Cash Flow data using the cash-flow API endpoint with forceRefresh
echo "Fetching real Cash Flow data from API with forceRefresh=true..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

periods=(
  "2023-06-01:2023-06-30"
  "2023-07-01:2023-07-31"
  "2023-08-01:2023-08-31"
  "2023-09-01:2023-09-30"
  "2023-10-01:2023-10-31"
  "2023-11-01:2023-11-30"
  "2023-12-01:2023-12-31"
  "2024-01-01:2024-01-31"
  "2024-02-01:2024-02-29"
  "2024-03-01:2024-03-31"
  "2024-04-01:2024-04-30"
  "2024-05-01:2024-05-31"
)

mkdir -p cash-flow-data

for period in "${periods[@]}"; do
  IFS=':' read -r from_date to_date <<< "$period"
  echo ""
  echo "Fetching Cash Flow for $from_date to $to_date..."
  
  response=$(curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=$from_date&toDate=$to_date&forceRefresh=true" \
    -H "Accept: application/json" \
    -H "Cookie: $COOKIES")
  
  echo "$response" | jq '.' > "cash-flow-data/cash-flow-$from_date.json" 2>/dev/null
  
  source=$(echo "$response" | jq -r '.source' 2>/dev/null)
  
  if [[ "$source" == "xero" ]]; then
    echo "✓ Got REAL data from Xero API!"
    total_net=$(echo "$response" | jq -r '.totalNetCashFlow' 2>/dev/null)
    operating=$(echo "$response" | jq -r '.netOperatingCashFlow' 2>/dev/null)
    echo "  Total Net Cash Flow: $total_net"
    echo "  Operating Cash Flow: $operating"
  elif [[ "$source" == "database" ]]; then
    echo "⚠️  Got cached data from database"
  else
    echo "✗ Failed to get data"
  fi
  
  sleep 2
done

echo ""
echo "Checking database for newly imported records..."
sqlite3 prisma/dev.db "
  SELECT 
    datetime(importedAt/1000, 'unixepoch') as imported_time,
    status,
    recordCount,
    json_extract(filters, '$.dateRange.from') as from_date,
    json_extract(filters, '$.dateRange.to') as to_date
  FROM ImportedReport 
  WHERE type='CASH_FLOW' 
  AND datetime(importedAt/1000, 'unixepoch') > datetime('now', '-10 minutes')
  ORDER BY importedAt DESC;
"

echo ""
echo "Cash Flow data saved to cash-flow-data/ directory"
