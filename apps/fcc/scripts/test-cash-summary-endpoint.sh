#!/bin/bash

# Test the cash-summary endpoint which should work with cached data
echo "Testing Cash Summary endpoint (Bank Summary format)..."
echo ""

# New cookies from user
if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "FCC_AUTH_COOKIE is not set. Provide a valid central session cookie (include NextAuth + Xero tokens)." >&2
  exit 1
fi

COOKIES="$FCC_AUTH_COOKIE"

# Test May 2025 to match Excel file
echo "Testing May 2025 Cash Summary..."
response=$(curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-summary?fromDate=2025-05-01&toDate=2025-05-31" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES")

# Check response
error=$(echo "$response" | jq -r '.error' 2>/dev/null)

if [[ "$error" != "null" ]]; then
  echo "✗ Error: $error"
  echo "$response" | jq '.' 2>/dev/null
else
  echo "✓ Got Cash Summary data!"
  
  # Extract accounts and show closing balances
  echo ""
  echo "Bank Accounts:"
  echo "$response" | jq -r '.accounts[] | "  \(.accountName): Opening: £\(.openingBalance), Closing: £\(.closingBalance), Movement: £\(.netMovement)"' 2>/dev/null
  
  # Calculate total closing balance
  totalClosing=$(echo "$response" | jq '[.accounts[].closingBalance] | add' 2>/dev/null)
  echo ""
  echo "Total Closing Balance: £$totalClosing"
  echo "Expected from Excel: £179,272.78"
fi

echo ""
echo "Checking database for Cash Flow records..."
sqlite3 prisma/dev.db "
  SELECT 
    datetime(createdAt/1000, 'unixepoch') as created_time,
    type,
    json_extract(data, '$.fromDate') as from_date,
    json_extract(data, '$.toDate') as to_date,
    json_extract(data, '$.closingBalance') as closing_balance
  FROM ReportData 
  WHERE type='CASH_FLOW' 
  ORDER BY createdAt DESC
  LIMIT 10;
"