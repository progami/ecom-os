import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, xeroConfig } from '@/lib/xero-client';
import { getState, deleteState } from '@/lib/oauth-state-manager';
import { structuredLogger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiter';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const GET = withRateLimit(async (request: NextRequest) => {
  structuredLogger.debug('Starting OAuth callback handler', {
    component: 'xero-auth-callback'
  });
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  // Helper function for error redirects
  const errorRedirect = async (errorParam: string) => {
    const session = await getServerSession(authOptions).catch(() => null);
    const isAuthenticated = !!session?.user;

    if (isAuthenticated) {
      // If authenticated, redirect to finance page with error
      return NextResponse.redirect(`${baseUrl}/finance?xero_error=${encodeURIComponent(errorParam)}`);
    }

    // If not authenticated, redirect to login
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorParam)}`);
  };
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    structuredLogger.debug('OAuth callback parameters received', {
      component: 'xero-auth-callback',
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription
    });
  
  // Handle errors
  if (error) {
    structuredLogger.error('Xero OAuth error', undefined, {
      component: 'xero-auth-callback',
      error,
      errorDescription
    });
    return errorRedirect(errorDescription || error);
  }
  
  if (!code) {
    return errorRedirect('no_code');
  }
  
  // Verify state (CSRF protection)
  if (!state) {
    structuredLogger.error('No state parameter in callback', undefined, {
      component: 'xero-auth-callback'
    });
    return errorRedirect('missing_state');
  }
  
  // Retrieve state data from state manager
  const stateData = await getState(state);
  
  if (!stateData) {
    structuredLogger.error('Invalid or expired state', undefined, {
      component: 'xero-auth-callback',
      state: state.substring(0, 8) + '...'
    });
    return errorRedirect('invalid_state');
  }
  
  // Extract code verifier for PKCE
  const codeVerifier = stateData.codeVerifier;
  const returnUrl = stateData.returnUrl || '/sync';
  
  if (!codeVerifier) {
    structuredLogger.error('No code verifier in state data', undefined, {
      component: 'xero-auth-callback'
    });
    return errorRedirect('invalid_pkce');
  }
  
  structuredLogger.debug('State validated successfully', {
    component: 'xero-auth-callback',
    hasCodeVerifier: true,
    returnUrl
  });
  
  try {
    structuredLogger.debug('Starting token exchange', {
      component: 'xero-auth-callback',
      hasCodeVerifier: true,
      state: state.substring(0, 8) + '...'
    });
    
    // Create Xero client with state
    const xero = createXeroClient(state);
    
    // Initialize the Xero SDK (required for openid-client)
    await xero.initialize();
    
    structuredLogger.debug('Xero client initialized', {
      component: 'xero-auth-callback',
      redirectUri: xeroConfig.redirectUris[0]
    });
    
    // Get the full callback URL (including code and state)
    const fullCallbackUrl = request.url;
    structuredLogger.debug('Full callback URL received', {
      component: 'xero-auth-callback',
      url: fullCallbackUrl
    });
    
    try {
      // Extract parameters from the callback URL
      const params = xero.openIdClient.callbackParams(fullCallbackUrl);
      
      // Exchange authorization code for tokens with PKCE checks
      const checks = {
        code_verifier: codeVerifier,
        state: state
      };
      
      // Use the openid-client directly for proper PKCE support
      let tokenSet;
      if (xeroConfig.scopes.includes('openid')) {
        tokenSet = await xero.openIdClient.callback(xeroConfig.redirectUris[0], params, checks);
      } else {
        tokenSet = await xero.openIdClient.oauthCallback(xeroConfig.redirectUris[0], params, checks);
      }
      
      // Set the token on the Xero client
      xero.setTokenSet(tokenSet);
      
      // Delete the state immediately after successful token exchange to prevent reuse
      await deleteState(state);
      
      structuredLogger.info('Token exchange successful', {
        component: 'xero-auth-callback',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at
      });
      
      // Write success to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== XERO OAUTH CALLBACK SUCCESS ${new Date().toISOString()} ===\n` +
          `Has Access Token: ${!!tokenSet.access_token}\n` +
          `Has Refresh Token: ${!!tokenSet.refresh_token}\n` +
          `Expires At: ${new Date((tokenSet.expires_at || 0) * 1000).toISOString()}\n` +
          `Scopes: ${tokenSet.scope || 'None'}\n` +
          `=== END OAUTH SUCCESS ===\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Get user info from Xero and store in database
      try {
        // Get Xero client to fetch user info
        const xeroWithToken = createXeroClient();
        xeroWithToken.setTokenSet(tokenSet);
        await xeroWithToken.updateTenants();
        
        if (xeroWithToken.tenants && xeroWithToken.tenants.length > 0) {
          const tenant = xeroWithToken.tenants[0];
          
          // Get user info from ID token if available
          let userInfo: any = {};
          if (tokenSet.id_token) {
            try {
              // Decode ID token to get user info
              const idTokenPayload = JSON.parse(
                Buffer.from(tokenSet.id_token.split('.')[1], 'base64').toString()
              );
              userInfo = {
                xeroUserId: idTokenPayload.sub || idTokenPayload.xero_userid,
                email: idTokenPayload.email,
                firstName: idTokenPayload.given_name,
                lastName: idTokenPayload.family_name,
                fullName: idTokenPayload.name
              };
            } catch (e) {
              structuredLogger.error('Failed to decode ID token', e, {
                component: 'xero-auth-callback'
              });
            }
          }
          
          // Store user in database
          const { prisma } = await import('@/lib/prisma');
          
          // First, try to find user by xeroUserId
          const xeroUserId = userInfo.xeroUserId || tenant.tenantId;
          let user = await prisma.user.findUnique({
            where: { xeroUserId }
          });
          
          if (user) {
            // Update existing user
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                email: userInfo.email || user.email, // Keep existing email if no new one
                firstName: userInfo.firstName || user.firstName,
                lastName: userInfo.lastName || user.lastName,
                fullName: userInfo.fullName || user.fullName,
                tenantId: tenant.tenantId,
                tenantName: tenant.tenantName || 'Unknown',
                tenantType: tenant.tenantType,
                lastLoginAt: new Date(),
                xeroAccessToken: tokenSet.access_token,
                xeroRefreshToken: tokenSet.refresh_token,
                tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
              }
            });
          } else {
            // Try to find by email
            const email = userInfo.email || `${tenant.tenantId}@xero.local`;
            user = await prisma.user.findUnique({
              where: { email }
            });
            
            if (user) {
              // Update existing user with xeroUserId
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  xeroUserId,
                  firstName: userInfo.firstName || user.firstName,
                  lastName: userInfo.lastName || user.lastName,
                  fullName: userInfo.fullName || user.fullName,
                  tenantId: tenant.tenantId,
                  tenantName: tenant.tenantName || 'Unknown',
                  tenantType: tenant.tenantType,
                  lastLoginAt: new Date(),
                  xeroAccessToken: tokenSet.access_token,
                  xeroRefreshToken: tokenSet.refresh_token,
                  tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
                }
              });
            } else {
              // Create new user
              user = await prisma.user.create({
                data: {
                  xeroUserId,
                  email,
                  password: '', // Empty password for Xero-only users
                  firstName: userInfo.firstName,
                  lastName: userInfo.lastName,
                  fullName: userInfo.fullName,
                  tenantId: tenant.tenantId,
                  tenantName: tenant.tenantName || 'Unknown',
                  tenantType: tenant.tenantType,
                  xeroAccessToken: tokenSet.access_token,
                  xeroRefreshToken: tokenSet.refresh_token,
                  tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
                }
              });
            }
          }
          
          structuredLogger.info('User stored in database', {
            component: 'xero-auth-callback',
            userId: user.id,
            email: user.email,
            tenantName: user.tenantName
          });
          
          // Redirect to the original return URL or finance page
          const redirectUrl = returnUrl && returnUrl !== '/' 
            ? new URL(`${baseUrl}${returnUrl}`)
            : new URL(`${baseUrl}/finance`);
          
          // Add query parameter to signal successful OAuth completion
          redirectUrl.searchParams.set('xero_connected', 'true');
          redirectUrl.searchParams.set('auth_refresh', 'true');
          
          // Log OAuth success with timing info
          try {
            const fs = require('fs');
            fs.appendFileSync('development.log', 
              `\n=== XERO OAUTH SUCCESS REDIRECT ${new Date().toISOString()} ===\n` +
              `Redirect URL: ${redirectUrl.toString()}\n` +
              `User: ${user.email} (${user.id})\n` +
              `Tenant: ${user.tenantName}\n` +
              `Token Expires: ${new Date((tokenSet.expires_at || 0) * 1000).toISOString()}\n` +
              `OAuth params added: xero_connected=true, auth_refresh=true\n` +
              `=== END OAUTH REDIRECT ===\n`
            );
          } catch (logError) {
            // Silent fail
          }
          
          return NextResponse.redirect(redirectUrl.toString());
        }
      } catch (error) {
        structuredLogger.error('Failed to store user info', error, {
          component: 'xero-auth-callback'
        });
        // Continue with auth flow even if user storage fails
      }
      
      // Create response with redirect (fallback if user creation fails)
      const redirectUrl = returnUrl && returnUrl !== '/' 
        ? new URL(`${baseUrl}${returnUrl}`)
        : new URL(`${baseUrl}/finance`);
      
      // Add query parameter to signal successful OAuth completion
      redirectUrl.searchParams.set('xero_connected', 'true');
      redirectUrl.searchParams.set('auth_refresh', 'true');
      
      structuredLogger.debug('Creating redirect response', { 
        component: 'xero-auth-callback',
        redirectTo: redirectUrl.toString() 
      });

      structuredLogger.info('OAuth callback successful', {
        component: 'xero-auth-callback',
        redirectTo: redirectUrl.toString()
      });

      return NextResponse.redirect(redirectUrl.toString());
    } catch (tokenError: any) {
      structuredLogger.error('Token exchange failed', tokenError, {
        component: 'xero-auth-callback',
        errorMessage: tokenError.message,
        errorName: tokenError.name
      });
      
      // Write failure to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== XERO OAUTH CALLBACK FAILURE ${new Date().toISOString()} ===\n` +
          `Error Type: ${tokenError.name || 'Unknown'}\n` +
          `Error Message: ${tokenError.message || 'No message'}\n` +
          `Error Stack: ${tokenError.stack || 'No stack trace'}\n` +
          `Has Code Verifier: ${!!codeVerifier}\n` +
          `State: ${state?.substring(0, 8) || 'None'}...\n` +
          `=== END OAUTH FAILURE ===\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Determine specific error for user feedback
      let errorType = 'token_exchange_failed';
      if (tokenError.message?.includes('invalid_grant')) {
        errorType = 'invalid_grant';
      } else if (tokenError.message?.includes('invalid_client')) {
        errorType = 'invalid_client';
      }
      
      return errorRedirect(errorType);
    }
  } catch (error: any) {
    structuredLogger.error('Unexpected error in callback', error, {
      component: 'xero-auth-callback'
    });
    
    return errorRedirect('callback_error');
  }
  } catch (fatalError: any) {
    // Catch any errors that might occur before we can even log
    structuredLogger.error('Fatal error in OAuth callback', fatalError, {
      component: 'xero-auth-callback',
      errorMessage: fatalError.message || 'Unknown error'
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    return errorRedirect('callback_fatal_error');
  }
});
