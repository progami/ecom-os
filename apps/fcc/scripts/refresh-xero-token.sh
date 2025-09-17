#!/bin/bash

# Extract and refresh the Xero token
echo "Refreshing Xero token..."

# Extract refresh token from the cookie (set via env)
if [ -z "${REFRESH_TOKEN:-}" ]; then
  echo "ERROR: REFRESH_TOKEN env var not set. Export REFRESH_TOKEN first." >&2
  exit 1
fi

if [ -z "$FCC_AUTH_COOKIE" ]; then
  echo "ERROR: FCC_AUTH_COOKIE env var not set. Provide central auth cookies." >&2
  exit 1
fi

# Call the refresh endpoint
echo "Calling token refresh endpoint..."
curl -k -X POST "https://localhost:3003/api/auth/xero/refresh" \
  -H "Content-Type: application/json" \
  -H "Cookie: $FCC_AUTH_COOKIE" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" | jq '.'
