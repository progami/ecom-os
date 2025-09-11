import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withValidation } from '@/lib/validation/middleware'
import { reportQuerySchema } from '@/lib/validation/schemas'
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger'
import { structuredLogger } from '@/lib/logger'
import { Decimal } from '@prisma/client/runtime/library'
import { XeroReportFetcher } from '@/lib/xero-report-fetcher'
import { getTenantId } from '@/lib/xero-helpers'
import { withCache, cacheKeys } from '@/lib/api-cache'
import { performanceMonitor } from '@/lib/performance-monitor'

export const GET = withValidation(
  { querySchema: reportQuerySchema },
  async (request: NextRequest, { query }) => {
    const startTime = Date.now();
    
    try {
      // Parse query parameters
      const endDate = query?.date ? new Date(query.date) : new Date()
      const startDate = new Date(endDate)
      const periods = query?.periods || 1
      const timeframe = query?.timeframe || 'MONTH'
      const forceRefresh = query?.refresh === 'true'
      
      // Calculate start date based on timeframe
      switch (timeframe) {
        case 'YEAR':
          startDate.setFullYear(startDate.getFullYear() - periods)
          break
        case 'QUARTER':
          startDate.setMonth(startDate.getMonth() - (periods * 3))
          break
        case 'MONTH':
        default:
          startDate.setMonth(startDate.getMonth() - periods)
          break
      }

      // Create cache key based on query parameters
      const cacheKey = cacheKeys.profitLoss({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periods,
        timeframe
      });

      // Use caching wrapper
      return await withCache(
        request,
        async () => {
          // Measure API performance
          return await performanceMonitor.measureAPICall(
            'xero/reports/profit-loss',
            async () => {
              // Try to fetch directly from Xero first
              const tenantId = await getTenantId(request);
              if (tenantId) {
                structuredLogger.info('[P&L API] Fetching P&L report directly from Xero', {
                  component: 'profit-loss-report',
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString(),
                  tenantId
                });

                // Use XeroReportFetcher to get the P&L directly from Xero
                const xeroPL = await XeroReportFetcher.fetchProfitLossSummary(
                  tenantId,
                  startDate,
                  endDate
                );

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
                    completedAt: true,
                    syncType: true,
                    recordsCreated: true
                  }
                });

                // Get detailed account breakdown
                const accountBreakdown = await getDetailedAccountBreakdown(startDate, endDate);

                // Calculate margins
                const margins = {
                  grossMargin: xeroPL.totalRevenue > 0 
                    ? ((xeroPL.grossProfit / xeroPL.totalRevenue) * 100) 
                    : 0,
                  operatingMargin: xeroPL.totalRevenue > 0 
                    ? (((xeroPL.totalRevenue - xeroPL.operatingExpenses) / xeroPL.totalRevenue) * 100) 
                    : 0,
                  netMargin: xeroPL.totalRevenue > 0 
                    ? ((xeroPL.netProfit / xeroPL.totalRevenue) * 100) 
                    : 0,
                  ebitdaMargin: xeroPL.totalRevenue > 0 
                    ? (((xeroPL.netProfit + xeroPL.operatingExpenses * 0.1) / xeroPL.totalRevenue) * 100) // Approximate EBITDA
                    : 0
                };

                // Get trend data for the last 12 periods
                const trends = await getTrendData(startDate, endDate, timeframe);

                // Return enhanced P&L data structure
                return {
                  revenue: {
                    operatingRevenue: accountBreakdown.operatingRevenue,
                    otherIncome: accountBreakdown.otherIncome,
                    totalRevenue: xeroPL.totalRevenue
                  },
                  expenses: {
                    costOfSales: accountBreakdown.costOfSales,
                    operatingExpenses: accountBreakdown.operatingExpenses,
                    otherExpenses: accountBreakdown.otherExpenses,
                    totalExpenses: xeroPL.totalExpenses
                  },
                  profitability: {
                    grossProfit: xeroPL.grossProfit,
                    operatingProfit: xeroPL.totalRevenue - xeroPL.operatingExpenses,
                    netProfit: xeroPL.netProfit,
                    ebitda: xeroPL.netProfit + (xeroPL.operatingExpenses * 0.1) // Approximate
                  },
                  margins,
                  trends,
                  comparison: await getComparison(startDate, endDate, timeframe),
                  breakdown: {
                    revenueByCategory: accountBreakdown.revenueByCategory,
                    expensesByCategory: accountBreakdown.expensesByCategory
                  },
                  reportDate: endDate.toISOString(),
                  fromDate: startDate.toISOString(),
                  toDate: endDate.toISOString(),
                  fetchedAt: new Date().toISOString(),
                  source: 'xero_direct',
                  currency: 'GBP',
                  lastSyncedAt: lastSync?.completedAt || null,
                  syncType: lastSync?.syncType || null,
                  itemsSynced: lastSync?.recordsCreated || 0
                };
              }

              // Fallback to database if Xero is not available
              return await getFromDatabase(startDate, endDate);
            }
          );
        },
        {
          key: cacheKey,
          cacheOptions: {
            maxAge: 300, // 5 minutes
            sMaxAge: 600, // 10 minutes for CDN
            staleWhileRevalidate: 3600, // 1 hour
          },
          revalidate: forceRefresh
        }
      );
    } catch (error) {
      structuredLogger.error('[P&L API] Error fetching profit and loss', {
        component: 'profit-loss-report',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      });

      // Log the error
      await auditLogger.logError(
        AuditAction.VIEW,
        AuditResource.REPORT,
        null,
        {
          report: 'profit-loss',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return NextResponse.json(
        { error: 'Failed to fetch profit and loss report' },
        { status: 500 }
      );
    }
  }
);

