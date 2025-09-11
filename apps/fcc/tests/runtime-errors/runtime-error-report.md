# Runtime Error Detection Report

## Test Summary
Created comprehensive Playwright test suite to detect runtime errors on authentication and dashboard pages.

## Test File Location
`/tests/runtime-errors/auth-dashboard-errors.spec.ts`

## Pages Tested
1. `/login` - Login page
2. `/register` - Registration page  
3. `/setup` - Setup page
4. `/` - Home dashboard (redirects to `/finance`)
5. `/finance` - Finance dashboard

## Critical Errors Found

### 1. API Server Error (500)
- **Endpoint**: `/api/v1/xero/reports/profit-loss`
- **Status**: 500 Internal Server Error
- **Frequency**: Occurs on every dashboard page load
- **Impact**: Profit/Loss data cannot be loaded

### 2. Network Request Aborts
Multiple API endpoints are being aborted:
- `/api/health`
- `/api/v1/xero/status`
- `/api/v1/database/status`
- `/api/v1/auth/session`
- `/api/v1/analytics/top-vendors`
- `/api/v1/bookkeeping/cash-balance`
- `/api/v1/xero/reports/balance-sheet`

### 3. Missing Script File (Fixed)
- **File**: `/public/clear-stale-sync.js`
- **Status**: Was missing, now created
- **Purpose**: Clears stale sync data from localStorage

## Test Features
- Detects console errors
- Tracks network failures and HTTP errors
- Tests interactive elements (buttons, links)
- Performs stress test with rapid navigation
- Filters known non-critical errors (favicon, NEXT_REDIRECT)

## Recommendations
1. **Investigate the `/api/v1/xero/reports/profit-loss` endpoint** - This is causing consistent 500 errors
2. **Check why multiple API requests are being aborted** - May indicate a race condition or early component unmounting
3. **Add error boundaries** to gracefully handle API failures in the UI
4. **Implement retry logic** for failed API requests

## Running the Test
```bash
# Run all browser tests
npx playwright test tests/runtime-errors/auth-dashboard-errors.spec.ts

# Run only in Chromium
npx playwright test tests/runtime-errors/auth-dashboard-errors.spec.ts --project=chromium

# Run with UI mode for debugging
npx playwright test tests/runtime-errors/auth-dashboard-errors.spec.ts --ui
```