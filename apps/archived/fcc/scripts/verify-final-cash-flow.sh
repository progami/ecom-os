#!/bin/bash

echo "=== CASH FLOW VERIFICATION TEST ==="
echo "Testing cash flow data against Excel values"
echo "Token expires at: 2025-07-02T23:40:20.000Z"
echo "Current UTC time: $(date -u)"
echo ""

# Updated cookies with correct formatting
COOKIES='next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GOPudA32apQ4_9Wy.IWS7cUFGc3JOH027cSdfe2in05XEn7HlbKPkNajUXZzMGO9Eq6f1B4yAmeN9CWtQJ1kQLFtarD-pNP5vR0ZBoWTUUG1KAaitTjhnvndD1UAn2-jXfgEIdq_N1efIEVOWmzKPsnkfos4emhC5jP2sKipUXotTApZkNvVpcEVoxR65tfoa4WId5tr35A-U2Oy-HNEyh7UdeAiJFEl0okQu-Y8vSYkZ9_ic15n4LCSjP420PV1WGI9MESu5FBuUdvIGHHl9TAVfK1fMDCW8z_LGkU_3wf3iAGapgRC5bhuiSGhHkbT7M1kBrbtl12LUk7va7wT2zCWdDsHEaoVX-mqlJ_TqCbD5vtU4psnkOcFzxG9vkV7w-D-Y4coVupfMuwQs1_wjww72.kfVbKrULtlADr-nTMOa0yA; user_session=%7B%22user%22%3A%7B%22id%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22Jarrar%20Amjad%22%7D%2C%22userId%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22ca9f2956-55ce-47de-8e9f-b1f74c26098f%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D; xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkJ2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0OTc4MTksImV4cCI6MTc1MTQ5OTYxOSwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQ5NzgwNywieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6Ijk3NmNmZDY3OWY5MjQ0MzliN2EwZjEzMGRhZGNhNGJhIiwic2lkIjoiOTc2Y2ZkNjc5ZjkyNDQzOWI3YTBmMTMwZGFkY2E0YmEiLCJqdGkiOiJFQkJDQkQxNEIxQTNGOTc2Q0UyNEQzRkExMjBENzI0NyIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiMTY1ZmE5OTAtYWZhOS00NWEwLTk5OTItOWQyYzZkOGMxNWRlIiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.hubwk0zG6GMiincFUlPLbpx1gf6vmvWA4SvY1G1edB1rJFOl6BVtZIcfM5oTcHqwilg0ZPD3qANYD7enCih0v--hDkgGoGZPW6u0mmwUQz1Sr9YtYA1agpReJDJz1Ue9TxEm1bPTQ9H9jWkQv29U3jpOfs_9s6QTBoWY0bHUOYEUlDHQMpiaq4CyF2XAVu6sbw4hQzyiXw-IvCVOz-TdbO2J872Z_bwv084zSrvc9ZfVHsIbVM2xFjtEQbfCGg951kyWVDg-aKmWTxJO5HZxR9rekBjXAjtC821wEjt-hnZrUHkLvcOSwdQJjczPpB9XkQy8M7s6h5-BaytJgmMUQg%22%2C%22refresh_token%22%3A%22swiqA1jcI02AQCooatbXsVSz0kWif2mqJ8oGBzjk2PA%22%2C%22expires_at%22%3A1751499620%2C%22expires_in%22%3A1798%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'

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