// Helper function to get detailed account breakdown
async function getDetailedAccountBreakdown(startDate: Date, endDate: Date) {
  const accounts = await prisma.account.findMany({
    where: {
      class: { in: ['REVENUE', 'EXPENSE', 'OTHERINCOME', 'OTHEREXPENSE'] }
    },
    orderBy: {
      name: 'asc'
    }
  });

  const operatingRevenue = accounts
    .filter(a => a.class === 'REVENUE' && a.type !== 'OTHERINCOME')
    .map(a => ({
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      accountClass: a.class,
      balance: a.balance?.toNumber() || 0,
      level: 0
    }));

  const otherIncome = accounts
    .filter(a => a.type === 'OTHERINCOME')
    .map(a => ({
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      accountClass: a.class,
      balance: a.balance?.toNumber() || 0,
      level: 0
    }));

  const costOfSales = accounts
    .filter(a => a.type === 'DIRECTCOSTS')
    .map(a => ({
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      accountClass: a.class,
      balance: a.balance?.toNumber() || 0,
      level: 0
    }));

  const operatingExpenses = accounts
    .filter(a => a.class === 'EXPENSE' && a.type !== 'DIRECTCOSTS' && a.type !== 'OTHEREXPENSE')
    .map(a => ({
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      accountClass: a.class,
      balance: a.balance?.toNumber() || 0,
      level: 0
    }));

  const otherExpenses = accounts
    .filter(a => a.type === 'OTHEREXPENSE')
    .map(a => ({
      accountId: a.id,
      accountName: a.name,
      accountType: a.type,
      accountClass: a.class,
      balance: a.balance?.toNumber() || 0,
      level: 0
    }));

  // Calculate category breakdowns
  const revenueByCategory = [
    {
      category: 'Operating Revenue',
      amount: operatingRevenue.reduce((sum, a) => sum + a.balance, 0),
      percentage: 0 // Will be calculated based on total
    },
    {
      category: 'Other Income',
      amount: otherIncome.reduce((sum, a) => sum + a.balance, 0),
      percentage: 0
    }
  ];

  const expensesByCategory = [
    {
      category: 'Cost of Sales',
      amount: Math.abs(costOfSales.reduce((sum, a) => sum + a.balance, 0)),
      percentage: 0
    },
    {
      category: 'Operating Expenses',
      amount: Math.abs(operatingExpenses.reduce((sum, a) => sum + a.balance, 0)),
      percentage: 0
    },
    {
      category: 'Other Expenses',
      amount: Math.abs(otherExpenses.reduce((sum, a) => sum + a.balance, 0)),
      percentage: 0
    }
  ];

  // Calculate percentages
  const totalRevenue = revenueByCategory.reduce((sum, c) => sum + c.amount, 0);
  const totalExpenses = expensesByCategory.reduce((sum, c) => sum + c.amount, 0);

  revenueByCategory.forEach(c => {
    c.percentage = totalRevenue > 0 ? (c.amount / totalRevenue) * 100 : 0;
  });

  expensesByCategory.forEach(c => {
    c.percentage = totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0;
  });

  return {
    operatingRevenue,
    otherIncome,
    costOfSales,
    operatingExpenses,
    otherExpenses,
    revenueByCategory,
    expensesByCategory
  };
}

