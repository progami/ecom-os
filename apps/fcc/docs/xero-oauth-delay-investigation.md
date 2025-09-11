# Xero OAuth Callback Flow Investigation Report

## Summary
The 45-second delay in updating the auth state after Xero OAuth authentication is caused by a mismatch between the cookie-based token storage and the database-based token checking, combined with ineffective auth state refresh mechanisms.

## Key Findings

### 1. OAuth Callback Flow
The OAuth callback route (`/api/v1/xero/auth/callback/route.ts`) successfully:
- Exchanges the authorization code for tokens
- Stores the user information in the database
- Sets cookies for both user session (`user_session`) and Xero token (`xero_token`)
- Redirects to `/finance` page by default

### 2. Auth State Update Mechanism

#### Current Issues:
1. **Dual Storage System**: Tokens are stored in both cookies (via `XeroSession`) and database (via user record)
2. **Status Check Relies on Database**: The `/api/v1/xero/status` endpoint checks the database for tokens, not cookies
3. **Timing Gap**: There's a gap between when cookies are set and when the auth status check recognizes the new connection

#### Auth Refresh Attempts:
1. **AuthContext** listens for:
   - Window focus events
   - Visibility change events
   - Custom `forceAuthRefresh` events

2. **Finance Page** has additional checks:
   - Checks if returning from OAuth (`document.referrer.includes('/api/v1/xero/auth')`)
   - Listens for visibility changes
   - Has a custom `syncComplete` event listener

3. **Public Script** (`auth-state-refresh.js`):
   - Detects OAuth callbacks
   - Dispatches `forceAuthRefresh` event after 500ms delay
   - Uses sessionStorage to track OAuth in progress

### 3. Root Cause Analysis

The 45-second delay occurs because:

1. **Database Query Timing**: The status endpoint queries for users with `xeroAccessToken` not null, but the database write might not be immediately visible due to:
   - Transaction isolation
   - Database connection pooling
   - Prisma query caching

2. **Multiple Auth Checks**: The system makes multiple checks that might be cached:
   - `/api/v1/auth/session` - checks user session
   - `/api/v1/xero/status` - checks Xero connection
   - `/api/v1/database/status` - checks data availability

3. **Browser Caching**: The status endpoints might be cached by the browser, preventing immediate updates

## Recommendations

### Immediate Fixes:

1. **Force Cache Invalidation**: Add cache headers to prevent status endpoint caching:
```typescript
// In /api/v1/xero/status/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});
```

2. **Add Database Read Consistency**: Ensure the status check reads the latest data:
```typescript
// Use Prisma's $queryRaw for immediate consistency
const user = await prisma.$queryRaw`
  SELECT * FROM "User" 
  WHERE "xeroAccessToken" IS NOT NULL 
  ORDER BY "lastLoginAt" DESC 
  LIMIT 1
`;
```

3. **Improve OAuth Callback Response**: Send a signal that auth is complete:
```typescript
// In callback route, add query param
const redirectUrl = new URL(`${baseUrl}/finance`);
redirectUrl.searchParams.set('xero_connected', 'true');
redirectUrl.searchParams.set('timestamp', Date.now().toString());
```

4. **Enhanced Finance Page Detection**: More aggressive auth refresh on OAuth return:
```typescript
// In finance page useEffect
if (searchParams.get('xero_connected') === 'true') {
  // Immediate refresh
  checkAuthStatus();
  
  // Retry after short delay
  setTimeout(() => checkAuthStatus(), 1000);
  setTimeout(() => checkAuthStatus(), 3000);
  
  // Clean URL
  window.history.replaceState({}, document.title, '/finance');
}
```

### Long-term Solution:

1. **Unified Token Storage**: Use either cookies OR database, not both
2. **WebSocket/SSE Updates**: Real-time auth state updates
3. **Event-Driven Architecture**: Emit events when auth state changes
4. **Optimistic UI Updates**: Update UI immediately after OAuth redirect, verify later

## Testing Recommendations

1. Add logging to track exact timing of:
   - OAuth callback completion
   - Database writes
   - Cookie setting
   - Status endpoint queries
   - Auth state updates

2. Monitor database query times and connection pool status

3. Test with different browsers to rule out browser-specific caching

## Conclusion

The 45-second delay is primarily caused by the system checking the database for auth status while the OAuth callback stores tokens in both cookies and database, with potential delays in database visibility and browser caching preventing immediate updates. The recommended fixes should reduce this delay significantly.