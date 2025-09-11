'use client';

import { useState, useEffect, useCallback } from 'react';

interface XeroAuthStatus {
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresAuth: boolean;
  tokenInfo?: {
    expiresAt: string;
    expiresIn: number;
    isExpired: boolean;
    tenantId?: string;
  };
  error?: string;
}

export function useXeroAuth() {
  const [authStatus, setAuthStatus] = useState<XeroAuthStatus>({
    isAuthenticated: false,
    isLoading: true,
    requiresAuth: false
  });

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/xero/auth/validate');
      const data = await response.json();
      
      setAuthStatus({
        isAuthenticated: data.valid,
        isLoading: false,
        requiresAuth: data.requiresAuth || false,
        tokenInfo: data.tokenInfo,
        error: data.error
      });
      
      return data;
    } catch (error) {
      setAuthStatus({
        isAuthenticated: false,
        isLoading: false,
        requiresAuth: false,
        error: 'Failed to check authentication status'
      });
      return null;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/xero/auth/validate', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        await checkAuthStatus();
      }
      
      return data;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return { success: false, error: 'Failed to refresh token' };
    }
  }, [checkAuthStatus]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    ...authStatus,
    checkAuthStatus,
    refreshToken
  };
}

// Helper to handle API errors and show auth alerts
export function handleXeroApiError(error: any, showAuthAlert?: (message: string) => void) {
  const errorMessage = error?.message || error?.error || '';
  const requiresAuth = error?.requiresAuth || 
                      errorMessage.includes('Xero client not available') ||
                      errorMessage.includes('authentication required') ||
                      error?.status === 401;
  
  if (requiresAuth && showAuthAlert) {
    showAuthAlert(error?.message || 'Your Xero session has expired. Please reconnect to continue.');
  }
  
  return {
    requiresAuth,
    message: error?.message || 'An error occurred while accessing Xero data.'
  };
}