import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient, getStoredTokenSet } from '@/lib/xero-client';
import { DatabaseSession } from '@/lib/database-session';
import { Logger } from '@/lib/logger';

const logger = new Logger({ component: 'xero-status' });

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    logger.info('Starting Xero status check', {
      headers: {
        hasCookie: !!request.headers.get('cookie'),
        host: request.headers.get('host'),
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent')
      },
      url: request.url
    });
    
    // Check if we have Xero connection by looking for a valid token in database
    const databaseToken = await DatabaseSession.getXeroToken();
    const hasTokenInDatabase = !!databaseToken;
    const isTokenExpired = databaseToken ? DatabaseSession.isTokenExpired(databaseToken) : true;
    const hasConnection = hasTokenInDatabase && !isTokenExpired;
    
    logger.info('Xero connection check from database token', {
      hasConnection,
      hasTokenInDatabase,
      tokenExpiry: databaseToken ? new Date(databaseToken.expires_at * 1000).toISOString() : null,
      isExpired: isTokenExpired
    });
    
    // Check last sync status from database
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        status: 'success'
      },
      orderBy: {
        completedAt: 'desc'
      },
      select: {
        completedAt: true
      }
    });
    logger.debug('Last sync status', {
      hasLastSync: !!lastSync,
      lastSyncDate: lastSync?.completedAt
    });

    if (!hasConnection) {
      logger.info('No Xero connection found in database');
      return NextResponse.json({
        connected: false,
        organization: null,
        lastSync: lastSync?.completedAt || null
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    logger.debug('Xero connection found, retrieving organization details');
    
    // Get organization info from user record
    try {
      // Get the current user to retrieve tenant info
      const currentUser = await prisma.user.findFirst({
        where: {
          xeroAccessToken: { not: null }
        },
        select: {
          tenantId: true,
          tenantName: true,
          email: true,
          tokenExpiresAt: true
        }
      });
      
      logger.info('Found Xero user connection', {
        hasUser: !!currentUser,
        tenantId: currentUser?.tenantId,
        tenantName: currentUser?.tenantName,
        email: currentUser?.email,
        tokenExpiresAt: currentUser?.tokenExpiresAt?.toISOString()
      });
      
      return NextResponse.json({
        connected: true,
        organization: {
          tenantId: currentUser?.tenantId || 'unknown',
          tenantName: currentUser?.tenantName || 'Connected Organization',
          tenantType: 'ORGANISATION'
        },
        lastSync: lastSync?.completedAt || null
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } catch (error) {
      logger.error('Error retrieving organization info', error);
      // Even if retrieval fails, we're still connected
      return NextResponse.json({
        connected: true,
        organization: {
          tenantId: 'unknown',
          tenantName: 'Connected Organization',
          tenantType: 'ORGANISATION'
        },
        lastSync: lastSync?.completedAt || null
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (error) {
    logger.error('Error checking Xero status', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}