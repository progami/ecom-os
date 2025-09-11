#!/bin/bash

# Fetch real Cash Flow data using the provided cookies
echo "Fetching real Cash Flow data from Xero..."

# Define periods to fetch
periods=(
  "2024-01-01:2024-01-31"
  "2024-02-01:2024-02-29"
  "2024-03-01:2024-03-31"
  "2024-04-01:2024-04-30"
  "2024-05-01:2024-05-31"
  "2024-06-01:2024-06-30"
)

# Your cookies
COOKIES='xero-session=s%3As%253AuW8mLEAz6Uw7tN8nGa_DYWQf78YdBfBL.YrOhZGaWmRQv%252F8%252FdSJFGOJ3q4CQEYx%252BFOJQLRjjsJ8E; xero_token=%7B%22access_token%22%3A%22eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE3NTE0NzUwOTgsImV4cCI6MTc1MTQ3Njg5OCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJzdWIiOiI1YWMyNzgwY2NhZmQ1YTdjYTY1M2IyZDY3MDNjY2FhYiIsImF1dGhfdGltZSI6MTc1MTQ3NTA5NCwieGVyb191c2VyaWQiOiJiOWY4ZmFlOC0zODcyLTRlY2UtYjI1NC01ODIwODNiNjU4OTMiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6ImFhYWFlMDQ1MDNlNTQ0YzI5MTE3NzZlNWFhZGY1YTc1Iiwic2lkIjoiYWFhYWUwNDUwM2U1NDRjMjkxMTc3NmU1YWFkZjVhNzUiLCJqdGkiOiI5NTU5RjZFQjFBOUFDMjgzODI3RkNBRkEwMzE0NEVFOSIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiYmIwM2FlODEtMDgyYS00NmQ4LWExNzUtYjgxYzAwY2RiZTA0Iiwic2NvcGUiOlsiZW1haWwiLCJwcm9maWxlIiwib3BlbmlkIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5zZXR0aW5ncy5yZWFkIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnRyYW5zYWN0aW9ucy5yZWFkIiwiYWNjb3VudGluZy5jb250YWN0cyIsImFjY291bnRpbmcuY29udGFjdHMucmVhZCIsIm9mZmxpbmVfYWNjZXNzIl0sImFtciI6WyJwd2QiXX0.L12-4A6j4pxQP6c9kL4H78ikJFTb4r2acllG4NKd3YkOxhe3cTJSlDlnUZl2_ONgdPx36un3XZl7XtcPdl4e14tuxlbfqNYsX576PZXGdXqvAbN2IlOeP6Qf2E8_kMpMhu0IPB2-I9YJ66Uu95S43SFLAHyRRcmR0VYC8duU3f9p9yuHwwhAkeoNXRkyBo2asGF9vcqfF0Pk31ZFi2o5kTuX3CjERGiItG8oIe4Gjtw8mQ9DTVrY6NnJceVb7LTkCmA7iS8zLGerOUq7Hq9H33zh5xDbey0EZ4jW2wS3LeDDHpxGA4goT-VQVDQVBgZii82F9NABpC-s2dvHGUqC7Q%22%2C%22refresh_token%22%3A%22815UN9vyiirBvGB4TEGP9Iw-byN0-ty6uimW54uvShs%22%2C%22expires_at%22%3A1751476898%2C%22expires_in%22%3A1799%2C%22token_type%22%3A%22Bearer%22%2C%22scope%22%3A%22openid%20profile%20email%20accounting.transactions%20accounting.settings%20accounting.contacts%20accounting.reports.read%20offline_access%20accounting.transactions.read%20accounting.settings.read%20accounting.contacts.read%22%7D'

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
    # Display a summary
    jq -r '.reportName + " - Total Net Cash Flow: " + (.totalNetCashFlow | tostring) + ", Operating: " + (.netOperatingCashFlow | tostring)' /tmp/cash-flow-$from_date.json 2>/dev/null || echo "  (Processing...)"
  else
    echo "✗ No data for $from_date to $to_date"
  fi
  
  # Small delay between requests
  sleep 1
done

echo "Cash Flow fetch completed. Check the database for imported records."