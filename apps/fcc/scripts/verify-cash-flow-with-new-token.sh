#!/bin/bash

# Verify Cash Flow with new Xero token
echo "Testing Cash Flow API with new Xero token..."
echo "Token expires at: 2025-07-02T23:40:20.000Z"
echo ""

if [ -z "${COOKIES:-}" ]; then
  echo "ERROR: COOKIES env var not set. Export COOKIES (session + xero token) for testing." >&2
  exit 1
fi

# Test periods matching the Excel file (Jan-May 2025)
periods=(
  "2025-01-01:2025-01-31:January 2025"
  "2025-02-01:2025-02-28:February 2025"
  "2025-03-01:2025-03-31:March 2025"
  "2025-04-01:2025-04-30:April 2025"
  "2025-05-01:2025-05-31:May 2025"
)

echo "Fetching Cash Flow data for periods in Excel file..."
echo "=========================================="

for period in "${periods[@]}"; do
  IFS=':' read -r from_date to_date label <<< "$period"
  echo ""
  echo "Fetching $label ($from_date to $to_date)..."
  
  # Fetch with forceRefresh to get real data from Xero
  response=$(curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=$from_date&toDate=$to_date&forceRefresh=true" \
    -H "Accept: application/json" \
    -H "Cookie: $COOKIES")
  
  # Save response
  echo "$response" > "/tmp/cash-flow-$from_date.json"
  
  # Check if we got real data
  source=$(echo "$response" | jq -r '.source' 2>/dev/null)
  error=$(echo "$response" | jq -r '.error' 2>/dev/null)
  
  if [[ "$error" != "null" ]]; then
    echo "✗ Error: $error"
  elif [[ "$source" == "xero" ]]; then
    echo "✓ Got real data from Xero!"
    
    # Extract key figures
    totalNetCashFlow=$(echo "$response" | jq -r '.totalNetCashFlow' 2>/dev/null)
    openingBalance=$(echo "$response" | jq -r '.openingBalance' 2>/dev/null)
    closingBalance=$(echo "$response" | jq -r '.closingBalance' 2>/dev/null)
    
    echo "  Opening Balance: £$openingBalance"
    echo "  Net Cash Flow: £$totalNetCashFlow"
    echo "  Closing Balance: £$closingBalance"
    
    # Show account details if available
    accountCount=$(echo "$response" | jq -r '.accounts | length' 2>/dev/null)
    if [[ "$accountCount" -gt 0 ]]; then
      echo "  Accounts found: $accountCount"
      echo "$response" | jq -r '.accounts[] | "    - \(.accountName): £\(.closingBalance)"' 2>/dev/null | head -5
    fi
  else
    echo "  Source: $source (cached data)"
  fi
done

echo ""
echo "=========================================="
echo "Expected values from Excel file:"
echo "  January 2025: £126,623.04"
echo "  February 2025: £131,623.01"
echo "  March 2025: £160,835.86"
echo "  April 2025: £182,387.67"
echo "  May 2025: £179,272.78"