// Helper function to get trend data
async function getTrendData(startDate: Date, endDate: Date, timeframe: string) {
  // For now, return mock trend data
  // In production, this would fetch historical data
  const trends = [];
  const currentDate = new Date(endDate);
  
  for (let i = 0; i < 12; i++) {
    const periodDate = new Date(currentDate);
    
    switch (timeframe) {
      case 'YEAR':
        periodDate.setFullYear(periodDate.getFullYear() - i);
        break;
      case 'QUARTER':
        periodDate.setMonth(periodDate.getMonth() - (i * 3));
        break;
      case 'MONTH':
      default:
        periodDate.setMonth(periodDate.getMonth() - i);
        break;
    }
    
    trends.unshift({
      period: periodDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: Math.random() * 100000 + 50000,
      expenses: Math.random() * 80000 + 40000,
      grossProfit: Math.random() * 40000 + 20000,
      operatingProfit: Math.random() * 30000 + 15000,
      netProfit: Math.random() * 20000 + 10000
    });
  }
  
  return trends;
}

// Helper function to get comparison data
async function getComparison(startDate: Date, endDate: Date, timeframe: string) {
  // Calculate previous period dates
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  
  const prevStartDate = new Date(prevEndDate);
  const duration = endDate.getTime() - startDate.getTime();
  prevStartDate.setTime(prevStartDate.getTime() - duration);
  
  // For now, return mock comparison data
  // In production, this would fetch actual previous period data
  return {
    previousPeriod: {
      totalRevenue: 85000,
      totalExpenses: 65000,
      netProfit: 20000,
      date: prevEndDate.toISOString()
    },
    variance: {
      totalRevenue: 15000,
      totalExpenses: -5000,
      netProfit: 10000,
      percentageChange: 50
    }
  };
}

// Fallback function to get data from database
async function getFromDatabase(startDate: Date, endDate: Date) {
  // This is a simplified version - in production, you'd implement
  // the full database query logic here
  const accounts = await prisma.account.findMany({
    where: {
      class: { in: ['REVENUE', 'EXPENSE', 'OTHERINCOME', 'OTHEREXPENSE'] }
    }
  });
  
  // Calculate totals
  const totalRevenue = accounts
    .filter(a => a.class === 'REVENUE')
    .reduce((sum, a) => sum.add(a.balance || new Decimal(0)), new Decimal(0));
    
  const totalExpenses = accounts
    .filter(a => a.class === 'EXPENSE')
    .reduce((sum, a) => sum.add(a.balance || new Decimal(0)), new Decimal(0)).abs();
  
  // Return basic structure
  return {
    revenue: {
      operatingRevenue: [],
      otherIncome: [],
      totalRevenue: totalRevenue.toNumber()
    },
    expenses: {
      costOfSales: [],
      operatingExpenses: [],
      otherExpenses: [],
      totalExpenses: totalExpenses.toNumber()
    },
    profitability: {
      grossProfit: totalRevenue.toNumber(),
      operatingProfit: totalRevenue.sub(totalExpenses).toNumber(),
      netProfit: totalRevenue.sub(totalExpenses).toNumber(),
      ebitda: totalRevenue.sub(totalExpenses).toNumber()
    },
    margins: {
      grossMargin: 0,
      operatingMargin: 0,
      netMargin: 0,
      ebitdaMargin: 0
    },
    trends: [],
    comparison: null,
    breakdown: {
      revenueByCategory: [],
      expensesByCategory: []
    },
    reportDate: endDate.toISOString(),
    fromDate: startDate.toISOString(),
    toDate: endDate.toISOString(),
    fetchedAt: new Date().toISOString(),
    source: 'database',
    currency: 'GBP'
  };
}