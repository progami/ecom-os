import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { createError, withErrorHandling } from '@/lib/errors/error-handler';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { structuredLogger } from '@/lib/logger';
import { getTenantId } from '@/lib/xero-helpers';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';

export const dynamic = 'force-dynamic';

// Validation schema for financial summary query
const financialSummaryQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'year']).optional().default('30d')
});

export const GET = withErrorHandling(
  withAuthValidation(
    { querySchema: financialSummaryQuerySchema, authLevel: ValidationLevel.XERO },
    async (request, { query, session }) => {
      const startTime = Date.now();
      
      try {
        structuredLogger.info('Financial summary API called - fetching from Xero');
      
      // Use validated query parameter
      const period = query?.period || '30d';
      
      // Calculate date range based on period
      const today = new Date();
      const startDate = new Date();
      
      switch(period) {
        case '7d':
          startDate.setDate(today.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(today.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(today.getDate() - 90);
          break;
        case 'year':
          startDate.setFullYear(today.getFullYear() - 1);
          break;
        default:
          startDate.setDate(today.getDate() - 30);
      }
      
      // Format dates for display
      const fromDate = startDate.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];
      
      // Get tenant ID
      const tenantId = await getTenantId(request);
      if (!tenantId) {
        structuredLogger.error('No Xero tenant ID found for financial summary');
        throw new Error('Xero is not connected');
      }
      
      structuredLogger.info('Fetching financial data from Xero', {
        tenantId,
        period,
        dateRange: { from: fromDate, to: toDate }
      });
      
      // Fetch Balance Sheet data directly from Xero
      const currentBalanceSheet = await XeroReportFetcher.fetchBalanceSheetSummary(tenantId);
      
      // Fetch Profit & Loss data directly from Xero for the specified period
      const currentProfitLoss = await XeroReportFetcher.fetchProfitLossSummary(tenantId, {
        fromDate,
        toDate
      });
      
      structuredLogger.info('Financial summary calculation completed', {
        component: 'financial-summary',
        period,
        balanceSheetSummary: currentBalanceSheet,
        profitLossSummary: currentProfitLoss,
        source: 'xero_direct'
      });
      
      // Fetch historical P&L data for comparison
      let historicalProfitLoss = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0
      };
      
      try {
        // Calculate previous period dates
        const previousStartDate = new Date(startDate);
        const previousEndDate = new Date(startDate);
        
        switch(period) {
          case '7d':
            previousStartDate.setDate(previousStartDate.getDate() - 7);
            break;
          case '30d':
            previousStartDate.setDate(previousStartDate.getDate() - 30);
            break;
          case '90d':
            previousStartDate.setDate(previousStartDate.getDate() - 90);
            break;
          case 'year':
            previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
            break;
        }
        
        const prevFromDate = previousStartDate.toISOString().split('T')[0];
        const prevToDate = previousEndDate.toISOString().split('T')[0];
        
        historicalProfitLoss = await XeroReportFetcher.fetchProfitLossSummary(tenantId, {
          fromDate: prevFromDate,
          toDate: prevToDate
        });
        
        structuredLogger.info('Historical P&L comparison fetched', {
          previousPeriod: { from: prevFromDate, to: prevToDate },
          historicalData: historicalProfitLoss
        });
      } catch (error) {
        structuredLogger.warn('Failed to fetch historical P&L data', { error });
      }
      
      // Calculate changes
      const changeAssets = 0; // Balance sheet comparison not available without historical snapshots
      const changeLiabilities = 0; // Balance sheet comparison not available
      const changeNetAssets = currentBalanceSheet.netAssets; // Just use current value
      const changeCashInBank = 0; // Cash flow change not available
      
      const response = {
        success: true,
        balanceSheet: {
          current: {
            totalAssets: currentBalanceSheet.totalAssets,
            totalLiabilities: currentBalanceSheet.totalLiabilities,
            currentAssets: currentBalanceSheet.currentAssets,
            currentLiabilities: currentBalanceSheet.currentLiabilities,
            netAssets: currentBalanceSheet.netAssets,
            cashInBank: currentBalanceSheet.cash,
            accountsReceivable: currentBalanceSheet.accountsReceivable,
            accountsPayable: currentBalanceSheet.accountsPayable,
            inventory: currentBalanceSheet.inventory,
            asOfDate: toDate
          },
          historical: {
            // Historical balance sheet comparison not available in current implementation
            // Would require storing historical snapshots
            totalAssets: currentBalanceSheet.totalAssets,
            totalLiabilities: currentBalanceSheet.totalLiabilities,
            currentAssets: currentBalanceSheet.currentAssets,
            currentLiabilities: currentBalanceSheet.currentLiabilities,
            netAssets: currentBalanceSheet.netAssets,
            cashInBank: currentBalanceSheet.cash,
            accountsReceivable: currentBalanceSheet.accountsReceivable,
            accountsPayable: currentBalanceSheet.accountsPayable,
            inventory: currentBalanceSheet.inventory,
            asOfDate: fromDate
          },
          changes: {
            totalAssets: changeAssets,
            totalLiabilities: changeLiabilities,
            currentAssets: 0, // No historical comparison available
            currentLiabilities: 0, // No historical comparison available
            netAssets: changeNetAssets,
            cashInBank: changeCashInBank,
            accountsReceivable: 0, // No historical comparison available
            accountsPayable: 0, // No historical comparison available
            inventory: 0 // No historical comparison available
          }
        },
        profitLoss: {
          totalIncome: currentProfitLoss.totalRevenue,
          totalExpenses: currentProfitLoss.totalExpenses,
          netProfit: currentProfitLoss.netProfit,
          period: {
            from: fromDate,
            to: toDate
          }
        },
        currency: 'GBP',
        source: 'xero_direct',
        note: 'Data fetched directly from Xero APIs',
        lastUpdated: new Date().toISOString()
      };
      
      // Log successful financial summary generation
      await auditLogger.logSuccess(
        AuditAction.REPORT_GENERATE,
        AuditResource.FINANCIAL_SUMMARY,
        {
          metadata: {
            period,
            dateRange: { from: fromDate, to: toDate },
            userId: session.user.userId
          },
          duration: Date.now() - startTime
        }
      );
      
        return NextResponse.json(response);
        
      } catch (error: any) {
        console.error('Financial summary error:', error);
        
        // Log failure
        await auditLogger.logFailure(
          AuditAction.REPORT_GENERATE,
          AuditResource.FINANCIAL_SUMMARY,
          error,
          {
            metadata: {
              period: query?.period || '30d',
              userId: session.user.userId
            },
            duration: Date.now() - startTime
          }
        );
        
        // Re-throw error to be handled by error handler
        throw error;
      }
    }
  ),
  { endpoint: '/api/v1/bookkeeping/financial-summary' }
);