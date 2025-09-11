import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { withValidation } from '@/lib/validation/middleware'
import { reportQuerySchema } from '@/lib/validation/schemas'
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger'
import { structuredLogger } from '@/lib/logger'
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
      
      // Try to fetch from database first
      const asAtDate = query.date ? new Date(query.date as string) : new Date();
      const importId = query.importId as string | undefined;
      
      const databaseData = await ReportDatabaseFetcher.fetchTrialBalance(asAtDate, importId);
      
      if (databaseData) {
        structuredLogger.info('[Trial Balance API] Successfully fetched from database', {
          component: 'trial-balance-report',
          source: 'database',
          asAtDate: asAtDate.toISOString()
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
        structuredLogger.info('[Trial Balance API] Xero API is disabled, no data available', {
          component: 'trial-balance-report'
        });
        
        return NextResponse.json({
          error: 'No trial balance data available',
          message: 'Please import trial balance data to view this report',
          recommendation: 'Go to Reports → Import Data to upload trial balance data',
          source: 'none'
        }, { status: 404 });
      }
      
      // If we reach here, no data was found and Xero is disabled
      structuredLogger.info('[Trial Balance API] No trial balance data available', {
        component: 'trial-balance-report',
        asAtDate: asAtDate.toISOString()
      });
      
      return NextResponse.json({
        error: 'No trial balance data available',
        message: 'Please import trial balance data to view this report',
        recommendation: 'Go to Reports → Import Data to upload trial balance data',
        source: 'none'
      }, { status: 404 });
      
    } catch (error) {
      structuredLogger.error('[Trial Balance API] Error fetching Trial Balance', error, {
        component: 'trial-balance-report'
      });
      
      // Log failure
      await auditLogger.logFailure(
        AuditAction.REPORT_GENERATE,
        AuditResource.TRIAL_BALANCE,
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
          error: error instanceof Error ? error.message : 'Failed to fetch trial balance',
          recommendation: 'Please import trial balance data or check system logs',
          source: 'error'
        },
        { status: 500 }
      )
    }
  }
)