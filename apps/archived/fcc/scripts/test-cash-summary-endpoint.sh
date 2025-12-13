#!/bin/bash

# Test the cash-summary endpoint which should work with cached data
echo "Testing Cash Summary endpoint (Bank Summary format)..."
echo ""

# New cookies from user
COOKIES='next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GOPudA32apQ4_9Wy.IWS7cUFGc3JOH027cSdfe2in05XEn7HlbKPkNajUXZzMGO9Eq6f1B4yAmeN9CWtQJ1kQLFtarD-pNP5vR0ZBoWTUUG1KAaitTjhnvndD1UAn2-jXfgEIdq_N1efIEVOWmzKPsnkfos4emhC5jP2sKipUXotTApZkNvVpcEVoxR65tfoa4WId5tr35A-U2Oy-HNEyh7UdeAiJFEl0okQu-Y8vSYkZ9_ic15n4LCSjP420PV1WGI9MESu5FBuUdvIGHHl9TAVfK1fMDCW8z_LGkU_3wf3iAGapgRC5bhuiSGhHkbT7M1kBrbtl12LUk7va7wT2zCWdDsHEaoVX-mqlJ_TqCbD5vtU4psnkOcFzxG9vkV7w-D-Y4coVupfMuwQs1_wjww72.kfVbKrULtlADr-nTMOa0yA; user_session=%7B%22user%22%3A%7B%22id%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22Jarrar%20Amjad%22%7D%2C%22userId%22%3A%22cmcc553yw0000q4vuvtsyltqu%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22ca9f2956-55ce-47de-8e9f-b1f74c26098f%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D; xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0OTc4MTksImV4cCI6MTc1MTQ5OTYxOSwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQ5NzgwNywieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6Ijk3NmNmZDY3OWY5MjQ0MzliN2EwZjEzMGRhZGNhNGJhIiwic2lkIjoiOTc2Y2ZkNjc5ZjkyNDQzOWI3YTBmMTMwZGFkY2E0YmEiLCJqdGkiOiJFQkJDQkQxNEIxQTNGOTc2Q0UyNEQzRkExMjBENzI0NyIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiMTY1ZmE5OTAtYWZhOS00NWEwLTk5OTItOWQyYzZkOGMxNWRlIiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.hubwk0zG6GMiincFUlPLbpx1gf6vmvWA4SvY1G1edB1rJFOl6BVtZIcfM5oTcHqwilg0ZPD3qANYD7enCih0v--hDkgGoGZPW6u0mmwUQz1Sr9YtYA1agpReJDJz1Ue9TxEm1bPTQ9H9jWkQv29U3jpOfs_9s6QTBoWY0bHUOYEUlDHQMpiaq4CyF2XAVu6sbw4hQzyiXw-IvCVOz-TdbO2J872Z_bwv084zSrvc9ZfVHsIbVM2xFjtEQbfCGg951kyWVDg-aKmWTxJO5HZxR9rekBjXAjtC821wEjt-hnZrUHkLvcOSwdQJjczPpB9XkQy8M7s6h5-BaytJgmMUQg%22%2C%22refresh_token%22%3A%22swiqA1jcI02AQCooatbXsVSz0kWif2mqJ8oGBzjk2PA%22%2C%22expires_at%22%3A1751499620%2C%22expires_in%22%3A1798%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'

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