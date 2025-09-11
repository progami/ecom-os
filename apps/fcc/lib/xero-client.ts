import { XeroClient } from 'xero-node';
import { TokenSet } from 'xero-node';
import { cookies } from 'next/headers';
import { serialize, parse } from 'cookie';
import { XeroSession, XeroTokenSet } from './xero-session';
import { DatabaseSession } from './database-session';
import { structuredLogger } from './logger';
import { withLock, LOCK_RESOURCES } from './redis-lock';
import { XeroApiWrapper } from './xero-api-wrapper';
import { syncTokenToDatabase } from './xero-token-sync';
import { getServerSession } from 'next-auth';
import { refreshTokenWithRetry } from './xero-token-refresh';

// Updated scopes - write permissions for full functionality
export const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'offline_access openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read'
};

export function createXeroClient(state?: string) {
  const config: any = {
    clientId: xeroConfig.clientId,
    clientSecret: xeroConfig.clientSecret,
    redirectUris: xeroConfig.redirectUris,
    scopes: xeroConfig.scopes.split(' '),
    state: state
  };
  
  const xero = new XeroClient(config);
  return xero;
}

export async function getStoredTokenSet(): Promise<TokenSet | null> {
  return await XeroSession.getToken() as TokenSet | null;
}

export async function getDatabaseTokenSet(): Promise<TokenSet | null> {
  const token = await DatabaseSession.getXeroToken();
  return token as TokenSet | null;
}

export async function storeTokenSet(tokenSet: TokenSet | any) {
  const tokenData: XeroTokenSet = {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
    expires_at: tokenSet.expires_at || (Math.floor(Date.now() / 1000) + (tokenSet.expires_in || 1800)),
    expires_in: tokenSet.expires_in,
    token_type: tokenSet.token_type,
    scope: tokenSet.scope
  };
  
  await XeroSession.setToken(tokenData);
}

export async function clearTokenSet() {
  await XeroSession.clearToken();
}

export function createXeroClientFromTokenSet(tokenSet: XeroTokenSet): XeroClient {
  const config: any = {
    clientId: xeroConfig.clientId,
    clientSecret: xeroConfig.clientSecret,
    redirectUris: xeroConfig.redirectUris,
    scopes: xeroConfig.scopes.split(' ')
  };
  
  const xero = new XeroClient(config);
  xero.setTokenSet(tokenSet as any);
  return xero;
}

export async function refreshToken(tokenSet: XeroTokenSet): Promise<XeroTokenSet | null> {
  try {
    const xero = createXeroClient();
    xero.setTokenSet(tokenSet as any);

    const newTokenSet = await xero.refreshWithRefreshToken(
      xeroConfig.clientId,
      xeroConfig.clientSecret,
      tokenSet.refresh_token!
    );
    
    await storeTokenSet(newTokenSet);
    return newTokenSet as XeroTokenSet;

  } catch (error) {
    structuredLogger.error('Failed to refresh Xero token', error, { component: 'xero-client' });
    await clearTokenSet(); // The refresh token is likely invalid, clear everything
    return null;
  }
}

