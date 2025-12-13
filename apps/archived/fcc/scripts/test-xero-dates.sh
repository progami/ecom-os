#!/bin/bash

# Test different date formats with Xero API
echo "Testing different date formats with Cash Flow API..."

COOKIES='xero-session=s%3As%253AuW8mLEAz6Uw7tN8nGa_DYWQf78YdBfBL.YrOhZGaWmRQv%252F8%252FdSJFGOJ3q4CQEYx%252BFOJQLRjjsJ8E'

# Test 1: Try with fromDate and toDate parameters
echo "1. Testing with fromDate and toDate..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?fromDate=2025-06-01&toDate=2025-06-30&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.error, .details' 2>/dev/null

echo ""
echo "2. Testing with from and to parameters..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?from=2025-06-01&to=2025-06-30&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.error, .details' 2>/dev/null

echo ""
echo "3. Testing with month and year parameters..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/cash-flow?month=6&year=2025&forceRefresh=true" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '.error, .details' 2>/dev/null

echo ""
echo "4. Testing P&L endpoint for comparison..."
curl -k -s "https://localhost:3003/api/v1/xero/reports/profit-loss?fromDate=2025-06-01&toDate=2025-06-30" \
  -H "Accept: application/json" \
  -H "Cookie: $COOKIES" | jq '{hasData: (.revenue != null), source}' 2>/dev/null

echo ""
echo "5. Checking actual log output..."
journalctl -u your-app -n 50 --no-pager 2>/dev/null | grep -i "xero\|cash" | tail -10 || echo "No journal logs available"