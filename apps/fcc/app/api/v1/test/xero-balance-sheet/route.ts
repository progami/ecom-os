import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
import { structuredLogger } from '@/lib/logger';

// Direct test endpoint - no auth required for testing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2025-06-30';
    
    structuredLogger.info('[Test Xero Balance Sheet] Starting', { date });

    // Get user with Xero credentials
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null },
        xeroAccessToken: { not: null }
      }
    });

    if (!user || !user.tenantId) {
      return NextResponse.json({
        error: 'No Xero credentials found',
        message: 'Please connect to Xero first'
      }, { status: 400 });
    }

    structuredLogger.info('[Test Xero Balance Sheet] Found user with tenant', {
      tenantId: user.tenantId
    });

    // Fetch directly from Xero API using XeroReportFetcher
    const asAtDate = new Date(date);
    const xeroData = await XeroReportFetcher.fetchBalanceSheetSummary(user.tenantId, asAtDate);

    const response = {
      date,
      totalAssets: xeroData.totalAssets,
      totalLiabilities: xeroData.totalLiabilities,
      netAssets: xeroData.netAssets,
      currentAssets: xeroData.currentAssets,
      currentLiabilities: xeroData.currentLiabilities,
      cash: xeroData.cash,
      equity: xeroData.equity,
      accountsReceivable: xeroData.accountsReceivable,
      accountsPayable: xeroData.accountsPayable,
      inventory: xeroData.inventory,
      source: 'xero_api_direct',
      fetchedAt: new Date().toISOString(),
      tenantId: user.tenantId
    };

    structuredLogger.info('[Test Xero Balance Sheet] Success', response);

    return NextResponse.json(response);
  } catch (error: any) {
    structuredLogger.error('[Test Xero Balance Sheet] Error', error);
    
    return NextResponse.json({
      error: 'Failed to fetch from Xero',
      message: error.message || 'Unknown error',
      details: error.response?.data || error.stack
    }, { status: 500 });
  }
}