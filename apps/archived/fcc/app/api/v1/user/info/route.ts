import { NextRequest, NextResponse } from 'next/server';
import { requireXeroAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return requireXeroAuth(request, async (req) => {
    try {
      structuredLogger.info('Fetching user info from database', {
        userId: req.xeroUser?.userId
      });
      
      // Get user info from database
      const user = await prisma.user.findUnique({
        where: { id: req.xeroUser?.userId || '' },
        select: {
          id: true,
          email: true,
          name: true,
          tenantId: true,
          tenantName: true,
          tenantType: true,
          hasCompletedSetup: true,
          setupCompletedAt: true,
          lastLoginAt: true
        }
      });
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      const userInfo = {
        authenticated: true,
        tenant: {
          id: user.tenantId,
          name: user.tenantName,
          // We don't store organization details in the User model, so these are omitted
          // If needed, these should be stored during sync
          organisationName: user.tenantName,
          countryCode: null,
          timezone: null,
          currency: 'GBP' // Default to GBP
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasCompletedSetup: user.hasCompletedSetup,
          setupCompletedAt: user.setupCompletedAt,
          lastLoginAt: user.lastLoginAt
        },
        permissions: {
          canSync: true,
          canViewReports: true,
          canExport: true
        },
        lastSync: await getLastSyncInfo()
      };
      
      return NextResponse.json(userInfo);
    } catch (error) {
      structuredLogger.error('Failed to get user info', error, {
        component: 'user-info'
      });
      
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 500 }
      );
    }
  });
}

async function getLastSyncInfo() {
  const lastSync = await prisma.syncLog.findFirst({
    where: { status: 'success' },
    orderBy: { completedAt: 'desc' },
    select: {
      completedAt: true,
      recordsCreated: true,
      recordsUpdated: true
    }
  });
  
  return lastSync;
}