import { NextRequest, NextResponse } from 'next/server';
import { withValidation } from '@/lib/validation/middleware';
import { analyticsPeriodSchema } from '@/lib/validation/schemas';
import { getTenantId } from '@/lib/xero-helpers';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';

export const GET = withValidation(
  { querySchema: analyticsPeriodSchema },
  async (request, { query }) => {
    try {
      const period = query?.period || '30d';
      
      structuredLogger.info('Spend trend API called', { period });
      
      // Get Xero client
      let tenantId;
      try {
        tenantId = await getTenantId(request);
      } catch (error) {
        structuredLogger.error('Failed to get tenant ID', { 
          component: 'analytics-spend-trend',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      if (!tenantId) {
        structuredLogger.info('No tenant ID found', { component: 'analytics-spend-trend' });
        return NextResponse.json(
          { error: 'Xero is not connected' },
          { status: 401 }
        );
      }
      
      let xeroData;
      try {
        xeroData = await getXeroClientWithTenant();
      } catch (error) {
        structuredLogger.error('Failed to get Xero client', { 
          component: 'analytics-spend-trend',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return NextResponse.json(
          { error: 'Xero connection unavailable' },
          { status: 401 }
        );
      }
      
      if (!xeroData) {
        structuredLogger.info('No Xero data available', { component: 'analytics-spend-trend' });
        return NextResponse.json(
          { error: 'Failed to get Xero client' },
          { status: 401 }
        );
      }
      
      const { client: xero } = xeroData;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    let groupBy: 'day' | 'week' | 'month' = 'day';
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        groupBy = 'day';
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        groupBy = 'week';
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        groupBy = 'month';
        break;
      default:
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
    }

    // Get bank transactions from Xero (SPEND type only)
    const bankTransactionsResponse = await xero.accountingApi.getBankTransactions(
      tenantId,
      undefined,
      `Date >= DateTime(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()}) AND Date <= DateTime(${now.getFullYear()}, ${now.getMonth() + 1}, ${now.getDate()}) AND Type="SPEND"`,
      'Date ASC',
      100
    );
    
    const transactions = bankTransactionsResponse.body.bankTransactions || [];
    
    structuredLogger.info('Fetched spend transactions from Xero', {
      count: transactions.length,
      period,
      groupBy
    });

    // Group transactions by date period
    const trendMap = new Map<string, number>();
    
    transactions.forEach(tx => {
      let dateKey: string = '';
      const txDate = new Date(tx.date || new Date());
      
      if (groupBy === 'day') {
        dateKey = txDate.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        // Get start of week
        const weekStart = new Date(txDate);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        // Month
        dateKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-01`;
      }
      
      const currentAmount = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, currentAmount + Math.abs(tx.total || 0));
    });

    // Fill in missing dates
    const trend: { date: string; amount: number }[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      if (groupBy === 'day') {
        trend.push({
          date: dateKey,
          amount: trendMap.get(dateKey) || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (groupBy === 'week') {
        // Start of week
        const weekStart = new Date(currentDate);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!trend.find(t => t.date === weekKey)) {
          trend.push({
            date: weekKey,
            amount: trendMap.get(weekKey) || 0
          });
        }
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        // Month
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
        if (!trend.find(t => t.date === monthKey)) {
          trend.push({
            date: monthKey,
            amount: trendMap.get(monthKey) || 0
          });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

      return NextResponse.json({
        success: true,
        trend,
        period,
        groupBy,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      });

    } catch (error: any) {
      structuredLogger.error('Error fetching spend trend', {
        component: 'analytics-spend-trend',
        error: error.message || 'Unknown error',
        errorType: error.name || 'UnknownError',
        stack: error.stack
      });
      
      // Check if it's an authentication-related error
      if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('authentication')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch spend trend',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
)