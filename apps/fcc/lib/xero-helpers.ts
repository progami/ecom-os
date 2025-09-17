import { NextRequest } from 'next/server';
import { getXeroClientFromDatabase } from './xero-client';
import { DatabaseSession } from './database-session';
import { structuredLogger } from './logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Helper to get the Xero client consistently across the app
 * This uses the database-based authentication to avoid cookies() dynamic server usage
 */
export async function getXeroClient() {
  structuredLogger.debug('[getXeroClient] Starting Xero client retrieval');
  
  // Use database-based client to avoid cookies() dynamic server usage
  const xero = await getXeroClientFromDatabase();
  
  if (!xero) {
    structuredLogger.error('[getXeroClient] No Xero client available', undefined, {
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET
    });
    
    // Write to development log
    try {
      const fs = require('fs');
      fs.appendFileSync('development.log', 
        `\n=== XERO CLIENT UNAVAILABLE ${new Date().toISOString()} ===\n` +
        `Has Client ID: ${!!process.env.XERO_CLIENT_ID}\n` +
        `Has Client Secret: ${!!process.env.XERO_CLIENT_SECRET}\n` +
        `Redirect URI: ${process.env.XERO_REDIRECT_URI || 'Not set'}\n` +
        `=== END CLIENT UNAVAILABLE ===\n`
      );
    } catch (logError) {
      // Silent fail
    }
    
    return null;
  }
  
  structuredLogger.debug('[getXeroClient] Xero client retrieved successfully');
  return xero;
}

/**
 * Get the current tenant ID from the request session or database
 * @param request - The NextRequest object containing session cookies
 */
export async function getTenantId(_request?: NextRequest): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions).catch((error) => {
      structuredLogger.debug('[getTenantId] Unable to read central session', {
        reason: error instanceof Error ? error.message : 'unknown'
      });
      return null;
    });

    const user = (session?.user ?? {}) as Record<string, any>;
    const centralTenantId = user.tenantId || (session as any)?.tenantId || null;

    if (centralTenantId) {
      structuredLogger.debug('[getTenantId] Using tenant from central session', {
        tenantId: centralTenantId,
        email: user.email
      });
      return centralTenantId;
    }
  } catch (error) {
    structuredLogger.warn('[getTenantId] Failed to read central session', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Fall back to database session (for backward compatibility)
  const token = await DatabaseSession.getXeroToken();
  
  if (!token || !token.tenant_id) {
    console.error('[getTenantId] No tenant ID found in session');
    return null;
  }
  
  return token.tenant_id;
}

/**
 * Check if we have a valid Xero connection
 */
export async function hasXeroConnection(): Promise<boolean> {
  const xero = await getXeroClient();
  return xero !== null;
}

/**
 * Execute a Xero API call with error handling
 */
export async function executeXeroAPICall<T>(
  xeroClient: any,
  tenantId: string,
  apiCall: (client: any) => Promise<any>
): Promise<T> {
  try {
    const response = await apiCall(xeroClient);
    return response.body || response;
  } catch (error: any) {
    console.error('[executeXeroAPICall] Error calling Xero API:', error);
    throw error;
  }
}
