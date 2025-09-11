import { NextRequest, NextResponse } from 'next/server';
import { ReportCacheManager, ReportType } from '@/lib/report-cache-manager';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
import { structuredLogger } from '@/lib/logger';
import { withValidation } from '@/lib/validation/middleware';
import { getTenantId } from '@/lib/xero-helpers';

// Define commonly warmed reports
const FREQUENTLY_ACCESSED_REPORTS: ReportType[] = [
  'BALANCE_SHEET',
  'PROFIT_LOSS', 
  'CASH_FLOW',
  'BANK_SUMMARY'
];

interface WarmCacheRequest {
  reports?: ReportType[];
  dateRanges?: Array<{
    from?: string;
    to?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    structuredLogger.info('[Cache Warm API] Starting cache warming', {
      component: 'cache-warm'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Xero connection required',
          details: 'Please connect to Xero to warm cache'
        },
        { status: 401 }
      );
    }

    // Parse request body
    let requestBody: WarmCacheRequest = {};
    try {
      const body = await request.text();
      if (body) {
        requestBody = JSON.parse(body);
      }
    } catch (parseError) {
      // Use defaults if no body or parsing fails
    }

    const reportsToWarm = requestBody.reports || FREQUENTLY_ACCESSED_REPORTS;
    const dateRanges = requestBody.dateRanges || [
      {}, // Current period (no date range)
      { // Current year to date
        from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      }
    ];

    structuredLogger.info('[Cache Warm API] Cache warming configuration', {
      component: 'cache-warm',
      tenantId,
      reportsToWarm,
      dateRanges: dateRanges.length
    });

    const results: Array<{
      reportType: ReportType;
      success: boolean;
      error?: string;
      dateRange?: { from?: string; to?: string };
    }> = [];

    // Warm each report with each date range
    for (const reportType of reportsToWarm) {
      for (const dateRange of dateRanges) {
        try {
          let success = false;
          const fromDate = dateRange.from ? new Date(dateRange.from) : undefined;
          const toDate = dateRange.to ? new Date(dateRange.to) : undefined;

          // Create cache params
          const cacheParams: Record<string, string> = {};
          if (fromDate) cacheParams.from = fromDate.toISOString().split('T')[0];
          if (toDate) cacheParams.to = toDate.toISOString().split('T')[0];

          switch (reportType) {
            case 'BALANCE_SHEET':
              success = await ReportCacheManager.warmCache(
                'BALANCE_SHEET',
                () => XeroReportFetcher.fetchBalanceSheetSummary(tenantId),
                { tenantId, params: cacheParams }
              );
              break;

            case 'PROFIT_LOSS':
              success = await ReportCacheManager.warmCache(
                'PROFIT_LOSS',
                () => XeroReportFetcher.fetchProfitLossSummary(tenantId, fromDate, toDate),
                { tenantId, params: cacheParams }
              );
              break;

            case 'CASH_FLOW':
              success = await ReportCacheManager.warmCache(
                'CASH_FLOW',
                () => XeroReportFetcher.fetchCashFlowSummary(tenantId, fromDate, toDate),
                { tenantId, params: cacheParams }
              );
              break;

            case 'BANK_SUMMARY':
              success = await ReportCacheManager.warmCache(
                'BANK_SUMMARY',
                () => XeroReportFetcher.fetchBankSummary(tenantId),
                { tenantId, params: cacheParams }
              );
              break;

            case 'AGED_RECEIVABLES':
              success = await ReportCacheManager.warmCache(
                'AGED_RECEIVABLES',
                () => XeroReportFetcher.fetchAgedReceivablesSummary(tenantId),
                { tenantId, params: cacheParams }
              );
              break;

            case 'AGED_PAYABLES':
              success = await ReportCacheManager.warmCache(
                'AGED_PAYABLES',
                () => XeroReportFetcher.fetchAgedPayablesSummary(tenantId),
                { tenantId, params: cacheParams }
              );
              break;

            case 'TRIAL_BALANCE':
              success = await ReportCacheManager.warmCache(
                'TRIAL_BALANCE',
                () => XeroReportFetcher.fetchTrialBalance(tenantId, toDate),
                { tenantId, params: cacheParams }
              );
              break;

            case 'VAT_LIABILITY':
              success = await ReportCacheManager.warmCache(
                'VAT_LIABILITY',
                () => XeroReportFetcher.calculateVATLiability(tenantId),
                { tenantId, params: cacheParams }
              );
              break;

            default:
              throw new Error(`Unsupported report type: ${reportType}`);
          }

          results.push({
            reportType,
            success,
            dateRange: Object.keys(cacheParams).length > 0 ? dateRange : undefined
          });

        } catch (error) {
          results.push({
            reportType,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            dateRange: Object.keys(dateRange).length > 0 ? dateRange : undefined
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    structuredLogger.info('[Cache Warm API] Cache warming completed', {
      component: 'cache-warm',
      tenantId,
      successCount,
      totalCount,
      successRate: Math.round((successCount / totalCount) * 100)
    });

    return NextResponse.json({
      success: successCount > 0,
      results,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount,
        successRate: Math.round((successCount / totalCount) * 100)
      },
      tenantId,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Cache Warm API] Error warming cache', error, {
      component: 'cache-warm'
    });

    return NextResponse.json(
      {
        error: 'Failed to warm cache',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

