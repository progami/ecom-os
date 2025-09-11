import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
    
    // Add logging to development.log
    const fs = require('fs');
    const logPath = 'development.log';
    const logEntry = `\n[${new Date().toISOString()}] [P&L API] Request received - Query: ${JSON.stringify(query || {})}\n`;
    try {
      fs.appendFileSync(logPath, logEntry);
    } catch (logError) {
      console.error('Failed to write to development.log:', logError);
    }
    
    try {
      // Set cache headers for better performance
      const responseHeaders = {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'max-age=600',
      };
      
      // Check if we should force live data from Xero
      const forceRefresh = query.refresh === 'true' || query.source === 'live';
      
      // Get date range from query params or default to last 30 days
      let endDate: Date;
      let startDate: Date;
      
      // Parse date properly to avoid timezone issues
      if (query?.date) {
        const [year, month, day] = (query.date as string).split('-').map(Number);
        endDate = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        endDate = new Date();
      }
      
      startDate = new Date(endDate);
      const periods = query?.periods || 1
      const timeframe = query?.timeframe || 'MONTH'
      
      // Calculate start date based on timeframe
      switch (timeframe) {
        case 'YEAR':
          // For year-end reports, fetch from January 1st to the end date
          startDate = new Date(endDate.getFullYear(), 0, 1) // January 1st of the same year
          break
        case 'QUARTER':
          startDate.setMonth(startDate.getMonth() - (periods * 3))
          break
        case 'MONTH':
        default:
          // For monthly reports, we want the full month
          // If endDate is May 31, 2025, we want:
          // - startDate: May 1, 2025
          // - endDate: May 31, 2025
          
          // Get the year and month from endDate
          const year = endDate.getFullYear();
          const month = endDate.getMonth();
          
          // Set startDate to first day of the month
          startDate = new Date(year, month, 1);
          
          // If periods > 1, go back that many months
          if (periods > 1) {
            startDate.setMonth(startDate.getMonth() - periods + 1);
          }
          
          // Set endDate to last day of the month
          endDate = new Date(year, month + 1, 0);
          break
      }

      structuredLogger.info('[P&L API] Request received', {
        component: 'profit-loss-report',
        query,
        forceRefresh,
        refresh: query.refresh,
        source: query.source,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dateCalculation: {
          originalEndDate: query?.date || 'defaulted to today',
          calculatedStartDate: startDate.toISOString().split('T')[0],
          calculatedEndDate: endDate.toISOString().split('T')[0],
          periods,
          timeframe
        }
      });
      
      // Log to development.log for debugging
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n[${new Date().toISOString()}] [P&L API] Date calculation:\n` +
          `  Original end date: ${query?.date || 'defaulted to today'}\n` +
          `  Calculated period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n` +
          `  Periods: ${periods}, Timeframe: ${timeframe}\n`
        );
      } catch (logError) {
        // Silent fail
      }

      // Check if we have date parameters - if so, attempt transaction-based calculation
      const hasDateParams = query?.date || query?.periods || query?.timeframe;
      const useTransactionBasedCalculation = false; // Set to false until we have proper transaction data
      
      // Only check database if not forcing refresh
      if (!forceRefresh) {
        const databaseData = await ReportDatabaseFetcher.fetchProfitLoss(startDate, endDate);
        
        if (databaseData) {
          structuredLogger.info('[P&L API] Successfully fetched from database', {
            component: 'profit-loss-report',
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
        structuredLogger.info('[P&L API] Force refresh requested, will fetch from Xero API', {
          component: 'profit-loss-report',
          forceRefresh
        });
      }
      
      // Check if Xero API is disabled only if not forcing refresh
      if (!forceRefresh) {
        const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
        
        if (isXeroDisabled) {
          structuredLogger.info('[P&L API] Xero API is disabled, no data available', {
            component: 'profit-loss-report'
          });
          
          return NextResponse.json({
            error: 'No profit & loss data available',
            message: 'Please import profit & loss data to view this report',
            recommendation: 'Go to Reports → Import Data to upload profit & loss data',
            source: 'none'
          }, { status: 404 });
        }
      }
      
      // Try to fetch from Xero API
      try {
        const tenantId = await getTenantId(request);
        if (!tenantId) {
          throw new Error('No Xero tenant ID available. Please ensure you are connected to Xero.');
        }
        
        structuredLogger.info('[P&L API] Fetching P&L report directly from Xero', {
          component: 'profit-loss-report',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          tenantId,
          forceRefresh
        });

        // Use XeroReportFetcher to get the detailed P&L directly from Xero
        const detailedPL = await XeroReportFetcher.fetchDetailedProfitLoss(
          tenantId,
          startDate,
          endDate
        );

        // Get session info for tracking who initiated the fetch
        const { validateSession, ValidationLevel } = await import('@/lib/auth/session-validation');
        const session = await validateSession(request, ValidationLevel.USER);
        const importedBy = session.isValid && session.user ? session.user.email : 'System';

        // Count the number of line items in the P&L (actual line items not just summaries)
        const recordCount = 
          detailedPL.revenue.accounts.length +
          detailedPL.otherIncome.accounts.length +
          detailedPL.costOfGoodsSold.accounts.length +
          detailedPL.operatingExpenses.accounts.length +
          detailedPL.otherExpenses.accounts.length;

        // Create ImportedReport entry for this API fetch
        const importedReport = await prisma.importedReport.create({
          data: {
            type: 'PROFIT_LOSS',
            source: 'API',
            periodStart: startDate,
            periodEnd: endDate,
            importedBy,
            status: 'COMPLETED',
            recordCount,
            rawData: JSON.stringify(detailedPL),
            processedData: JSON.stringify(detailedPL),
            metadata: JSON.stringify({
              tenantId,
              fetchDate: new Date().toISOString(),
              totalRevenue: detailedPL.totalRevenue,
              totalExpenses: detailedPL.totalExpenses,
              netProfit: detailedPL.netProfit,
              accountCounts: {
                revenue: detailedPL.revenue.accounts.length,
                otherIncome: detailedPL.otherIncome.accounts.length,
                costOfGoodsSold: detailedPL.costOfGoodsSold.accounts.length,
                operatingExpenses: detailedPL.operatingExpenses.accounts.length,
                otherExpenses: detailedPL.otherExpenses.accounts.length
              }
            })
          }
        });

        structuredLogger.info('[P&L API] Created ImportedReport entry for API fetch', {
          component: 'profit-loss-report',
          importedReportId: importedReport.id,
          recordCount,
          importedBy
        });

        // Write to development log
        try {
          const fs = require('fs');
          fs.appendFileSync('development.log', 
            `\n[${new Date().toISOString()}] P&L API - Successfully created ImportedReport for API fetch\n` +
            `  Import ID: ${importedReport.id}\n` +
            `  Source: API\n` +
            `  Status: COMPLETED\n` +
            `  Record Count: ${recordCount}\n` +
            `  Imported By: ${importedBy}\n` +
            `  Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n` +
            `  Total Revenue: ${detailedPL.totalRevenue}\n` +
            `  Total Expenses: ${detailedPL.totalExpenses}\n` +
            `  Net Profit: ${detailedPL.netProfit}\n` +
            `  Line Items: Revenue(${detailedPL.revenue.accounts.length}) + OtherIncome(${detailedPL.otherIncome.accounts.length}) + COGS(${detailedPL.costOfGoodsSold.accounts.length}) + OpEx(${detailedPL.operatingExpenses.accounts.length}) + OtherEx(${detailedPL.otherExpenses.accounts.length})\n`
          );
        } catch (logError) {
          // Silent fail
        }

        // Store the data in ReportData table with versioning support
        const { saveReportDataWithVersioning } = await import('@/lib/report-data-versioning');
        await saveReportDataWithVersioning({
          reportType: 'PROFIT_LOSS',
          periodStart: startDate,
          periodEnd: endDate,
          data: detailedPL,
          summary: {
            totalRevenue: detailedPL.totalRevenue,
            totalExpenses: detailedPL.totalExpenses,
            grossProfit: detailedPL.grossProfit,
            netProfit: detailedPL.netProfit,
            operatingExpenses: detailedPL.operatingExpenses,
            otherIncome: detailedPL.otherIncome,
            otherExpenses: detailedPL.otherExpenses,
            recordCount,
            accountCounts: {
              revenue: detailedPL.revenue.accounts.length,
              otherIncome: detailedPL.otherIncome.accounts.length,
              costOfGoodsSold: detailedPL.costOfGoodsSold.accounts.length,
              operatingExpenses: detailedPL.operatingExpenses.accounts.length,
              otherExpenses: detailedPL.otherExpenses.accounts.length
            }
          },
          importedReportId: importedReport.id,
          deactivatePrevious: true
        });

        structuredLogger.info('[P&L API] Stored P&L data in database', {
          component: 'profit-loss-report',
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

        // Return Xero's actual P&L values with detailed breakdown
        const profitLoss = {
          totalRevenue: detailedPL.totalRevenue,
          totalExpenses: detailedPL.totalExpenses,
          grossProfit: detailedPL.grossProfit,
          netProfit: detailedPL.netProfit,
          operatingExpenses: detailedPL.totalOperatingExpenses,
          costOfGoodsSold: detailedPL.costOfGoodsSold.totalCostOfGoodsSold,
          revenue: detailedPL.totalRevenue, // Duplicate for backwards compatibility
          expenses: detailedPL.totalExpenses, // Duplicate for backwards compatibility
          revenueChange: 0, // Would need historical data
          profitChange: 0, // Would need historical data
          otherIncome: detailedPL.totalOtherIncome,
          otherExpenses: detailedPL.totalOtherExpenses,
          source: 'xero_direct',
          lastSyncedAt: lastSync?.completedAt || null,
          // Include detailed breakdown for the Import Details modal
          detailedBreakdown: {
            revenue: detailedPL.revenue,
            otherIncome: detailedPL.otherIncome,
            costOfGoodsSold: detailedPL.costOfGoodsSold,
            operatingExpenses: detailedPL.operatingExpenses,
            otherExpenses: detailedPL.otherExpenses
          },
          metadata: {
            calculationType: 'xero_report',
            dateRange: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString()
            },
            dataAsOf: new Date().toISOString(),
            recordCount,
            accountCounts: {
              revenue: detailedPL.revenue.accounts.length,
              otherIncome: detailedPL.otherIncome.accounts.length,
              costOfGoodsSold: detailedPL.costOfGoodsSold.accounts.length,
              operatingExpenses: detailedPL.operatingExpenses.accounts.length,
              otherExpenses: detailedPL.otherExpenses.accounts.length
            }
          }
        };

        structuredLogger.info('[P&L API] Successfully fetched P&L from Xero', {
          component: 'profit-loss-report',
          profitLoss
        });

        // Log successful P&L generation
        await auditLogger.logSuccess(
          AuditAction.REPORT_GENERATE,
          AuditResource.PROFIT_LOSS,
          {
            metadata: {
              queryParams: query,
              dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
              duration: Date.now() - startTime,
              source: 'xero_direct'
            }
          }
        );

        return NextResponse.json(profitLoss, {
          headers: responseHeaders
        });
      } catch (xeroError) {
        structuredLogger.error('[P&L API] Failed to fetch from Xero', {
          error: xeroError,
          component: 'profit-loss-report'
        });
        
        // Create ImportedReport entry for failed API fetch
        try {
          const { validateSession, ValidationLevel } = await import('@/lib/auth/session-validation');
          const session = await validateSession(request, ValidationLevel.USER);
          const importedBy = session.isValid && session.user ? session.user.email : 'System';
          
          await prisma.importedReport.create({
            data: {
              type: 'PROFIT_LOSS',
              source: 'API',
              periodStart: startDate,
              periodEnd: endDate,
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
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString(),
                  timeframe: query.timeframe,
                  periods: query.periods,
                  fetchAttemptTime: new Date().toISOString()
                }
              }),
              metadata: JSON.stringify({
                fetchDate: new Date().toISOString(),
                error: xeroError instanceof Error ? xeroError.stack : String(xeroError)
              })
            }
          });
          
          structuredLogger.info('[P&L API] Created ImportedReport entry for failed API fetch', {
            component: 'profit-loss-report',
            error: xeroError instanceof Error ? xeroError.message : 'Unknown error'
          });
        } catch (dbError) {
          structuredLogger.error('[P&L API] Failed to create ImportedReport entry', {
            error: dbError,
            component: 'profit-loss-report'
          });
        }
        
        // Log failure
        await auditLogger.logFailure(
          AuditAction.REPORT_GENERATE,
          AuditResource.PROFIT_LOSS,
          xeroError as Error,
          {
            metadata: {
              queryParams: query,
              dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
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
        
        // Otherwise, fall back to database logic below
        structuredLogger.info('[P&L API] Falling back to database after Xero error', {
          component: 'profit-loss-report'
        });
      }

      // If we reach here and force refresh wasn't requested, try to get data from database
      if (!forceRefresh) {
        const databaseData = await ReportDatabaseFetcher.fetchProfitLoss(startDate, endDate);
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
      }
      
      // Fall back to calculating from GL accounts if no ReportData available
      structuredLogger.info('[P&L API] Using GL account balances as fallback', {
        component: 'profit-loss-report',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timeframe,
        periods,
        calculationMethod: 'gl_account_balances',
        dataType: 'cumulative_all_time'
      });

      // Fetch P&L data from database GL accounts and transactions
      // Get revenue accounts with their latest balances
      const revenueAccounts = await prisma.chartOfAccount.findMany({
        where: {
          class: 'REVENUE',
          status: 'ACTIVE'
        },
        include: {
          balances: {
            orderBy: {
              periodDate: 'desc'
            },
            take: 1
          }
        }
      });

      // Get expense accounts with their latest balances
      const expenseAccounts = await prisma.chartOfAccount.findMany({
        where: {
          class: 'EXPENSE',
          status: 'ACTIVE'
        },
        include: {
          balances: {
            orderBy: {
              periodDate: 'desc'
            },
            take: 1
          }
        }
      });

      // Calculate totals from account balances
      let totalRevenue = new Decimal(0);
      let totalExpenses = new Decimal(0);
      let operatingExpenses = new Decimal(0);
      let otherIncome = new Decimal(0);
      let otherExpenses = new Decimal(0);

      // Process revenue accounts
      for (const account of revenueAccounts) {
        if (account.balances && account.balances.length > 0) {
          // Revenue accounts typically have negative balances
          const balance = account.balances[0].closingBalance;
          const amount = new Decimal(balance).abs();
          
          if (account.type === 'OTHERINCOME') {
            otherIncome = otherIncome.add(amount);
          } else {
            totalRevenue = totalRevenue.add(amount);
          }
        }
      }

      // Process expense accounts
      for (const account of expenseAccounts) {
        if (account.balances && account.balances.length > 0) {
          const balance = account.balances[0].closingBalance;
          const amount = new Decimal(balance).abs();
          
          if (account.type === 'OVERHEADS' || account.type === 'EXPENSE') {
            operatingExpenses = operatingExpenses.add(amount);
            totalExpenses = totalExpenses.add(amount);
          } else {
            otherExpenses = otherExpenses.add(amount);
            totalExpenses = totalExpenses.add(amount);
          }
        }
      }

      // Calculate profit metrics
      const grossProfit = totalRevenue.sub(new Decimal(0)); // Would need COGS accounts
      // Fixed: otherExpenses is already included in totalExpenses, don't subtract twice
      const netProfit = totalRevenue.add(otherIncome).sub(totalExpenses);

      // Enhanced logging for debugging
      structuredLogger.info('[P&L API] Calculation breakdown', {
        component: 'profit-loss-report',
        calculation: {
          totalRevenue: totalRevenue.toNumber(),
          otherIncome: otherIncome.toNumber(),
          operatingExpenses: operatingExpenses.toNumber(),
          otherExpenses: otherExpenses.toNumber(),
          totalExpenses: totalExpenses.toNumber(),
          formula: `(${totalRevenue.toNumber()} + ${otherIncome.toNumber()}) - ${totalExpenses.toNumber()}`,
          netProfit: netProfit.toNumber()
        },
        accountCounts: {
          revenueAccounts: revenueAccounts.length,
          expenseAccounts: expenseAccounts.length
        }
      });

      // Check if we have any data
      const hasData = revenueAccounts.length > 0 || expenseAccounts.length > 0;
      
      if (!hasData && !forceRefresh) {
        return NextResponse.json({
          error: 'No profit & loss data available',
          message: 'Please import profit & loss data to view this report',
          recommendation: 'Go to Reports → Import Data to upload profit & loss data',
          source: 'none'
        }, { status: 404 });
      }

      const plSummary = {
        totalRevenue: totalRevenue.toNumber(),
        totalExpenses: totalExpenses.toNumber(),
        grossProfit: grossProfit.toNumber(),
        netProfit: netProfit.toNumber(),
        operatingExpenses: operatingExpenses.toNumber(),
        otherIncome: otherIncome.toNumber(),
        otherExpenses: otherExpenses.toNumber()
      };

      // For period comparison, we would need historical snapshots
      // Since we're using current GL account balances, we can't do period comparisons
      // This would require storing historical snapshots during sync
      let revenueChange = 0;
      let profitChange = 0;
      
      structuredLogger.info('[P&L API] Period comparison not available with current GL balances', {
        component: 'profit-loss-report',
        note: 'Historical snapshots would be needed for accurate period comparisons'
      });

      // Get the last successful sync time from the correct table
      const lastSync = await prisma.syncLog.findFirst({
        where: {
          status: 'success',
          syncType: { in: ['full_sync', 'incremental_sync'] }
        },
        orderBy: {
          completedAt: 'desc'
        },
        select: {
          completedAt: true,
          syncType: true,
          recordsCreated: true
        }
      });

      // Format response to match frontend expectations
      const profitLoss = {
        totalRevenue: plSummary.totalRevenue,
        totalExpenses: plSummary.totalExpenses,
        grossProfit: plSummary.grossProfit,
        netProfit: plSummary.netProfit,
        operatingExpenses: plSummary.operatingExpenses,
        costOfGoodsSold: 0, // Not directly available from summary, would need detailed report
        revenue: plSummary.totalRevenue, // Duplicate for backwards compatibility
        expenses: plSummary.totalExpenses, // Duplicate for backwards compatibility
        revenueChange,
        profitChange,
        otherIncome: plSummary.otherIncome,
        otherExpenses: plSummary.otherExpenses,
        source: 'database_gl_accounts', // Indicate data source
        lastSyncedAt: lastSync?.completedAt || null,
        syncType: lastSync?.syncType || null,
        itemsSynced: lastSync?.recordsCreated || 0,
        // Add metadata about the calculation
        metadata: {
          calculationType: 'cumulative_all_time',
          dateRangeRequested: hasDateParams ? {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            note: 'Date range parameters were provided but P&L shows all-time cumulative balances'
          } : null,
          dataAsOf: new Date().toISOString(),
          note: 'This P&L report shows cumulative all-time balances from GL accounts. For period-specific P&L, transaction-level data sync is required.'
        }
      }

      structuredLogger.info('[P&L API] Successfully fetched P&L from database', {
        component: 'profit-loss-report',
        profitLoss
      });

      // Log successful P&L generation
      await auditLogger.logSuccess(
        AuditAction.REPORT_GENERATE,
        AuditResource.PROFIT_LOSS,
        {
          metadata: {
            queryParams: query,
            dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
            duration: Date.now() - startTime,
            source: 'database_gl_accounts'
          }
        }
      );

      // Log successful response to development.log
      try {
        const successLog = `[${new Date().toISOString()}] [P&L API] Success - Returned P&L data with source: ${profitLoss.source}, duration: ${Date.now() - startTime}ms\n`;
        fs.appendFileSync(logPath, successLog);
      } catch (logError) {
        // Silent fail
      }
      
      return NextResponse.json(profitLoss, {
        headers: responseHeaders
      })
    } catch (error) {
      structuredLogger.error('[P&L API] Error fetching Profit & Loss from database', error, {
        component: 'profit-loss-report'
      });
      
      // Log error to development.log
      try {
        const errorLog = `[${new Date().toISOString()}] [P&L API] ERROR - ${error instanceof Error ? error.message : 'Unknown error'}, Stack: ${error instanceof Error ? error.stack : 'N/A'}\n`;
        fs.appendFileSync(logPath, errorLog);
      } catch (logError) {
        // Silent fail
      }
      
      // Log failure
      await auditLogger.logFailure(
        AuditAction.REPORT_GENERATE,
        AuditResource.PROFIT_LOSS,
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
          error: error instanceof Error ? error.message : 'Failed to fetch profit & loss from database',
          recommendation: 'Please ensure data has been synced from Xero'
        },
        { status: 500 }
      )
    }
  }
)