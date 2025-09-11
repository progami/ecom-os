'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface XeroReauthAlertProps {
  message?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
}

export function XeroReauthAlert({ 
  message = 'Your Xero session has expired. Please reconnect to continue accessing live data.',
  showRefreshButton = true,
  onRefresh
}: XeroReauthAlertProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<any>(null);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    try {
      const response = await fetch('/api/v1/xero/auth/validate');
      const data = await response.json();
      setTokenStatus(data);
    } catch (error) {
      console.error('Failed to check token status:', error);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/v1/xero/auth/validate', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Token refreshed successfully
        if (onRefresh) {
          onRefresh();
        } else {
          window.location.reload();
        }
      } else {
        // Refresh failed, need to re-authenticate
        handleReconnect();
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      handleReconnect();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReconnect = () => {
    router.push('/api/v1/xero/auth');
  };

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertCircle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900">Xero Authentication Required</AlertTitle>
      <AlertDescription className="text-orange-700">
        <p className="mb-4">{message}</p>
        
        {tokenStatus && tokenStatus.tokenInfo && (
          <div className="mb-4 text-sm">
            <p>Token expired: {new Date(tokenStatus.tokenInfo.expiresAt).toLocaleString()}</p>
            {tokenStatus.refreshError && (
              <p className="text-red-600 mt-1">
                Refresh failed: {tokenStatus.refreshError.message}
              </p>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          {showRefreshButton && tokenStatus?.tokenInfo?.canRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="border-orange-300 hover:bg-orange-100"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Refresh
                </>
              )}
            </Button>
          )}
          
          <Button
            size="sm"
            onClick={handleReconnect}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Reconnect to Xero
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}