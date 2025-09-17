#!/bin/bash

# Fetch real Cash Flow data using the provided cookies
echo "Fetching real Cash Flow data from Xero..."

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

# Define periods to fetch
periods=(
  "2024-01-01:2024-01-31"
  "2024-02-01:2024-02-29"
  "2024-03-01:2024-03-31"
  "2024-04-01:2024-04-30"
  "2024-05-01:2024-05-31"
  "2024-06-01:2024-06-30"
)

# Fetch each period
for period in "${periods[@]}"; do
  IFS=':' read -r from_date to_date <<< "$period"
  echo "Fetching Cash Flow for $from_date to $to_date..."
  
  curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=$from_date&toDate=$to_date&forceRefresh=true" \
    -H "Accept: application/json" \
    -H "Cookie: $COOKIES" \
    | jq '.' > /tmp/cash-flow-$from_date.json
  
  # Check if we got data
  if [ -s /tmp/cash-flow-$from_date.json ]; then
    echo "✓ Fetched data for $from_date to $to_date"
    jq -r '.reportName + " - Total Net Cash Flow: " + (.totalNetCashFlow | tostring) + ", Operating: " + (.netOperatingCashFlow | tostring)' /tmp/cash-flow-$from_date.json 2>/dev/null || echo "  (Processing...)"
  else
    echo "✗ No data for $from_date to $to_date"
  fi
  
  sleep 1
done

echo "Cash Flow fetch completed. Check the database for imported records."
