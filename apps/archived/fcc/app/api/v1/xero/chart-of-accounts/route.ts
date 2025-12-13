import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Chart of Accounts API called - fetching from database');
    
    // Check if user wants balance data
    const searchParams = request.nextUrl.searchParams;
    const includeBalances = searchParams.get('includeBalances') === 'true';
    
    // Get all GL accounts from database
    const glAccounts = await prisma.gLAccount.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        code: 'asc'
      }
    });

    // Transform accounts to match expected format
    const accounts = glAccounts.map(account => ({
      code: account.code,
      name: account.name,
      type: account.type,
      class: account.class,
      status: account.status,
      description: account.description,
      systemAccount: account.systemAccount,
      enablePaymentsToAccount: account.enablePaymentsToAccount,
      showInExpenseClaims: account.showInExpenseClaims,
      taxType: null, // We don't store tax type in GLAccount
      reportingCode: account.reportingCode,
      reportingCodeName: account.reportingCodeName,
      hasAttachments: false,
      updatedDateUTC: account.updatedAt,
      addToWatchlist: false,
      // Full account string for display
      fullName: `${account.code} - ${account.name}`,
      // Use stored balance if requested
      balance: includeBalances ? account.balance.toNumber() : 0
    }));

    // Filter for expense accounts (commonly used in bills)
    const expenseAccounts = accounts.filter(acc => 
      acc.type === 'EXPENSE' || 
      acc.type === 'OVERHEADS' || 
      acc.type === 'DIRECTCOSTS'
    );

    // Get unique tax types (empty for now as we don't store this)
    const taxTypes: string[] = [];

    // Calculate total balances if we have the data
    const totalBalance = includeBalances ? 
      accounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0) : 0;

    structuredLogger.info('Successfully fetched chart of accounts from database', {
      accountCount: accounts.length,
      expenseAccountCount: expenseAccounts.length,
      includeBalances
    });

    return NextResponse.json(
      {
        success: true,
        accounts: {
          all: accounts,
          expense: expenseAccounts,
          byType: groupAccountsByType(accounts)
        },
        taxTypes,
        count: accounts.length,
        hasBalanceData: includeBalances,
        totalBalance,
        timestamp: new Date().toISOString(),
        source: 'database' // Indicate data is from local database
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
        }
      }
    );
  } catch (error: any) {
    structuredLogger.error('Error fetching chart of accounts from database:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch chart of accounts',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to group accounts by type
function groupAccountsByType(accounts: any[]) {
  return accounts.reduce((grouped, account) => {
    const type = account.type || 'OTHER';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(account);
    return grouped;
  }, {} as Record<string, any[]>);
}