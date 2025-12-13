import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { withValidation } from '@/lib/validation/middleware'
import { reportQuerySchema } from '@/lib/validation/schemas'
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger'
import { structuredLogger } from '@/lib/logger'
import { Decimal } from '@prisma/client/runtime/library'
import { XeroReportFetcher } from '@/lib/xero-report-fetcher'
import { getTenantId } from '@/lib/xero-helpers'
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher'

export const GET = withValidation(
  { querySchema: reportQuerySchema },
  async (request, { query }) => {
    const startTime = Date.now();
    try {
      // Set cache headers for better performance
      const responseHeaders = {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'max-age=600',
      };

      // Extract query parameters
      const url = new URL(request.url);
      const fromDate = url.searchParams.get('fromDate');
      const toDate = url.searchParams.get('toDate');
      const accountFilter = url.searchParams.get('accountFilter');
      
      // Set default date range (current financial year)
      const periodEnd = toDate ? new Date(toDate) : new Date();
      const periodStart = fromDate ? new Date(fromDate) : new Date(periodEnd.getFullYear(), 0, 1);
      
      structuredLogger.info('[General Ledger API] Processing request', {
        component: 'general-ledger-report',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        accountFilter
      });
      
      // Try to fetch from database first
      const databaseData = await ReportDatabaseFetcher.fetchGeneralLedger(
        periodStart, 
        periodEnd, 
        accountFilter || undefined
      );
      
      if (databaseData) {
        structuredLogger.info('[General Ledger API] Successfully fetched from database', {
          component: 'general-ledger-report',
          source: 'database',
          accountCount: databaseData.accounts?.length || 0,
          totalTransactions: databaseData.summary?.totalTransactions || 0
        });
        
        return NextResponse.json({
          ...databaseData,
          source: 'database',
          fetchedAt: new Date().toISOString()
        }, {
          headers: responseHeaders
        });
      }
      
      // Check if Xero API is disabled
      const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
      
      if (isXeroDisabled) {
        structuredLogger.info('[General Ledger API] Xero API is disabled, no data available', {
          component: 'general-ledger-report'
        });
        
        return NextResponse.json({
          error: 'No general ledger data available',
          message: 'Please import general ledger data to view this report',
          recommendation: 'Go to Reports → Import Data to upload general ledger data',
          source: 'none'
        }, { status: 404 });
      }
      
      // Only try Xero if not disabled (this code won't run with current settings)
      try {
        const tenantId = await getTenantId(request);
        if (tenantId) {
          structuredLogger.info('[General Ledger API] Fetching General Ledger directly from Xero', {
            component: 'general-ledger-report',
            tenantId
          });

          // Note: For General Ledger, we would need to build this from multiple Xero API calls
          // This is a placeholder for the Xero integration
          throw new Error('General Ledger direct Xero fetch not implemented');
        }
      } catch (xeroError) {
        structuredLogger.error('[General Ledger API] Failed to fetch from Xero', {
          error: xeroError,
          component: 'general-ledger-report'
        });
        
        // Log failure
        await auditLogger.logFailure(
          AuditAction.REPORT_GENERATE,
          AuditResource.GENERAL_LEDGER,
          xeroError as Error,
          {
            metadata: {
              queryParams: query,
              duration: Date.now() - startTime
            }
          }
        );
        
        return NextResponse.json(
          { 
            error: 'No general ledger data available',
            message: 'Please import general ledger data to view this report',
            recommendation: 'Go to Reports → Import Data to upload general ledger data',
            source: 'none'
          },
          { status: 404 }
        );
      }
    } catch (error) {
      structuredLogger.error('[General Ledger API] Error fetching General Ledger', error, {
        component: 'general-ledger-report'
      });
      
      // Log failure
      await auditLogger.logFailure(
        AuditAction.REPORT_GENERATE,
        AuditResource.GENERAL_LEDGER,
        error as Error,
        {
          metadata: {
            queryParams: query,
            duration: Date.now() - startTime
          }
        }
      );
      
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to fetch general ledger',
          recommendation: 'Please import general ledger data or check system logs',
          source: 'error'
        },
        { status: 500 }
      )
    }
  }
)