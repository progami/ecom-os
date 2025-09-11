import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/rate-limiter';
import { structuredLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    structuredLogger.info('Fetching accounts with balances from database');
    
    // Get current date for YTD calculation
    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

    // Fetch all GL accounts from database
    const glAccounts = await prisma.gLAccount.findMany({
      orderBy: { code: 'asc' }
    });

    // Fetch bank accounts with calculated balances
    const bankAccounts = await prisma.bankAccount.findMany({
      include: {
        transactions: {
          where: {
            date: {
              gte: startOfYear
            },
            status: { not: 'DELETED' }
          },
          select: {
            amount: true,
            type: true
          }
        }
      }
    });

    // Create a map of account codes to YTD amounts from bank transactions
    const ytdAmountsByCode: Record<string, number> = {};
    
    for (const bankAccount of bankAccounts) {
      if (bankAccount.code) {
        // Calculate YTD amount from transactions
        const ytdAmount = bankAccount.transactions.reduce((sum, tx) => {
          const amount = tx.amount ? (typeof tx.amount === 'number' ? tx.amount : tx.amount.toNumber()) : 0;
          // RECEIVE is positive, SPEND is negative
          return sum + (tx.type === 'RECEIVE' ? amount : -Math.abs(amount));
        }, 0);
        
        ytdAmountsByCode[bankAccount.code] = ytdAmount;
      }
    }

    // Transform GL accounts with YTD data
    const accountsWithYTD = glAccounts.map(account => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      class: account.class,
      status: account.status,
      description: account.description,
      systemAccount: account.systemAccount,
      showInExpenseClaims: account.showInExpenseClaims,
      enablePaymentsToAccount: account.enablePaymentsToAccount,
      reportingCode: account.reportingCode,
      reportingCodeName: account.reportingCodeName,
      balance: account.balance.toNumber(),
      ytdAmount: ytdAmountsByCode[account.code] || 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    structuredLogger.info('Successfully fetched accounts with balances', {
      totalAccounts: accountsWithYTD.length,
      accountsWithBalance: accountsWithYTD.filter(a => a.ytdAmount !== 0).length
    });

    // Return the accounts with YTD data
    return NextResponse.json({
      success: true,
      accounts: {
        all: accountsWithYTD,
        byType: accountsWithYTD.reduce((acc, account) => {
          const type = account.type;
          if (!acc[type]) acc[type] = [];
          acc[type].push(account);
          return acc;
        }, {} as Record<string, any[]>)
      },
      hasYTDData: accountsWithYTD.some(a => a.ytdAmount !== 0),
      summary: {
        totalAccounts: accountsWithYTD.length,
        accountsWithBalance: accountsWithYTD.filter(a => a.ytdAmount !== 0).length
      },
      period: {
        from: startOfYear.toISOString(),
        to: currentDate.toISOString()
      },
      source: 'database' // Indicate data is from local database
    });

  } catch (error: any) {
    console.error('Error in accounts with balances endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch accounts with balances',
        message: error.message 
      },
      { status: 500 }
    );
  }
});