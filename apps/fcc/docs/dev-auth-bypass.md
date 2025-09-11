# Development Authentication Bypass

This is a development-only feature that allows bypassing authentication for testing purposes.

## ⚠️ IMPORTANT: Development Only

This feature is **ONLY** available when `NODE_ENV=development`. Any attempts to use it in production will be rejected with a 403 Forbidden error.

## Usage

### Method 1: Browser Navigation (GET)

Simply navigate to the bypass URL in your browser:

```
http://localhost:3001/api/v1/auth/dev-bypass
```

This will:
1. Create a test session with default dev user credentials
2. Redirect you to `/finance` page
3. Set the session cookie

To redirect to a different page:
```
http://localhost:3001/api/v1/auth/dev-bypass?redirect=/reports/balance-sheet
```

### Method 2: API Call (POST)

You can also use the POST endpoint to set custom session data:

```bash
curl -X POST http://localhost:3001/api/v1/auth/dev-bypass \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "custom-user-123",
    "email": "custom@example.com",
    "tenantId": "custom-tenant-456",
    "tenantName": "Custom Organization"
  }'
```

### Method 3: Test Script

Run the provided test script:

```bash
node scripts/test-dev-bypass.js
```

## Default Session Data

When no custom data is provided, the following defaults are used:

```json
{
  "userId": "dev-user-123",
  "email": "dev@example.com",
  "tenantId": "dev-tenant-123",
  "tenantName": "Dev Organization"
}
```

## Session Structure

The session cookie contains:

```json
{
  "user": {
    "id": "dev-user-123",
    "email": "dev@example.com",
    "name": "Dev User"
  },
  "userId": "dev-user-123",
  "email": "dev@example.com",
  "tenantId": "dev-tenant-123",
  "tenantName": "Dev Organization"
}
```

## Logging

All dev bypass attempts are logged to `logs/development.log` with the component `auth-dev-bypass`.

## Security Notes

- This endpoint checks `process.env.NODE_ENV` and will reject any requests if not in development
- All bypass attempts are logged for audit purposes
- The session cookie follows the same security settings as regular authentication (httpOnly, secure in HTTPS, etc.)