export async function getXeroClientFromDatabase(options?: { isLongRunningOperation?: boolean }): Promise<XeroClient | null> {
  try {
    structuredLogger.debug('Starting database-based Xero client retrieval', {
      component: 'xero-client-db',
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      redirectUri: process.env.XERO_REDIRECT_URI,
      isLongRunningOperation: options?.isLongRunningOperation
    });
    
    const tokenSet = await getDatabaseTokenSet();
    structuredLogger.debug('Database token retrieval complete', { component: 'xero-client-db' });
    
    if (!tokenSet) {
      structuredLogger.info('No Xero token found in database', { component: 'xero-client-db' });
      return null;
    }
    
    structuredLogger.debug('Database token set retrieved', {
      component: 'xero-client-db',
      hasAccessToken: !!tokenSet.access_token,
      hasRefreshToken: !!tokenSet.refresh_token,
      expiresAt: tokenSet.expires_at,
      tokenType: tokenSet.token_type,
      scope: tokenSet.scope
    });
    
    // Validate token structure
    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      structuredLogger.error('Invalid token structure - missing required fields', undefined, {
        component: 'xero-client-db',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token
      });
      await DatabaseSession.clearXeroTokens();
      return null;
    }
    
    const xero = createXeroClient();
    
    // Set the token on the client
    try {
      xero.setTokenSet(tokenSet);
    } catch (error) {
      structuredLogger.error('Failed to set token on Xero client', error, { component: 'xero-client-db' });
      return null;
    }
    
    // Check if token needs refresh
    const expiresAt = tokenSet.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    // Use longer buffer for long-running operations (like historical syncs)
    // Standard buffer for regular API calls
    const bufferTime = options?.isLongRunningOperation ? 600 : 300; // 10 minutes for long ops, 5 minutes for regular
    
    structuredLogger.debug('Token expiry check', { 
      component: 'xero-client-db',
      expiresAt, 
      now, 
      needsRefresh: expiresAt < (now + bufferTime),
      expiresIn: expiresAt - now,
      bufferTime,
      isLongRunningOperation: options?.isLongRunningOperation 
    });
    
    if (expiresAt < (now + bufferTime)) {
      try {
        structuredLogger.info('Token needs refresh', { 
          component: 'xero-client-db',
          expiresIn: expiresAt - now 
        });
        
        // Use our sync-lock to prevent concurrent refreshes
        const refreshKey = `token-${tokenSet.refresh_token?.substring(0, 8) || 'default'}`;
        
        const newTokenSet = await withLock(
          LOCK_RESOURCES.XERO_TOKEN_REFRESH,
          30000, // 30 seconds TTL for token refresh
          async () => {
            // Double-check if token still needs refresh (another process might have refreshed it)
            const currentToken = await getDatabaseTokenSet();
            if (currentToken && currentToken.expires_at && currentToken.expires_at >= (now + bufferTime)) {
              structuredLogger.info('Token already refreshed by another process', { component: 'xero-client-db' });
              return currentToken;
            }
            
            structuredLogger.debug('Executing token refresh with retry logic', { component: 'xero-client-db' });
            const refreshedToken = await refreshTokenWithRetry(
              xero,
              tokenSet.refresh_token,
              {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 10000,
                backoffFactor: 2
              }
            );
            
            // Store the new token set in database
            await DatabaseSession.updateXeroToken(refreshedToken, tokenSet.tenant_id);
            structuredLogger.debug('Token stored successfully in database', { 
              component: 'xero-client-db',
              newExpiry: refreshedToken.expires_at 
            });
            
            return refreshedToken;
          }
        );
        
        // Set the new token on the client
        xero.setTokenSet(newTokenSet);
        structuredLogger.info('Token refresh completed successfully', { component: 'xero-client-db' });
      } catch (error: any) {
        // Log detailed error information for debugging
        const errorDetails = {
          component: 'xero-client-db',
          errorType: error?.constructor?.name || 'Unknown',
          errorMessage: error?.message || 'No error message',
          errorCode: error?.statusCode || error?.response?.statusCode || 'No status code',
          errorResponse: error?.response?.body || error?.body || 'No response body',
          hasRefreshToken: !!tokenSet.refresh_token,
          tenantId: tokenSet.tenant_id
        };
        
        structuredLogger.error('Failed to refresh Xero token', error, errorDetails);
        
        // Write to development log for debugging
        try {
          const fs = require('fs');
          fs.appendFileSync('development.log', 
            `\n=== XERO TOKEN REFRESH FAILURE ${new Date().toISOString()} ===\n` +
            `Error Type: ${errorDetails.errorType}\n` +
            `Error Message: ${errorDetails.errorMessage}\n` +
            `Error Code: ${errorDetails.errorCode}\n` +
            `Error Response: ${JSON.stringify(errorDetails.errorResponse, null, 2)}\n` +
            `Tenant ID: ${errorDetails.tenantId}\n` +
            `Has Refresh Token: ${errorDetails.hasRefreshToken}\n` +
            `=== END TOKEN REFRESH FAILURE ===\n`
          );
        } catch (logError) {
          // Silent fail on logging
        }
        
        // Check if this is an invalid_grant error (refresh token expired)
        const isInvalidGrant = error?.message?.includes('invalid_grant') || 
                              error?.response?.body?.error === 'invalid_grant';
        
        if (isInvalidGrant) {
          structuredLogger.warn('Refresh token is invalid or expired - user needs to re-authenticate', {
            component: 'xero-client-db',
            tenantId: tokenSet.tenant_id
          });
        }
        
        await DatabaseSession.clearXeroTokens();
        return null;
      }
    }
    
    return xero;
  } catch (error) {
    structuredLogger.error('Unexpected error in getXeroClientFromDatabase', error, { component: 'xero-client-db' });
    return null;
  }
}

