#!/bin/bash

# Extract and refresh the Xero token
echo "Refreshing Xero token..."

# Extract refresh token from the cookie (set via env)
if [ -z "${REFRESH_TOKEN:-}" ]; then
  echo "ERROR: REFRESH_TOKEN env var not set. Export REFRESH_TOKEN first." >&2
  exit 1
fi

# Call the refresh endpoint
echo "Calling token refresh endpoint..."
curl -k -X POST "https://localhost:3003/api/auth/xero/refresh" \
  -H "Content-Type: application/json" \
  -H "Cookie: xero-session=s%3As%253AuW8mLEAz6Uw7tN8nGa_DYWQf78YdBfBL.YrOhZGaWmRQv%252F8%252FdSJFGOJ3q4CQEYx%252BFOJQLRjjsJ8E" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" | jq '.'
