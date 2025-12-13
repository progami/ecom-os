'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to detect OAuth return and trigger auth refresh
 * This solves the delay in auth state update after Xero OAuth
 */
export function useOAuthReturn() {
  const searchParams = useSearchParams();
  const { checkAuthStatus } = useAuth();

  useEffect(() => {
    // Check for OAuth success parameters
    const xeroConnected = searchParams.get('xero_connected');
    const authRefresh = searchParams.get('auth_refresh');
    
    console.log('[useOAuthReturn] Checking OAuth params:', {
      xeroConnected,
      authRefresh,
      url: window.location.href,
      searchParams: searchParams.toString()
    });
    
    if (xeroConnected === 'true' || authRefresh === 'true') {
      console.log('[useOAuthReturn] OAuth completed successfully, triggering immediate auth refresh');
      
      // Trigger auth refresh with a small delay to ensure cookies are set
      // Pass true to skip server check since we know server is ready after OAuth
      setTimeout(() => {
        console.log('[useOAuthReturn] Calling checkAuthStatus with skipServerCheck=true');
        checkAuthStatus(true);
      }, 100);
      
      // Clean up URL parameters after a delay
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('xero_connected');
        url.searchParams.delete('auth_refresh');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }, 500);
    }
  }, [searchParams, checkAuthStatus]);
}