#!/bin/bash

echo "=== CASH FLOW VERIFICATION TEST ==="
echo "Testing cash flow data against Excel values"
echo "Token expires at: 2025-07-02T23:40:20.000Z"
echo "Current UTC time: $(date -u)"
echo ""

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

echo "STEP 1: Testing May 2025 Cash Flow"
echo "Expected closing balance: £179,272.78"
echo "-----------------------------------------"

# First test without forceRefresh to see cached data
echo "Testing cached data..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-05-01&toDate=2025-05-31" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" \
  -o /tmp/may-cached.json

cached_source=$(jq -r '.source' /tmp/may-cached.json 2>/dev/null)
cached_closing=$(jq -r '.closingBalance' /tmp/may-cached.json 2>/dev/null)
echo "Cached - Source: $cached_source, Closing Balance: £$cached_closing"

# Now test with forceRefresh to get fresh data
echo ""
echo "Testing fresh data from Xero..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-05-01&toDate=2025-05-31&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" \
  -o /tmp/may-fresh.json

fresh_source=$(jq -r '.source' /tmp/may-fresh.json 2>/dev/null)
fresh_closing=$(jq -r '.closingBalance' /tmp/may-fresh.json 2>/dev/null)
fresh_error=$(jq -r '.error' /tmp/may-fresh.json 2>/dev/null)

if [[ "$fresh_error" != "null" ]]; then
  echo "Error: $fresh_error"
  jq '.details' /tmp/may-fresh.json 2>/dev/null
else
  echo "Fresh - Source: $fresh_source, Closing Balance: £$fresh_closing"
  
  # Check if it matches Excel
  if [[ "$fresh_closing" == "179272.78" ]]; then
    echo "✅ MATCHES Excel value exactly!"
  else
    echo "❌ Does NOT match Excel value (£179,272.78)"
  fi
fi

echo ""
echo "STEP 2: Testing April 2025 Cash Flow"
echo "Expected closing balance: £182,387.67"
echo "-----------------------------------------"

curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-04-01&toDate=2025-04-30&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" \
  -o /tmp/april-fresh.json

april_source=$(jq -r '.source' /tmp/april-fresh.json 2>/dev/null)
april_closing=$(jq -r '.closingBalance' /tmp/april-fresh.json 2>/dev/null)
april_error=$(jq -r '.error' /tmp/april-fresh.json 2>/dev/null)

if [[ "$april_error" != "null" ]]; then
  echo "Error: $april_error"
else
  echo "Source: $april_source, Closing Balance: £$april_closing"
  
  if [[ "$april_closing" == "182387.67" ]]; then
    echo "✅ MATCHES Excel value exactly!"
  else
    echo "❌ Does NOT match Excel value (£182,387.67)"
  fi
fi

echo ""
echo "STEP 3: Showing detailed account breakdown for May 2025"
echo "-----------------------------------------"
if [[ -f /tmp/may-fresh.json ]] && [[ "$fresh_error" == "null" ]]; then
  echo "Accounts in May 2025:"
  jq -r '.accounts[]? | "  \(.accountName): £\(.closingBalance)"' /tmp/may-fresh.json 2>/dev/null || echo "No account details available"
  
  echo ""
  echo "Cash Flow Activities:"
  echo "  Operating: £$(jq -r '.netOperatingCashFlow' /tmp/may-fresh.json 2>/dev/null)"
  echo "  Investing: £$(jq -r '.netInvestingCashFlow' /tmp/may-fresh.json 2>/dev/null)"
  echo "  Financing: £$(jq -r '.netFinancingCashFlow' /tmp/may-fresh.json 2>/dev/null)"
  echo "  Total Net: £$(jq -r '.totalNetCashFlow' /tmp/may-fresh.json 2>/dev/null)"
fi

echo ""
echo "STEP 4: Checking database for stored values"
echo "-----------------------------------------"
sqlite3 prisma/dev.db "
  SELECT 
    reportType,
    datetime(fromDate/1000, 'unixepoch') as from_date,
    datetime(toDate/1000, 'unixepoch') as to_date,
    json_extract(data, '$.closingBalance') as closing_balance,
    json_extract(data, '$.source') as source
  FROM ReportData 
  WHERE reportType='CASH_FLOW' 
  AND fromDate >= 1714521600000  -- May 1, 2025
  AND fromDate <= 1719792000000  -- July 1, 2025
  ORDER BY fromDate DESC
  LIMIT 5;
" 2>/dev/null || echo "No database records found"
