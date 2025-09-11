# Xero Connection Status Summary

## Pages Using UnifiedPageHeader

### Pages WITH showAuthStatus (shows Xero connection status):
1. **Finance Page** (`/app/(authenticated)/finance/page.tsx`)
   - Uses: `showAuthStatus={true}`
   - Shows Xero connection status in header

### Pages WITHOUT showAuthStatus (need to add):
1. **Bookkeeping Page** (`/app/(authenticated)/bookkeeping/page.tsx`)
   - Uses UnifiedPageHeader but no showAuthStatus prop
   - Should show Xero connection status

2. **Cash Flow Page** (`/app/(authenticated)/cashflow/page.tsx`)
   - Uses UnifiedPageHeader but no showAuthStatus prop
   - Should show Xero connection status

3. **Analytics Page** (`/app/(authenticated)/analytics/page.tsx`)
   - Uses UnifiedPageHeader but no showAuthStatus prop
   - Should show Xero connection status

4. **Report Data History Component** (`/components/reports/common/report-data-history.tsx`)
   - Used by all report pages (Profit & Loss, Balance Sheet, etc.)
   - Uses UnifiedPageHeader but no showAuthStatus prop
   - Already has logic to check `hasXeroConnection` for enabling/disabling buttons
   - Should show Xero connection status

5. **Import Reports Page** (`/app/(authenticated)/reports/import/page.tsx`)
   - Uses UnifiedPageHeader but no showAuthStatus prop
   - May need Xero connection status

### Pages NOT using UnifiedPageHeader:
1. **Setup Page** (`/app/(authenticated)/setup/page.tsx`)
   - Does not use UnifiedPageHeader
   - Has its own custom layout

## Current Status
- The `UnifiedPageHeader` component already includes `XeroConnectionStatus` component (line 138)
- It only shows when `showAuthStatus={true}` and `hasActiveToken={false}`
- Only the Finance page currently shows this status

## Recommendation
Add `showAuthStatus={true}` to the following components to display Xero connection status:
1. Bookkeeping page
2. Cash Flow page  
3. Analytics page
4. Report Data History component (affects all report pages)
5. Import Reports page (optional, depends on requirements)