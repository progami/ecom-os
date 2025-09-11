#!/bin/bash

# Clear logs
echo "" > logs/development.log

# Trigger the API call in background
curl -s "http://localhost:3003/api/v1/xero/reports/balance-sheet?dev_bypass=true" \
  -H "Accept: application/json" \
  -H "Cookie: user_session=%7B%22user%22%3A%7B%22id%22%3A%22user-1%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22name%22%3A%22TRADEMAN%20ENTERPRISE%22%7D%2C%22userId%22%3A%22user-1%22%2C%22email%22%3A%22ajarrar%40trademanenterprise.com%22%2C%22tenantId%22%3A%22%21Qn7M1%22%2C%22tenantName%22%3A%22TRADEMAN%20ENTERPRISE%20LTD%22%7D" &

# Give it time to process
sleep 5

# Read the logs
echo "=== Development Logs ==="
cat logs/development.log | grep -E "(Balance|balance|xero-report-fetcher|Processing Section|Found|Row |Structure)" | tail -50

echo ""
echo "=== Full Balance Sheet Logs ==="
cat logs/development.log | tail -100