export async function getXeroClient(options?: { isLongRunningOperation?: boolean }): Promise<XeroClient | null> {
  try {
    structuredLogger.debug('Starting Xero client retrieval', {
      component: 'xero-client',
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      redirectUri: process.env.XERO_REDIRECT_URI,
      isLongRunningOperation: options?.isLongRunningOperation
    });
    
    const tokenSet = await getStoredTokenSet();
    structuredLogger.debug('Token retrieval complete', { component: 'xero-client' });
    
    if (!tokenSet) {
      structuredLogger.info('No Xero token found for this session', { component: 'xero-client' });
      return null;
    }
    
    structuredLogger.debug('Token set retrieved', {
      component: 'xero-client',
      hasAccessToken: !!tokenSet.access_token,
      hasRefreshToken: !!tokenSet.refresh_token,
      expiresAt: tokenSet.expires_at,
      tokenType: tokenSet.token_type,
      scope: tokenSet.scope
    });
    
    // Validate token structure
    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      structuredLogger.error('Invalid token structure - missing required fields', undefined, {
        component: 'xero-client',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token
      });
      await clearTokenSet();
      return null;
    }
    
    const xero = createXeroClient();
    
    // Set the token on the client
    try {
      xero.setTokenSet(tokenSet);
    } catch (error) {
      structuredLogger.error('Failed to set token on Xero client', error, { component: 'xero-client' });
      return null;
    }
    
    // Check if token needs refresh
    const expiresAt = tokenSet.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    // Use longer buffer for long-running operations (like historical syncs)
    // Standard buffer for regular API calls
    const bufferTime = options?.isLongRunningOperation ? 600 : 300; // 10 minutes for long ops, 5 minutes for regular
    
    structuredLogger.debug('Token expiry check', { 
      component: 'xero-client',
      expiresAt, 
      now, 
      needsRefresh: expiresAt < (now + bufferTime),
      expiresIn: expiresAt - now,
      bufferTime,
      isLongRunningOperation: options?.isLongRunningOperation 
    });
    
    if (expiresAt < (now + bufferTime)) {
      try {
        structuredLogger.info('Token needs refresh', { 
          component: 'xero-client',
          expiresIn: expiresAt - now 
        });
        
        // Use our sync-lock to prevent concurrent refreshes
        const refreshKey = `token-${tokenSet.refresh_token?.substring(0, 8) || 'default'}`;
        
        const newTokenSet = await withLock(
          LOCK_RESOURCES.XERO_TOKEN_REFRESH,
          30000, // 30 seconds TTL for token refresh
          async () => {
            // Double-check if token still needs refresh (another process might have refreshed it)
            const currentToken = await getStoredTokenSet();
            if (currentToken && currentToken.expires_at && currentToken.expires_at >= (now + bufferTime)) {
              structuredLogger.info('Token already refreshed by another process', { component: 'xero-client' });
              return currentToken;
            }
            
            structuredLogger.debug('Executing token refresh with retry logic', { component: 'xero-client' });
            const refreshedToken = await refreshTokenWithRetry(
              xero,
              tokenSet.refresh_token,
              {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 10000,
                backoffFactor: 2
              }
            );
            
            // Store the new token set
            await storeTokenSet(refreshedToken);
            structuredLogger.debug('Token stored successfully', { 
              component: 'xero-client',
              newExpiry: refreshedToken.expires_at 
            });
            
            return refreshedToken;
          }
        );
        
        // Set the new token on the client
        xero.setTokenSet(newTokenSet);
        structuredLogger.info('Token refresh completed successfully', { component: 'xero-client' });
      } catch (error: any) {
        // Log detailed error information for debugging
        const errorDetails = {
          component: 'xero-client',
          errorType: error?.constructor?.name || 'Unknown',
          errorMessage: error?.message || 'No error message',
          errorCode: error?.statusCode || error?.response?.statusCode || 'No status code',
          errorResponse: error?.response?.body || error?.body || 'No response body',
          hasRefreshToken: !!tokenSet.refresh_token
        };
        
        structuredLogger.error('Failed to refresh Xero token', error, errorDetails);
        
        // Write to development log for debugging
        try {
          const fs = require('fs');
          fs.appendFileSync('development.log', 
            `\n=== XERO TOKEN REFRESH FAILURE (Cookie-based) ${new Date().toISOString()} ===\n` +
            `Error Type: ${errorDetails.errorType}\n` +
            `Error Message: ${errorDetails.errorMessage}\n` +
            `Error Code: ${errorDetails.errorCode}\n` +
            `Error Response: ${JSON.stringify(errorDetails.errorResponse, null, 2)}\n` +
            `Has Refresh Token: ${errorDetails.hasRefreshToken}\n` +
            `=== END TOKEN REFRESH FAILURE ===\n`
          );
        } catch (logError) {
          // Silent fail on logging
        }
        
        // Check if this is an invalid_grant error (refresh token expired)
        const isInvalidGrant = error?.message?.includes('invalid_grant') || 
                              error?.response?.body?.error === 'invalid_grant';
        
        if (isInvalidGrant) {
          structuredLogger.warn('Refresh token is invalid or expired - user needs to re-authenticate', {
            component: 'xero-client'
          });
        }
        
        await clearTokenSet();
        return null;
      }
    }
    
    return xero;
  } catch (error) {
    structuredLogger.error('Unexpected error in getXeroClient', error, { component: 'xero-client' });
    return null;
  }
}

