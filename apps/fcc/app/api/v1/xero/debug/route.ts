import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DatabaseSession } from '@/lib/database-session';
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation';

export async function GET(request: NextRequest) {
  try {
    // Validate session
    const session = await validateSession(request, ValidationLevel.USER);
    
    if (!session.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        tenantName: true,
        xeroUserId: true,
        xeroAccessToken: true,
        tokenExpiresAt: true,
        lastLoginAt: true
      }
    });
    
    // Get token from DatabaseSession
    const dbToken = await DatabaseSession.getXeroToken();
    
    // Get all users with Xero tokens
    const usersWithTokens = await prisma.user.findMany({
      where: { xeroAccessToken: { not: null } },
      select: {
        id: true,
        email: true,
        tenantId: true,
        tokenExpiresAt: true
      }
    });
    
    return NextResponse.json({
      currentUser: {
        ...user,
        hasXeroToken: !!user?.xeroAccessToken,
        tokenLength: user?.xeroAccessToken?.length || 0
      },
      databaseToken: {
        hasToken: !!dbToken,
        isExpired: dbToken ? DatabaseSession.isTokenExpired(dbToken) : null,
        expiresAt: dbToken ? new Date(dbToken.expires_at * 1000).toISOString() : null
      },
      allUsersWithTokens: usersWithTokens.map(u => ({
        ...u,
        tokenExpiresAt: u.tokenExpiresAt?.toISOString()
      })),
      sessionInfo: {
        userId: session.user.userId,
        email: session.user.email,
        tenantId: session.user.tenantId,
        isAdmin: session.isAdmin
      }
    });
  } catch (error) {
    console.error('[Xero Debug] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}