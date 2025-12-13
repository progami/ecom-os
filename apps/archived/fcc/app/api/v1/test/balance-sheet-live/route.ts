import { NextRequest, NextResponse } from 'next/server';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
import { getTenantId } from '@/lib/xero-helpers';
import { structuredLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.XERO },
  async (request, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const date = searchParams.get('date') || '2025-06-30';
      
      structuredLogger.info('[Test Balance Sheet Live] Starting live fetch', {
        date,
        userId: session?.user?.userId
      });

      // Get tenant ID
      const tenantId = await getTenantId(request);
      if (!tenantId) {
        return NextResponse.json({
          error: 'No Xero tenant ID found',
          message: 'Please connect to Xero first'
        }, { status: 400 });
      }

      structuredLogger.info('[Test Balance Sheet Live] Calling XeroReportFetcher', {
        tenantId,
        date
      });

      // Fetch directly from Xero API
      const asAtDate = new Date(date);
      const xeroData = await XeroReportFetcher.fetchBalanceSheetSummary(tenantId, asAtDate);

      // Get last sync info
      const lastSync = await prisma.syncLog.findFirst({
        where: {
          status: 'success',
          syncType: { in: ['full_sync', 'incremental_sync'] }
        },
        orderBy: {
          completedAt: 'desc'
        },
        select: {
          completedAt: true
        }
      });

      const response = {
        ...xeroData,
        source: 'xero_direct',
        fetchedAt: new Date().toISOString(),
        lastSyncedAt: lastSync?.completedAt?.toISOString() || null,
        requestedDate: date,
        message: 'Live data fetched directly from Xero API'
      };

      structuredLogger.info('[Test Balance Sheet Live] Success', {
        totalAssets: response.totalAssets,
        totalLiabilities: response.totalLiabilities,
        cash: response.cash
      });

      return NextResponse.json(response);
    } catch (error: any) {
      structuredLogger.error('[Test Balance Sheet Live] Error', error);
      
      return NextResponse.json({
        error: 'Failed to fetch balance sheet',
        message: error.message || 'Unknown error',
        details: error.stack
      }, { status: 500 });
    }
  }
);