export async function getXeroClientWithTenant(options?: { isLongRunningOperation?: boolean }): Promise<{ client: XeroClient; tenantId: string } | null> {
  const xeroClient = await getXeroClient(options);
  if (!xeroClient) {
    return null;
  }

  // Update tenants to get tenant ID
  await xeroClient.updateTenants();
  const tenantId = xeroClient.tenants[0]?.tenantId;
  if (!tenantId) {
    return null;
  }

  return { client: xeroClient, tenantId };
}

export async function getWrappedXeroClient(options?: { isLongRunningOperation?: boolean }): Promise<{ wrapper: XeroApiWrapper; client: XeroClient; tenantId: string } | null> {
  const result = await getXeroClientWithTenant(options);
  if (!result) {
    return null;
  }

  const wrapper = XeroApiWrapper.create(result.client, result.tenantId);
  return { wrapper, client: result.client, tenantId: result.tenantId };
}

export async function getAuthUrl(state?: string, codeChallenge?: string): Promise<string> {
  // Pass the state to createXeroClient so it's included in the config
  const xero = createXeroClient(state);
  
  try {
    await xero.initialize();
  } catch (error) {
    structuredLogger.error('Failed to initialize Xero client', error, {
      component: 'xero-client',
      function: 'getAuthUrl'
    });
    throw error;
  }
  
  // Get the consent URL - the state will be included automatically
  let authUrl = await xero.buildConsentUrl();
  
  // Enable PKCE for enhanced security
  if (codeChallenge) {
    const url = new URL(authUrl);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    authUrl = url.toString();
    structuredLogger.debug('Built auth URL with PKCE', { component: 'xero-client', url: authUrl });
  } else {
    structuredLogger.debug('Built auth URL without PKCE', { component: 'xero-client', url: authUrl });
  }
  
  return authUrl;
}