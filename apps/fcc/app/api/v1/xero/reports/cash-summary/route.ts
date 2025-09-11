import { NextRequest, NextResponse } from 'next/server';
import { XeroCashSummaryFetcher } from '@/lib/xero-cash-summary-fetcher';
import { ReportCacheManager } from '@/lib/report-cache-manager';
import { structuredLogger } from '@/lib/logger';
import { withValidation } from '@/lib/validation/middleware';
import { getTenantId } from '@/lib/xero-helpers';
import { reportQuerySchema } from '@/lib/validation/schemas';
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher';

export const GET = withValidation(
  { querySchema: reportQuerySchema },
  async (request, { query }) => {
    try {
      structuredLogger.info('[Cash Summary API] Starting cash summary report fetch', {
        component: 'cash-summary-report'
      });

      // Add logging to development.log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== CASH SUMMARY API REQUEST ${new Date().toISOString()} ===\n` +
          `Query: ${JSON.stringify(query || {})}\n` +
          `=== END REQUEST ===\n`
        );
      } catch (logError) {
        // Silent fail
      }

      // Parse query parameters from validated query object
      const searchParams = request.nextUrl.searchParams;
      
      // Support both date range and month/year parameters
      const monthParam = searchParams.get('month');
      const yearParam = searchParams.get('year');
      const fromDateParam = query?.from || searchParams.get('from') || searchParams.get('dateRange_from');
      const toDateParam = query?.to || searchParams.get('to') || searchParams.get('dateRange_to');
      const periodsParam = searchParams.get('periods') || '1';
      
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      let periods = parseInt(periodsParam, 10);
      
      if (isNaN(periods) || periods < 1 || periods > 12) {
        periods = 1;
      }
      
      // If month/year provided, use those
      if (monthParam && yearParam) {
        const month = parseInt(monthParam, 10) - 1; // JavaScript months are 0-indexed
        const year = parseInt(yearParam, 10);
        
        if (isNaN(month) || month < 0 || month > 11 || isNaN(year)) {
          return NextResponse.json(
            { error: 'Invalid month or year. Month should be 1-12, year should be YYYY' },
            { status: 400 }
          );
        }
        
        // Set date range to the full month
        toDate = new Date(year, month + 1, 0); // Last day of the month
        // Calculate fromDate based on periods
        fromDate = new Date(year, month - periods + 1, 1);
      }
      // Otherwise fall back to date range parameters
      else if (fromDateParam || toDateParam) {
        if (toDateParam) {
          toDate = new Date(toDateParam);
          if (isNaN(toDate.getTime())) {
            return NextResponse.json(
              { error: 'Invalid to date format. Use YYYY-MM-DD' },
              { status: 400 }
            );
          }
        } else {
          // Default to end of current month
          const now = new Date();
          toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        
        if (fromDateParam) {
          fromDate = new Date(fromDateParam);
          if (isNaN(fromDate.getTime())) {
            return NextResponse.json(
              { error: 'Invalid from date format. Use YYYY-MM-DD' },
              { status: 400 }
            );
          }
        } else {
          // Calculate fromDate based on periods from toDate
          fromDate = new Date(toDate);
          fromDate.setMonth(fromDate.getMonth() - periods + 1);
          fromDate.setDate(1);
        }
      } else {
        // Default to current month
        const now = new Date();
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        fromDate = new Date(now.getFullYear(), now.getMonth() - periods + 1, 1);
      }
      
      // Check for force refresh parameter
      const forceRefresh = query?.refresh === 'true' || searchParams.get('refresh') === 'true';

      structuredLogger.info('[Cash Summary API] Processing cash summary request', {
        component: 'cash-summary-report',
        month: monthParam,
        year: yearParam,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
        periods,
        forceRefresh
      });

      // Try to fetch from database first
      const databaseData = await ReportDatabaseFetcher.fetchCashSummary(fromDate, toDate);
      
      if (databaseData) {
        structuredLogger.info('[Cash Summary API] Successfully fetched from database', {
          component: 'cash-summary-report',
          source: 'database'
        });
        
        return NextResponse.json({
          ...databaseData,
          source: 'database',
          fetchedAt: new Date().toISOString()
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Check if Xero API is disabled
      const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
      
      if (isXeroDisabled) {
        structuredLogger.info('[Cash Summary API] Xero API is disabled, no data available', {
          component: 'cash-summary-report'
        });
        
        return NextResponse.json({
          error: 'No cash summary data available',
          message: 'Please import cash summary data to view this report',
          recommendation: 'Go to Reports → Import Data to upload cash summary data',
          source: 'none'
        }, { status: 404 });
      }
      
      // Get and validate tenant ID
      const tenantId = await getTenantId(request);
      if (!tenantId) {
        structuredLogger.error('[Cash Summary API] No Xero tenant ID found', {
          component: 'cash-summary-report'
        });
        
        return NextResponse.json(
          { 
            error: 'Xero connection required',
            details: 'Please connect to Xero to view cash summary data',
            recommendation: 'Go to Settings → Integrations → Connect Xero'
          },
          { status: 401 }
        );
      }

      // Prepare cache parameters
      const cacheParams: Record<string, string> = {};
      if (fromDate) cacheParams.from = fromDate.toISOString().split('T')[0];
      if (toDate) cacheParams.to = toDate.toISOString().split('T')[0];
      cacheParams.periods = periods.toString();

      // Fetch cash summary data with caching
      const cashSummaryData = await ReportCacheManager.withCache(
        () => XeroCashSummaryFetcher.fetchCashSummary(tenantId, toDate, periods),
        {
          tenantId,
          reportType: 'CASH_SUMMARY',
          params: cacheParams,
          forceRefresh
        }
      );

      // Schedule background refresh if cache is near expiry
      ReportCacheManager.scheduleBackgroundRefresh(
        () => XeroCashSummaryFetcher.fetchCashSummary(tenantId, toDate, periods),
        {
          tenantId,
          reportType: 'CASH_SUMMARY',
          params: cacheParams
        }
      );

      // Get cache metrics for metadata
      const cacheMetrics = await ReportCacheManager.getMetrics(tenantId, 'CASH_SUMMARY');

      const response = {
        ...cashSummaryData,
        fetchedAt: new Date().toISOString(),
        source: 'xero_accounting_api',
        cache: {
          ttl: '15 minutes',
          metrics: cacheMetrics ? {
            hitRate: cacheMetrics.totalRequests > 0 ? 
              Math.round((cacheMetrics.hits / cacheMetrics.totalRequests) * 100) : 0,
            totalRequests: cacheMetrics.totalRequests,
            lastRefresh: cacheMetrics.lastRefresh
          } : null,
          forceRefresh
        }
      };

      structuredLogger.info('[Cash Summary API] Cash summary report generated successfully', {
        component: 'cash-summary-report',
        tenantId,
        periodsReturned: response.periods.length,
        period: `${response.periods[0]?.month || ''} to ${response.periods[response.periods.length - 1]?.month || ''}`
      });

      // Set cache headers for 15 minutes
      const responseHeaders = {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'Content-Type': 'application/json'
      };

      return NextResponse.json(response, { 
        status: 200,
        headers: responseHeaders
      });

    } catch (error: any) {
      structuredLogger.error('[Cash Summary API] Error fetching cash summary from Xero', error, {
        component: 'cash-summary-report'
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch cash summary data from Xero',
          details: error.message || 'Unknown error',
          recommendation: 'Please check your Xero connection and try again'
        },
        { status: 500 }
      );
    }
  }
)