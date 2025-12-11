import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE_NAME } from '@/lib/cookie-config';
import { getXeroClient, refreshToken, getStoredTokenSet } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';
import { withLock, LOCK_RESOURCES } from '@/lib/redis-lock';
import { auth } from '@/lib/auth';

export interface SessionUser {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role?: string;
}

export interface XeroTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
}

export interface ValidatedSession {
  user: SessionUser;
  xeroToken?: XeroTokenData;
  isAdmin: boolean;
  isValid: boolean;
}

/**
 * Session validation levels
 */
export enum ValidationLevel {
  NONE = 'none',           // No validation required
  USER = 'user',           // User session required
  XERO = 'xero',           // Xero token required
  ADMIN = 'admin'          // Admin privileges required
}

/**
 * Validates a session token
 */
// Legacy stub retained for compatibility; unified auth uses NextAuth server session
function validateSessionToken(_token: string): SessionUser | null { return null }

/**
 * Validates session and returns user information
 */
export async function validateSession(
  request: NextRequest,
  level: ValidationLevel = ValidationLevel.USER
): Promise<ValidatedSession> {
  try {
    // No validation needed for public endpoints
    if (level === ValidationLevel.NONE) {
      return {
        user: {
          userId: 'anonymous',
          email: 'anonymous@example.com',
          tenantId: '',
          tenantName: 'Anonymous'
        },
        isAdmin: false,
        isValid: true
      };
    }

    // Check if the middleware already validated a session (for test users in dev mode)
    const authSessionHeader = request.headers.get('x-auth-session');
    if (authSessionHeader && process.env.NODE_ENV === 'development') {
      try {
        const sessionData = JSON.parse(authSessionHeader);
        const userId = sessionData.user?.id || sessionData.userId;
        
        // Check if this is a test user
        if (userId && (userId.startsWith('test-') || userId === 'user-1' || userId.includes('test'))) {
          structuredLogger.debug('Using test user session from middleware', {
            component: 'session-validation',
            userId
          });
          
          return {
            user: {
              userId,
              email: sessionData.user?.email || sessionData.email,
              tenantId: sessionData.tenantId || '!Qn7M1',
              tenantName: sessionData.tenantName || 'Test Tenant',
              role: sessionData.role || 'user'
            },
            isAdmin: userId === 'test-admin-1' || sessionData.isAdmin || false,
            isValid: true
          };
        }
      } catch (e) {
        structuredLogger.warn('Failed to parse x-auth-session header', {
          component: 'session-validation',
          error: e instanceof Error ? e.message : 'Unknown error'
        });
      }
    }

    const cookieStore = cookies();
    // Unified auth: read NextAuth session
    const nextAuthSession = await auth();
    if (!nextAuthSession || !nextAuthSession.user || !(nextAuthSession as any).user.id) {
      return {
        user: null as any,
        isAdmin: false,
        isValid: false
      };
    }

    // Skip database verification for test users in development
    let dbUser = null;
    const userIdFromSession = (nextAuthSession as any).user.id as string | undefined;
    const isTestUser = process.env.NODE_ENV === 'development' && 
      userIdFromSession && 
      (userIdFromSession.startsWith('test-') || userIdFromSession === 'user-1' || userIdFromSession.includes('test'));
    
    if (isTestUser) {
      structuredLogger.debug('Skipping database verification for test user', {
        component: 'session-validation',
        userId: userIdFromSession
      });
      // Create a mock user object for test users
      dbUser = {
        id: userIdFromSession!,
        email: (nextAuthSession.user as any).email,
        tenantId: (nextAuthSession.user as any).tenantId || '!Qn7M1',
        tenantName: (nextAuthSession.user as any).tenantName || 'Test Tenant'
      };
    } else {
      // Verify user exists in database for non-test users
      dbUser = await prisma.user.findUnique({ where: { id: userIdFromSession! } });

      if (!dbUser) {
        // JIT provision local user with minimal data (Option A)
        try {
          dbUser = await prisma.user.create({
            data: {
              id: userIdFromSession!,
              email: (nextAuthSession.user as any).email || `user-${userIdFromSession}@example.com`,
              name: (nextAuthSession.user as any).name || null,
              hasCompletedSetup: false,
            } as any,
          })
          structuredLogger.info('Provisioned local user for FCC', {
            component: 'session-validation',
            userId: userIdFromSession
          })
        } catch (e) {
          structuredLogger.error('Failed provisioning FCC user', e, {
            component: 'session-validation',
            userId: userIdFromSession
          })
          return {
            user: null as any,
            isAdmin: false,
            isValid: false
          };
        }
      }
    }

    // Update session data with fresh database info
    const user: SessionUser = {
      userId: dbUser.id,
      email: dbUser.email,
      tenantId: (nextAuthSession.user as any).tenantId || dbUser.tenantId || '',
      tenantName: (nextAuthSession.user as any).tenantName || dbUser.tenantName || '',
      role: 'user' // Default role since User model doesn't have role field
    };

    // Check admin privileges via portal roles claim when present
    const portalSession = await auth()
    const roles: any = (portalSession as any)?.roles
    const fccRole = roles?.fcc?.role as string | undefined
    const isAdmin = fccRole === 'admin'
    if (level === ValidationLevel.ADMIN && !isAdmin) {
      structuredLogger.warn('Non-admin user attempted admin access', {
        component: 'session-validation',
        userId: user.userId,
        endpoint: request.nextUrl.pathname
      });
      return {
        user,
        isAdmin: false,
        isValid: false
      };
    }

    // Validate Xero token if required
    let xeroToken: XeroTokenData | undefined;
    if (level === ValidationLevel.XERO) {
      const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
      if (!tokenCookie?.value) {
        structuredLogger.warn('Xero token missing', {
          component: 'session-validation',
          userId: user.userId
        });
        return {
          user,
          isAdmin,
          isValid: false
        };
      }

      try {
        xeroToken = JSON.parse(tokenCookie.value);
        
        // Check token expiration
        const now = Date.now();
        const expiresAt = xeroToken!.expires_at * 1000; // Convert to milliseconds
        const bufferTime = 5 * 60 * 1000; // 5 minute buffer
        
        if (now >= expiresAt - bufferTime) {
          structuredLogger.info('Xero token expiring soon, attempting refresh', {
            component: 'session-validation',
            userId: user.userId,
            expiresAt: new Date(expiresAt).toISOString()
          });
          
          // Attempt to refresh the token proactively
          const refreshKey = `token-refresh-${user.userId}`;
          
          let refreshedToken: XeroTokenData | null = null;
          try {
            refreshedToken = await withLock<XeroTokenData | null>(
              LOCK_RESOURCES.XERO_TOKEN_REFRESH,
              30000, // 30 seconds TTL
              async () => {
                // Double-check if token still needs refresh
                const currentToken = await getStoredTokenSet();
                if (currentToken && currentToken.expires_at && currentToken.expires_at * 1000 >= expiresAt - bufferTime) {
                  structuredLogger.info('Token already refreshed by another process', {
                    component: 'session-validation',
                    userId: user.userId
                  });
                  return currentToken as XeroTokenData;
                }
                
                // Perform the refresh
                const newToken = await refreshToken(xeroToken as any);
                if (!newToken) {
                  throw new Error('Failed to refresh token');
                }
                
                return newToken;
              }
            );
          } catch (error) {
            structuredLogger.error('Token refresh error', error, {
              component: 'session-validation',
              userId: user.userId
            });
            refreshedToken = null;
          }
          
          if (refreshedToken) {
            // Update the xeroToken variable with the refreshed token
            xeroToken = refreshedToken;
            
            // Update the cookie with the new token
            // Import the shared portal cookie config
            const { AUTH_COOKIE_OPTIONS } = await import('@/lib/cookie-config');
            const cookieStore = cookies();
            cookieStore.set(TOKEN_COOKIE_NAME, JSON.stringify(refreshedToken), AUTH_COOKIE_OPTIONS);
            
            structuredLogger.info('Xero token refreshed successfully', {
              component: 'session-validation',
              userId: user.userId,
              newExpiresAt: new Date(refreshedToken.expires_at * 1000).toISOString()
            });
            
            // Continue with validation as if the token were valid from the start
          } else {
            // Refresh failed, return invalid
            structuredLogger.error('Token refresh failed', undefined, {
              component: 'session-validation',
              userId: user.userId
            });
            
            return {
              user,
              xeroToken,
              isAdmin,
              isValid: false
            };
          }
        }
        
        // Skip Xero client verification here to avoid circular dependency
        // The actual API routes will handle client initialization
        structuredLogger.debug('Xero token validated', {
          component: 'session-validation',
          userId: user.userId,
          tokenExpiry: new Date(expiresAt).toISOString()
        });
      } catch (error) {
        structuredLogger.error('Error validating Xero token', error, {
          component: 'session-validation',
          userId: user.userId
        });
        return {
          user,
          isAdmin,
          isValid: false
        };
      }
    }

    // Log successful validation only in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      structuredLogger.info('Session validated successfully', {
        component: 'session-validation',
        userId: user.userId,
        level,
        isAdmin
      });
    }

    return {
      user,
      xeroToken,
      isAdmin,
      isValid: true
    };
  } catch (error) {
    structuredLogger.error('Session validation error', error, {
      component: 'session-validation',
      endpoint: request.nextUrl.pathname
    });
    
    return {
      user: null as any,
      isAdmin: false,
      isValid: false
    };
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(level: ValidationLevel = ValidationLevel.USER) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, session: ValidatedSession) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const session = await validateSession(request, level);
    
    if (!session.isValid) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }
    
    // Add session to request headers for downstream use
    const modifiedRequest = new NextRequest(request.url, {
      headers: new Headers(request.headers)
    });
    modifiedRequest.headers.set('X-User-Id', session.user.userId);
    modifiedRequest.headers.set('X-User-Email', session.user.email);
    modifiedRequest.headers.set('X-Tenant-Id', session.user.tenantId);
    modifiedRequest.headers.set('X-Is-Admin', String(session.isAdmin));
    
    return handler(modifiedRequest, session);
  };
}

/**
 * Wrapper for API routes that require authentication
 */
export function withAuth<T extends (...args: any[]) => any>(
  handler: T,
  level: ValidationLevel = ValidationLevel.USER
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const session = await validateSession(request, level);
    
    if (!session.isValid) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }
    
    // Inject session into request
    (request as any).session = session;
    
    return handler(request, ...args);
  }) as T;
}

/**
 * Creates a new session
 */
export async function createSession(user: SessionUser): Promise<string> {
  // In production, use proper JWT signing
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  try {
    // For now, just stringify the session data
    // TODO: Implement proper JWT signing
    return JSON.stringify(user);
  } catch (error) {
    structuredLogger.error('Error creating session', error, {
      component: 'session-validation',
      userId: user.userId
    });
    throw error;
  }
}

/**
 * Refreshes a session
 */
export async function refreshSession(userId: string): Promise<SessionUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return null;
    }
    
    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId || '',
      tenantName: user.tenantName || '',
      role: 'user' // Default role
    };
  } catch (error) {
    structuredLogger.error('Error refreshing session', error, {
      component: 'session-validation',
      userId
    });
    return null;
  }
}
