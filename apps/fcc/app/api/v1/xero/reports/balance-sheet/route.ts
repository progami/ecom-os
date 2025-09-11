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
      
      // Check if we should force live data from Xero
      const forceRefresh = query.refresh === 'true' || query.source === 'live';
      
      // Parse date properly to avoid timezone issues
      let asAtDate: Date;
      if (query.date) {
        const [year, month, day] = (query.date as string).split('-').map(Number);
        asAtDate = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        asAtDate = new Date();
      }
      
      const periodStart = new Date(asAtDate.getFullYear(), 0, 1); // Start of year for the as-at date
      
      structuredLogger.info('[Balance Sheet API] Request params', {
        component: 'balance-sheet-report',
        forceRefresh,
        refresh: query.refresh,
        source: query.source,
        date: query.date
      });
      
      // Only check database if not forcing refresh
      if (!forceRefresh) {
        const databaseData = await ReportDatabaseFetcher.fetchBalanceSheet(periodStart, asAtDate);
        
        if (databaseData) {
          structuredLogger.info('[Balance Sheet API] Successfully fetched from database', {
            component: 'balance-sheet-report',
            source: 'database'
          });
          
          return NextResponse.json({
            ...databaseData,
            source: 'database',
            fetchedAt: new Date().toISOString()
          }, {
            headers: responseHeaders
          });
        }
      } else {
        structuredLogger.info('[Balance Sheet API] Force refresh requested, will fetch from Xero API', {
          component: 'balance-sheet-report',
          forceRefresh
        });
      }
      
      // Check if Xero API is disabled only if not forcing refresh
      if (!forceRefresh) {
        const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
        
        if (isXeroDisabled) {
          structuredLogger.info('[Balance Sheet API] Xero API is disabled, no data available', {
            component: 'balance-sheet-report'
          });
          
          return NextResponse.json({
            error: 'No balance sheet data available',
            message: 'Please import balance sheet data to view this report',
            recommendation: 'Go to Reports → Import Data to upload balance sheet data',
            source: 'none'
          }, { status: 404 });
        }
      }
      
      // Try to fetch from Xero API
      try {
        structuredLogger.info('[Balance Sheet API] Attempting to fetch from Xero API', {
          component: 'balance-sheet-report',
          forceRefresh,
          asAtDate: asAtDate.toISOString()
        });
        
        const tenantId = await getTenantId(request);
        if (!tenantId) {
          throw new Error('No Xero tenant ID available. Please ensure you are connected to Xero.');
        }
        
        structuredLogger.info('[Balance Sheet API] Got tenant ID, fetching Balance Sheet directly from Xero', {
          component: 'balance-sheet-report',
          tenantId,
          forceRefresh,
          asAtDate: asAtDate.toISOString()
        });

          // Use XeroReportFetcher to get the detailed Balance Sheet directly from Xero
          const detailedBS = await XeroReportFetcher.fetchDetailedBalanceSheet(tenantId, asAtDate);

          // Get session info for tracking who initiated the fetch
          const { validateSession, ValidationLevel } = await import('@/lib/auth/session-validation');
          const session = await validateSession(request, ValidationLevel.USER);
          const importedBy = session.isValid && session.user ? session.user.email : 'System';

          // Count the number of accounts fetched
          const accountCount = 
            (detailedBS.assets?.currentAssets?.length || 0) +
            (detailedBS.assets?.nonCurrentAssets?.length || 0) +
            (detailedBS.liabilities?.currentLiabilities?.length || 0) +
            (detailedBS.liabilities?.nonCurrentLiabilities?.length || 0) +
            (detailedBS.equity?.accounts?.length || 0);

          // Create ImportedReport entry for this API fetch
          const importedReport = await prisma.importedReport.create({
            data: {
              type: 'BALANCE_SHEET',
              source: 'API',
              periodStart: new Date(asAtDate.getFullYear(), 0, 1), // Start of year
              periodEnd: asAtDate,
              importedBy,
              status: 'COMPLETED',
              recordCount: accountCount,
              rawData: JSON.stringify(detailedBS),
              processedData: JSON.stringify(detailedBS),
              metadata: JSON.stringify({
                tenantId,
                fetchDate: new Date().toISOString(),
                totalAssets: detailedBS.totalAssets,
                totalLiabilities: detailedBS.totalLiabilities,
                netAssets: detailedBS.netAssets
              })
            }
          });

          structuredLogger.info('[Balance Sheet API] Created ImportedReport entry for API fetch', {
            component: 'balance-sheet-report',
            importedReportId: importedReport.id,
            recordCount: accountCount,
            importedBy
          });

          // Write to development log
          try {
            const fs = require('fs');
            fs.appendFileSync('development.log', 
              `\n[${new Date().toISOString()}] Balance Sheet API - Successfully created ImportedReport for API fetch\n` +
              `  Import ID: ${importedReport.id}\n` +
              `  Source: API\n` +
              `  Status: COMPLETED\n` +
              `  Record Count: ${accountCount}\n` +
              `  Imported By: ${importedBy}\n` +
              `  Period: ${periodStart.toISOString().split('T')[0]} to ${asAtDate.toISOString().split('T')[0]}\n` +
              `  Total Assets: ${detailedBS.totalAssets}\n` +
              `  Total Liabilities: ${detailedBS.totalLiabilities}\n`
            );
          } catch (logError) {
            // Silent fail
          }

          // Store the data in ReportData table with versioning support
          const { saveReportDataWithVersioning } = await import('@/lib/report-data-versioning');
          await saveReportDataWithVersioning({
            reportType: 'BALANCE_SHEET',
            periodStart: new Date(asAtDate.getFullYear(), 0, 1),
            periodEnd: asAtDate,
            data: detailedBS,
            summary: {
              totalAssets: detailedBS.totalAssets,
              totalLiabilities: detailedBS.totalLiabilities,
              netAssets: detailedBS.netAssets,
              currentRatio: detailedBS.currentRatio,
              quickRatio: detailedBS.quickRatio,
              debtToEquityRatio: detailedBS.debtToEquityRatio
            },
            importedReportId: importedReport.id,
            deactivatePrevious: true
          });

          structuredLogger.info('[Balance Sheet API] Stored balance sheet data in database', {
            component: 'balance-sheet-report',
            importedReportId: importedReport.id
          });

          // Get the last successful sync time
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

          // Add the last sync time to the response
          const balanceSheet = {
            ...detailedBS,
            lastSyncedAt: lastSync?.completedAt || null
          };

          structuredLogger.info('[Balance Sheet API] Successfully fetched from Xero', {
            component: 'balance-sheet-report',
            source: 'xero',
            importedReportId: importedReport.id
          });

          return NextResponse.json({
            ...balanceSheet,
            source: 'xero',
            importedReportId: importedReport.id
          }, {
            headers: responseHeaders
          });
      } catch (xeroError) {
        structuredLogger.error('[Balance Sheet API] Failed to fetch from Xero', {
          error: xeroError,
          component: 'balance-sheet-report'
        });
        
        // Create ImportedReport entry for failed API fetch
        try {
          const { validateSession, ValidationLevel } = await import('@/lib/auth/session-validation');
          const session = await validateSession(request, ValidationLevel.USER);
          const importedBy = session.isValid && session.user ? session.user.email : 'System';
          
          await prisma.importedReport.create({
            data: {
              type: 'BALANCE_SHEET',
              source: 'API',
              periodStart: periodStart,
              periodEnd: asAtDate,
              importedBy,
              status: 'FAILED',
              recordCount: 0,
              errorLog: xeroError instanceof Error ? xeroError.message : 'Unknown error',
              rawData: JSON.stringify({
                error: xeroError instanceof Error ? {
                  message: xeroError.message,
                  stack: xeroError.stack,
                  name: xeroError.name,
                  // Include Xero-specific error details if available
                  ...(xeroError as any).response?.body && { xeroResponse: (xeroError as any).response.body },
                  ...(xeroError as any).statusCode && { statusCode: (xeroError as any).statusCode }
                } : String(xeroError),
                context: {
                  asAtDate: asAtDate.toISOString(),
                  periodStart: periodStart.toISOString(),
                  periodEnd: asAtDate.toISOString(),
                  fetchAttemptTime: new Date().toISOString()
                }
              }),
              metadata: JSON.stringify({
                fetchDate: new Date().toISOString(),
                error: xeroError instanceof Error ? xeroError.stack : String(xeroError)
              })
            }
          });
          
          structuredLogger.info('[Balance Sheet API] Created ImportedReport entry for failed API fetch', {
            component: 'balance-sheet-report',
            error: xeroError instanceof Error ? xeroError.message : 'Unknown error'
          });
        } catch (dbError) {
          structuredLogger.error('[Balance Sheet API] Failed to create ImportedReport entry', {
            error: dbError,
            component: 'balance-sheet-report'
          });
        }
        
        // Log failure
        await auditLogger.logFailure(
          AuditAction.REPORT_GENERATE,
          AuditResource.BALANCE_SHEET,
          xeroError as Error,
          {
            metadata: {
              queryParams: query,
              duration: Date.now() - startTime
            }
          }
        );
        
        // If force refresh was requested, return the actual error
        if (forceRefresh) {
          return NextResponse.json(
            { 
              error: 'Failed to fetch from Xero API',
              message: xeroError instanceof Error ? xeroError.message : 'Unknown error occurred',
              recommendation: 'Please check your Xero connection and try again',
              source: 'error'
            },
            { status: 500 }
          );
        }
        
        // Otherwise, check if we have data in the database
        const databaseData = await ReportDatabaseFetcher.fetchBalanceSheet(periodStart, asAtDate);
        if (databaseData) {
          return NextResponse.json({
            ...databaseData,
            source: 'database',
            fetchedAt: new Date().toISOString(),
            warning: 'Failed to fetch latest data from Xero, showing cached data'
          }, {
            headers: responseHeaders
          });
        }
        
        return NextResponse.json(
          { 
            error: 'No balance sheet data available',
            message: 'Please import balance sheet data to view this report',
            recommendation: 'Go to Reports → Import Data to upload balance sheet data',
            source: 'none'
          },
          { status: 404 }
        );
      }
    } catch (error) {
      structuredLogger.error('[Balance Sheet API] Error fetching Balance Sheet', error, {
        component: 'balance-sheet-report'
      });
      
      // Log failure
      await auditLogger.logFailure(
        AuditAction.REPORT_GENERATE,
        AuditResource.BALANCE_SHEET,
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
          error: error instanceof Error ? error.message : 'Failed to fetch balance sheet',
          recommendation: 'Please import balance sheet data or check system logs',
          source: 'error'
        },
        { status: 500 }
      )
    }
  }
)