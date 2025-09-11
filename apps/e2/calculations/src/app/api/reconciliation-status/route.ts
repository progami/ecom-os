import { NextRequest, NextResponse } from 'next/server';
import BankReconciliationService from '@/lib/services/BankReconciliationService';
import GLDataService from '@/lib/services/GLDataService';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const reconciliationService = BankReconciliationService.getInstance();
    const glDataService = GLDataService.getInstance();

    // Get reconciliation status
    const status = await reconciliationService.getReconciliationStatus();

    // Get additional statistics
    const entries = glDataService.getEntries();
    const revenueEntries = entries.filter(e => e.accountType === 'Revenue');
    const expenseEntries = entries.filter(e => e.accountType === 'Expense');

    // Calculate reconciliation rates by type
    const revenueReconciled = revenueEntries.filter(e => e.isReconciled).length;
    const expenseReconciled = expenseEntries.filter(e => e.isReconciled).length;

    // Get date range statistics
    const dateRange = glDataService.getDateRange();
    
    // Calculate monthly reconciliation progress
    const monthlyStats = calculateMonthlyStats(entries);

    return NextResponse.json({
      success: true,
      status: {
        lastReconciledDate: status.lastReconciledDate,
        overallStats: {
          totalEntries: status.totalEntries,
          reconciledEntries: status.reconciledEntries,
          unreconciledEntries: status.unreconciledEntries,
          reconciliationRate: Math.round(status.reconciliationRate * 100) / 100,
        },
        byType: {
          revenue: {
            total: revenueEntries.length,
            reconciled: revenueReconciled,
            unreconciled: revenueEntries.length - revenueReconciled,
            rate: revenueEntries.length > 0 
              ? Math.round((revenueReconciled / revenueEntries.length) * 10000) / 100
              : 0,
          },
          expense: {
            total: expenseEntries.length,
            reconciled: expenseReconciled,
            unreconciled: expenseEntries.length - expenseReconciled,
            rate: expenseEntries.length > 0
              ? Math.round((expenseReconciled / expenseEntries.length) * 10000) / 100
              : 0,
          },
        },
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        monthlyProgress: monthlyStats,
      },
    });
  } catch (error: any) {
    logger.error('Error getting reconciliation status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function calculateMonthlyStats(entries: any[]) {
  const monthlyData: Record<string, {
    total: number;
    reconciled: number;
    revenue: { total: number; reconciled: number };
    expense: { total: number; reconciled: number };
  }> = {};

  entries.forEach(entry => {
    const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        total: 0,
        reconciled: 0,
        revenue: { total: 0, reconciled: 0 },
        expense: { total: 0, reconciled: 0 },
      };
    }

    monthlyData[monthKey].total++;
    if (entry.isReconciled) {
      monthlyData[monthKey].reconciled++;
    }

    if (entry.accountType === 'Revenue') {
      monthlyData[monthKey].revenue.total++;
      if (entry.isReconciled) {
        monthlyData[monthKey].revenue.reconciled++;
      }
    } else if (entry.accountType === 'Expense') {
      monthlyData[monthKey].expense.total++;
      if (entry.isReconciled) {
        monthlyData[monthKey].expense.reconciled++;
      }
    }
  });

  // Convert to array and sort by month
  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      total: data.total,
      reconciled: data.reconciled,
      reconciliationRate: data.total > 0
        ? Math.round((data.reconciled / data.total) * 10000) / 100
        : 0,
      revenue: {
        ...data.revenue,
        rate: data.revenue.total > 0
          ? Math.round((data.revenue.reconciled / data.revenue.total) * 10000) / 100
          : 0,
      },
      expense: {
        ...data.expense,
        rate: data.expense.total > 0
          ? Math.round((data.expense.reconciled / data.expense.total) * 10000) / 100
          : 0,
      },
    }));
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}