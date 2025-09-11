import { NextRequest, NextResponse } from 'next/server';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
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
      structuredLogger.info('[Cash Flow API] Starting cash flow report fetch', {
        component: 'cash-flow-report'
      });

    // Parse query parameters from validated query object
    const searchParams = request.nextUrl.searchParams;
    
    // Support both date range and month/year parameters
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const fromDateParam = query?.from || searchParams.get('from') || searchParams.get('dateRange_from');
    const toDateParam = query?.to || searchParams.get('to') || searchParams.get('dateRange_to');
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
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
      fromDate = new Date(year, month, 1);
      toDate = new Date(year, month + 1, 0); // Last day of the month
    }
    // Otherwise fall back to date range parameters
    else if (fromDateParam) {
      fromDate = new Date(fromDateParam);
      if (isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid from date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }
    
    if (toDateParam && !monthParam) {
      toDate = new Date(toDateParam);
      if (isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid to date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // Filter parameters
    const currency = query?.currency || searchParams.get('currency');
    const activities = (query?.activities || searchParams.get('activities'))?.split(',').filter(Boolean);
    const minAmountMin = searchParams.get('minAmount_min');
    const minAmountMax = searchParams.get('minAmount_max');
    
    // Check for force refresh parameter
    const forceRefresh = query?.refresh === 'true' || 
                        searchParams.get('refresh') === 'true' || 
                        searchParams.get('forceRefresh') === 'true';

    structuredLogger.info('[Cash Flow API] Processing cash flow request', {
      component: 'cash-flow-report',
      month: monthParam,
      year: yearParam,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
      currency,
      activities,
      minAmountRange: { min: minAmountMin, max: minAmountMax },
      forceRefresh
    });

    // Prepare cache parameters (include all filter parameters)
    const cacheParams: Record<string, string> = {};
    if (fromDate) cacheParams.from = fromDate.toISOString().split('T')[0];
    if (toDate) cacheParams.to = toDate.toISOString().split('T')[0];
    if (currency) cacheParams.currency = currency;
    if (activities) cacheParams.activities = activities.join(',');
    if (minAmountMin) cacheParams.minAmountMin = minAmountMin;
    if (minAmountMax) cacheParams.minAmountMax = minAmountMax;

    // Set default date range if not provided
    if (!fromDate) {
      // Default to last month
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
    }
    if (!toDate) {
      // If only fromDate provided, set toDate to end of that month
      toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0);
    }
    
    // Try to fetch from database first (only if not force refresh)
    if (!forceRefresh) {
      const databaseData = await ReportDatabaseFetcher.fetchCashFlow(fromDate, toDate);
      
      if (databaseData) {
        structuredLogger.info('[Cash Flow API] Successfully fetched from database', {
          component: 'cash-flow-report',
          source: 'database'
        });
        
        return NextResponse.json({
          ...databaseData,
          source: 'database',
          fetchedAt: new Date().toISOString(),
          filters: {
            dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
            currency,
            activities,
            minAmountRange: minAmountMin || minAmountMax ? { min: minAmountMin, max: minAmountMax } : null
          }
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // Check if Xero API is disabled
    const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
    
    if (isXeroDisabled) {
      structuredLogger.info('[Cash Flow API] Xero API is disabled, no data available', {
        component: 'cash-flow-report'
      });
      
      return NextResponse.json({
        error: 'No cash flow data available',
        message: 'Please import cash flow data to view this report',
        recommendation: 'Go to Reports → Import Data to upload cash flow data',
        source: 'none'
      }, { status: 404 });
    }
    
    // Only try Xero if not disabled (this code won't run with current settings)
    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      structuredLogger.error('[Cash Flow API] No Xero tenant ID found', {
        component: 'cash-flow-report'
      });
      
      return NextResponse.json(
        { 
          error: 'Xero connection required',
          details: 'Please connect to Xero to view cash flow data',
          recommendation: 'Go to Settings → Integrations → Connect Xero'
        },
        { status: 401 }
      );
    }
    
    // Fetch actual Cash Flow Statement with caching
    const cashFlowData = await ReportCacheManager.withCache(
      () => XeroReportFetcher.fetchCashFlowStatement(tenantId, fromDate, toDate),
      {
        tenantId,
        reportType: 'CASH_FLOW',
        params: cacheParams,
        forceRefresh
      }
    );

    // Schedule background refresh if cache is near expiry
    ReportCacheManager.scheduleBackgroundRefresh(
      () => XeroReportFetcher.fetchCashFlowStatement(tenantId, fromDate, toDate),
      {
        tenantId,
        reportType: 'CASH_FLOW',
        params: cacheParams
      }
    );

    // Get cache metrics for metadata
    const cacheMetrics = await ReportCacheManager.getMetrics(tenantId, 'CASH_FLOW');

    // Log the raw cash flow data structure
    try {
      const fs = require('fs');
      fs.appendFileSync('development.log', 
        `\n=== CASH FLOW STATEMENT DATA ${new Date().toISOString()} ===\n` +
        `From Cash Flow Statement:\n` +
        `Operating Activities: ${cashFlowData.operatingActivities?.netCashFromOperating || 0}\n` +
        `- Receipts from Customers: ${cashFlowData.operatingActivities?.receiptsFromCustomers || 0}\n` +
        `- Payments to Suppliers: ${cashFlowData.operatingActivities?.paymentsToSuppliers || 0}\n` +
        `- Payments to Employees: ${cashFlowData.operatingActivities?.paymentsToEmployees || 0}\n` +
        `Investing Activities: ${cashFlowData.investingActivities?.netCashFromInvesting || 0}\n` +
        `- Purchase of Assets: ${cashFlowData.investingActivities?.purchaseOfAssets || 0}\n` +
        `- Sale of Assets: ${cashFlowData.investingActivities?.saleOfAssets || 0}\n` +
        `Financing Activities: ${cashFlowData.financingActivities?.netCashFromFinancing || 0}\n` +
        `- Proceeds from Borrowing: ${cashFlowData.financingActivities?.proceedsFromBorrowing || 0}\n` +
        `- Repayment of Borrowing: ${cashFlowData.financingActivities?.repaymentOfBorrowing || 0}\n` +
        `- Dividends Paid: ${cashFlowData.financingActivities?.dividendsPaid || 0}\n` +
        `Net Cash Flow: ${cashFlowData.summary?.netCashFlow || 0}\n` +
        `Opening Balance: ${cashFlowData.summary?.openingBalance || 0}\n` +
        `Closing Balance: ${cashFlowData.summary?.closingBalance || 0}\n` +
        `Period: ${cashFlowData.fromDate} to ${cashFlowData.toDate}\n` +
        `=== END CASH FLOW STATEMENT ===\n`
      );
    } catch (logError) {
      // Silent fail
    }

    // The cashFlowData already has the proper structure from fetchCashFlowStatement
    const response = {
      // Use the data directly from the Cash Flow Statement
      ...cashFlowData,
      
      // Add additional metadata
      fetchedAt: new Date().toISOString(),
      source: 'xero',
      currency: currency || 'GBP',
      // Additional metadata for debugging
      filters: {
        dateRange: fromDate && toDate ? { from: fromDate.toISOString(), to: toDate.toISOString() } : null,
        currency,
        activities,
        minAmountRange: minAmountMin || minAmountMax ? { min: minAmountMin, max: minAmountMax } : null
      },
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

    structuredLogger.info('[Cash Flow API] Cash flow report generated successfully', {
      component: 'cash-flow-report',
      tenantId,
      netCashFlow: response.summary.netCashFlow,
      period: `${response.fromDate} to ${response.toDate}`
    });

    // Set cache headers for 15 minutes (cash flow changes frequently)
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: responseHeaders
    });

    } catch (error: any) {
      structuredLogger.error('[Cash Flow API] Error fetching cash flow from Xero', error, {
        component: 'cash-flow-report'
      });

      return NextResponse.json(
        {
          error: 'Failed to fetch cash flow data from Xero',
          details: error.message || 'Unknown error',
          recommendation: 'Please check your Xero connection and try again'
        },
        { status: 500 }
      );
    }
  }
)

