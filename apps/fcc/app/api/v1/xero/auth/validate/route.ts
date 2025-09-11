import { NextResponse } from 'next/server';
import { getXeroClientFromDatabase } from '@/lib/xero-client';
import { DatabaseSession } from '@/lib/database-session';
import { structuredLogger } from '@/lib/logger';
import { getTenantId } from '@/lib/xero-helpers';

export async function GET(request: Request) {
  try {
    structuredLogger.info('[Token Validation API] Request received');
    
    // Get current token from database
    const token = await DatabaseSession.getXeroToken();
    
    if (!token) {
      return NextResponse.json({
        valid: false,
        error: 'No token found',
        message: 'No Xero authentication token found. Please connect to Xero.',
        requiresAuth: true
      });
    }
    
    // Check token expiry
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = token.expires_at || 0;
    const expiresIn = expiresAt - now;
    const isExpired = expiresIn <= 0;
    
    // Try to get tenant ID
    const tenantId = await getTenantId(request);
    
    const tokenInfo = {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      expiresIn: expiresIn,
      isExpired: isExpired,
      tenantId: tenantId || token.tenant_id,
      canRefresh: !!token.refresh_token && !isExpired
    };
    
    structuredLogger.info('[Token Validation API] Token status', tokenInfo);
    
    // If token is expired, try to refresh it
    if (isExpired && token.refresh_token) {
      structuredLogger.info('[Token Validation API] Attempting to refresh expired token');
      
      try {
        const xeroClient = await getXeroClientFromDatabase();
        
        if (xeroClient) {
          // Token was successfully refreshed
          const newToken = await DatabaseSession.getXeroToken();
          const newExpiresAt = newToken?.expires_at || 0;
          
          return NextResponse.json({
            valid: true,
            refreshed: true,
            message: 'Token was expired but successfully refreshed',
            tokenInfo: {
              ...tokenInfo,
              expiresAt: new Date(newExpiresAt * 1000).toISOString(),
              expiresIn: newExpiresAt - now,
              isExpired: false
            }
          });
        }
      } catch (refreshError) {
        structuredLogger.error('[Token Validation API] Failed to refresh token', refreshError);
        
        // Check if it's an invalid grant error
        const errorMessage = refreshError instanceof Error ? refreshError.message : '';
        const isInvalidGrant = errorMessage.includes('invalid_grant');
        
        // Check if it's a 400 error (bad request - usually means refresh token is invalid)
        const is400Error = errorMessage.includes('400') || errorMessage.includes('Bad Request');
        
        return NextResponse.json({
          valid: false,
          error: 'Token refresh failed',
          message: isInvalidGrant || is400Error
            ? 'Your Xero refresh token has expired or been revoked. Please reconnect to Xero.'
            : 'Failed to refresh token. Please try again or reconnect to Xero.',
          requiresAuth: true,
          tokenInfo: tokenInfo,
          refreshError: {
            message: errorMessage,
            isInvalidGrant: isInvalidGrant,
            is400Error: is400Error,
            hint: is400Error ? 'Refresh tokens expire after 60 days or if revoked' : null
          }
        });
      }
    }
    
    // Token is valid
    if (!isExpired && token.access_token && token.refresh_token) {
      return NextResponse.json({
        valid: true,
        message: 'Token is valid',
        tokenInfo: tokenInfo
      });
    }
    
    // Token is invalid
    return NextResponse.json({
      valid: false,
      error: 'Invalid token state',
      message: 'Token is missing required fields or expired. Please reconnect to Xero.',
      requiresAuth: true,
      tokenInfo: tokenInfo
    });
    
  } catch (error) {
    structuredLogger.error('[Token Validation API] Unexpected error', error);
    
    return NextResponse.json({
      valid: false,
      error: 'Internal server error',
      message: 'Failed to validate token. Please try again.',
      requiresAuth: false
    }, { status: 500 });
  }
}

// POST endpoint to manually trigger token refresh
export async function POST(request: Request) {
  try {
    structuredLogger.info('[Token Validation API] Manual refresh requested');
    
    const token = await DatabaseSession.getXeroToken();
    
    if (!token || !token.refresh_token) {
      return NextResponse.json({
        success: false,
        error: 'No refresh token available',
        message: 'Cannot refresh token. Please reconnect to Xero.',
        requiresAuth: true
      }, { status: 400 });
    }
    
    // Attempt to refresh
    const xeroClient = await getXeroClientFromDatabase();
    
    if (xeroClient) {
      const newToken = await DatabaseSession.getXeroToken();
      const now = Math.floor(Date.now() / 1000);
      const newExpiresAt = newToken?.expires_at || 0;
      
      return NextResponse.json({
        success: true,
        message: 'Token refreshed successfully',
        tokenInfo: {
          expiresAt: new Date(newExpiresAt * 1000).toISOString(),
          expiresIn: newExpiresAt - now,
          tenantId: newToken?.tenant_id
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Refresh failed',
        message: 'Failed to refresh token. Please reconnect to Xero.',
        requiresAuth: true
      }, { status: 400 });
    }
    
  } catch (error) {
    structuredLogger.error('[Token Validation API] Manual refresh error', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to refresh token. Please try again.'
    }, { status: 500 });
  }
}