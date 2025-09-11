import { NextRequest, NextResponse } from 'next/server';
import { withValidation } from '@/lib/validation/middleware';
import { analyticsPeriodSchema } from '@/lib/validation/schemas';
import { memoryMonitor } from '@/lib/memory-monitor';
import { getTenantId } from '@/lib/xero-helpers';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';

export const GET = withValidation(
  { querySchema: analyticsPeriodSchema },
  async (request, { query }) => {
    return memoryMonitor.monitorOperation('analytics-category-breakdown', async () => {
      try {
      const period = query?.period || '30d';
      
      structuredLogger.info('Category breakdown API called', { period });
      
      // Get Xero client
      let tenantId;
      try {
        tenantId = await getTenantId(request);
      } catch (error) {
        structuredLogger.error('Failed to get tenant ID', { 
          component: 'analytics-category-breakdown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      if (!tenantId) {
        structuredLogger.info('No tenant ID found', { component: 'analytics-category-breakdown' });
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
          component: 'analytics-category-breakdown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return NextResponse.json(
          { error: 'Xero connection unavailable' },
          { status: 401 }
        );
      }
      
      if (!xeroData) {
        structuredLogger.info('No Xero data available', { component: 'analytics-category-breakdown' });
        return NextResponse.json(
          { error: 'Failed to get Xero client' },
          { status: 401 }
        );
      }
      
      const { client: xero } = xeroData;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get page and pageSize from query parameters
    const page = parseInt((request.nextUrl.searchParams.get('page') || '1'));
    const pageSize = parseInt((request.nextUrl.searchParams.get('pageSize') || '1000'));
    
    // Get bank transactions from Xero (SPEND type only)
    const bankTransactionsResponse = await xero.accountingApi.getBankTransactions(
      tenantId,
      undefined,
      `Date >= DateTime(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()}) AND Date <= DateTime(${now.getFullYear()}, ${now.getMonth() + 1}, ${now.getDate()}) AND Type="SPEND"`,
      'Date DESC',
      pageSize
    );
    
    const transactions = bankTransactionsResponse.body.bankTransactions || [];
    const totalTransactions = transactions.length; // Note: this is a simplified count for the current page
    
    // Get chart of accounts from Xero for category mapping
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenantId,
      undefined,
      'Status=="ACTIVE"',
      'Code ASC'
    );
    
    const glAccounts = accountsResponse.body.accounts || [];
    
    structuredLogger.info('Fetched data from Xero', {
      transactionCount: transactions.length,
      accountCount: glAccounts.length,
      period
    });

    // Create category mapping based on account codes
    const categoryMap = new Map<string, string>();
    
    // Define category rules based on account codes and types
    glAccounts.forEach(account => {
      const code = account.code ? parseInt(account.code) : 0;
      let category = 'Other';
      
      // Based on common Xero account code ranges
      if (code >= 200 && code < 300) {
        category = 'Operations'; // Current Assets
      } else if (code >= 300 && code < 400) {
        category = 'Fixed Assets';
      } else if (code >= 400 && code < 500) {
        category = 'Operations'; // Direct Costs
      } else if (code >= 500 && code < 600) {
        category = 'Operations'; // Overhead
      } else if (code >= 600 && code < 700) {
        category = 'Marketing'; // Marketing/Sales
      } else if (code >= 700 && code < 800) {
        category = 'Professional Services'; // Professional fees
      } else if (code >= 460 && code < 470) {
        category = 'Software & Tools'; // IT/Software
      }
      
      // Override based on account name patterns
      const nameLower = (account.name || '').toLowerCase();
      if (nameLower.includes('software') || nameLower.includes('subscription') || nameLower.includes('computer')) {
        category = 'Software & Tools';
      } else if (nameLower.includes('marketing') || nameLower.includes('advertising') || nameLower.includes('promotion')) {
        category = 'Marketing';
      } else if (nameLower.includes('professional') || nameLower.includes('consulting') || nameLower.includes('legal') || nameLower.includes('accounting')) {
        category = 'Professional Services';
      } else if (nameLower.includes('rent') || nameLower.includes('utilities') || nameLower.includes('office')) {
        category = 'Operations';
      } else if (nameLower.includes('travel') || nameLower.includes('entertainment') || nameLower.includes('meals')) {
        category = 'Travel & Entertainment';
      }
      
      if (account.code) {
        categoryMap.set(account.code, category);
      }
    });

    // Group transactions by category
    const categoryTotals = new Map<string, number>();
    let totalSpend = 0;
    
    transactions.forEach(tx => {
      // For Xero bank transactions, we need to look at line items for account codes
      const lineItems = tx.lineItems || [];
      
      lineItems.forEach(lineItem => {
        const accountCode = lineItem.accountCode;
        const category = accountCode ? (categoryMap.get(accountCode) || 'Other') : 'Other';
        const amount = lineItem.lineAmount ? Math.abs(lineItem.lineAmount) : 0;
        
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
        totalSpend += amount;
      });
      
      // If no line items, use the total amount with 'Other' category
      if (lineItems.length === 0) {
        const amount = tx.total ? Math.abs(tx.total) : 0;
        categoryTotals.set('Other', (categoryTotals.get('Other') || 0) + amount);
        totalSpend += amount;
      }
    });

    // Convert to array and calculate percentages
    const categories = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpend > 0 ? parseFloat(((amount / totalSpend) * 100).toFixed(1)) : 0,
        transactionCount: transactions.reduce((count, tx) => {
          const lineItems = tx.lineItems || [];
          return count + lineItems.filter(lineItem => {
            const accountCode = lineItem.accountCode;
            const cat = accountCode ? (categoryMap.get(accountCode) || 'Other') : 'Other';
            return cat === category;
          }).length;
        }, 0)
      }))
      .sort((a, b) => b.amount - a.amount);

      const totalPages = Math.ceil(totalTransactions / pageSize);
      
      return NextResponse.json({
        success: true,
        categories,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalSpend,
        summary: {
          topCategory: categories[0]?.category || 'N/A',
          topCategoryPercentage: categories[0]?.percentage || 0,
          categoryCount: categories.length
        },
        pagination: {
          page,
          pageSize,
          totalTransactions,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });

    } catch (error: any) {
      structuredLogger.error('Error fetching category breakdown', {
        component: 'analytics-category-breakdown',
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
          error: 'Failed to fetch category breakdown',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
      }
    });
  }
)