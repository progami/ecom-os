import { structuredLogger } from './logger';

export interface XeroTokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  tenant_id?: string;
}

export interface SessionData {
  user: {
    id: string;
    email: string;
    name: string;
  };
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
}

/**
 * Database-based session management for Xero tokens
 * This avoids the cookies() function which causes dynamic server usage errors
 */
export class DatabaseSession {
  /**
   * Get Xero token from database for the current tenant
   * This is used in API routes to avoid the cookies() dynamic server usage error
   */
  static async getXeroToken(tenantId?: string): Promise<XeroTokenSet | null> {
    try {
      const { prisma } = await import('./prisma');
      
      // If no tenantId provided, try to get from the first available user
      let user;
      if (tenantId) {
        user = await prisma.user.findFirst({
          where: { 
            tenantId,
            xeroAccessToken: { not: null }
          },
          select: {
            xeroAccessToken: true,
            xeroRefreshToken: true,
            tokenExpiresAt: true,
            tenantId: true
          }
        });
      } else {
        // Get the most recently active user with tokens (including expired ones for refresh)
        user = await prisma.user.findFirst({
          where: { 
            xeroAccessToken: { not: null },
            xeroRefreshToken: { not: null } // Must have refresh token
          },
          orderBy: { lastLoginAt: 'desc' },
          select: {
            xeroAccessToken: true,
            xeroRefreshToken: true,
            tokenExpiresAt: true,
            tenantId: true
          }
        });
      }
      
      if (!user || !user.xeroAccessToken || !user.xeroRefreshToken) {
        structuredLogger.debug('[DatabaseSession.getXeroToken] No valid token found in database', {
          hasTenantId: !!tenantId,
          hasUser: !!user,
          hasAccessToken: !!user?.xeroAccessToken,
          hasRefreshToken: !!user?.xeroRefreshToken
        });
        return null;
      }
      
      return {
        access_token: user.xeroAccessToken,
        refresh_token: user.xeroRefreshToken,
        expires_at: user.tokenExpiresAt ? Math.floor(user.tokenExpiresAt.getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600, // Default to 1 hour if null
        tenant_id: user.tenantId,
        token_type: 'Bearer'
      };
    } catch (error) {
      structuredLogger.error('[DatabaseSession.getXeroToken] Error retrieving token from database', error as Error);
      return null;
    }
  }
  
  /**
   * Update Xero token in database after refresh
   */
  static async updateXeroToken(tokenSet: XeroTokenSet, tenantId?: string): Promise<void> {
    try {
      const { prisma } = await import('./prisma');
      
      const updateData = {
        xeroAccessToken: tokenSet.access_token,
        xeroRefreshToken: tokenSet.refresh_token,
        tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
      };
      
      // Update user by tenantId or the most recent user
      const whereClause = tenantId 
        ? { tenantId }
        : { xeroAccessToken: { not: null } };
      
      await prisma.user.updateMany({
        where: whereClause,
        data: updateData
      });
      
      structuredLogger.debug('[DatabaseSession.updateXeroToken] Token updated in database', {
        tenantId: tenantId || 'latest_user',
        expiresAt: tokenSet.expires_at
      });
    } catch (error) {
      structuredLogger.error('[DatabaseSession.updateXeroToken] Error updating token in database', error as Error);
      throw error;
    }
  }
  
  /**
   * Check if a token is expired (with 5-minute buffer)
   */
  static isTokenExpired(tokenSet: XeroTokenSet): boolean {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer
    return tokenSet.expires_at < (now + bufferTime);
  }
  
  /**
   * Clear all Xero tokens from database
   */
  static async clearXeroTokens(tenantId?: string): Promise<void> {
    try {
      const { prisma } = await import('./prisma');
      
      const whereClause = tenantId 
        ? { tenantId }
        : {}; // Clear all if no tenantId
      
      await prisma.user.updateMany({
        where: whereClause,
        data: {
          xeroAccessToken: null,
          xeroRefreshToken: null,
          tokenExpiresAt: null
        }
      });
      
      structuredLogger.info('[DatabaseSession.clearXeroTokens] Tokens cleared from database', {
        tenantId: tenantId || 'all_users'
      });
    } catch (error) {
      structuredLogger.error('[DatabaseSession.clearXeroTokens] Error clearing tokens from database', error as Error);
      throw error;
    }
  }
}