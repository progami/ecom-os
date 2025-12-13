import { NextRequest, NextResponse } from 'next/server';
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher';
import { structuredLogger } from '@/lib/logger';
import { GeneralLedgerData, GeneralLedgerAccount, GeneralLedgerTransaction } from '@/lib/schemas/report-schemas';

interface SpenderAnalysis {
  name: string;
  totalSpend: number;
  transactionCount: number;
  averageTransactionAmount: number;
  lastTransactionDate: string;
  primaryAccounts: string[];
}

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('[GL Top Spenders] Starting analysis');
    
    // Get query parameters
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    
    // Set default date range (all available data)
    const periodEnd = toDate ? new Date(toDate) : new Date();
    const periodStart = fromDate ? new Date(fromDate) : new Date(2020, 0, 1); // Start from 2020
    
    // Fetch General Ledger data from database
    const glData = await ReportDatabaseFetcher.fetchGeneralLedger(periodStart, periodEnd);
    
    if (!glData || !glData.accounts) {
      structuredLogger.warn('[GL Top Spenders] No General Ledger data available');
      return NextResponse.json({
        error: 'No General Ledger data available',
        message: 'Please import General Ledger data to view this analysis',
        topSpenders: []
      }, { status: 404 });
    }
    
    structuredLogger.info('[GL Top Spenders] Analyzing accounts', {
      accountCount: glData.accounts.length,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
    
    // Map to track spending by contact/vendor
    const spenderMap = new Map<string, {
      totalSpend: number;
      transactions: GeneralLedgerTransaction[];
      accounts: Set<string>;
    }>();
    
    // Process each account
    glData.accounts.forEach((account: GeneralLedgerAccount) => {
      // Focus on expense accounts and accounts payable
      const isExpenseAccount = account.accountType?.toLowerCase().includes('expense') ||
                              account.accountType?.toLowerCase().includes('overhead') ||
                              account.accountType?.toLowerCase().includes('cost') ||
                              account.accountName?.toLowerCase().includes('expense') ||
                              account.accountName?.toLowerCase().includes('cost');
      
      const isPayableAccount = account.accountType?.toLowerCase().includes('payable') ||
                              account.accountName?.toLowerCase().includes('payable');
      
      if (isExpenseAccount || isPayableAccount) {
        // Process transactions in this account
        account.transactions?.forEach((transaction: GeneralLedgerTransaction) => {
          // Look for payments to vendors (credits in expense accounts or debits in payable accounts)
          const isPayment = (isExpenseAccount && transaction.debit > 0) || 
                           (isPayableAccount && transaction.credit > 0);
          
          if (isPayment && transaction.contactName) {
            const contactName = transaction.contactName;
            const amount = isExpenseAccount ? transaction.debit : transaction.credit;
            
            if (!spenderMap.has(contactName)) {
              spenderMap.set(contactName, {
                totalSpend: 0,
                transactions: [],
                accounts: new Set()
              });
            }
            
            const spender = spenderMap.get(contactName)!;
            spender.totalSpend += amount;
            spender.transactions.push(transaction);
            spender.accounts.add(account.accountName);
          }
        });
      }
    });
    
    // Convert to array and calculate analytics
    const spenders: SpenderAnalysis[] = Array.from(spenderMap.entries())
      .map(([name, data]) => {
        // Sort transactions by date to get the latest
        const sortedTransactions = data.transactions.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        return {
          name,
          totalSpend: data.totalSpend,
          transactionCount: data.transactions.length,
          averageTransactionAmount: data.totalSpend / data.transactions.length,
          lastTransactionDate: sortedTransactions[0]?.date || '',
          primaryAccounts: Array.from(data.accounts).slice(0, 3) // Top 3 accounts
        };
      })
      .filter(spender => spender.totalSpend > 0) // Only include actual spenders
      .sort((a, b) => b.totalSpend - a.totalSpend) // Sort by total spend descending
      .slice(0, 5); // Get top 5
    
    // Calculate summary statistics
    const totalSpendAllVendors = Array.from(spenderMap.values())
      .reduce((sum, data) => sum + data.totalSpend, 0);
    
    const topSpendersTotal = spenders.reduce((sum, spender) => sum + spender.totalSpend, 0);
    
    structuredLogger.info('[GL Top Spenders] Analysis complete', {
      totalVendors: spenderMap.size,
      topSpendersCount: spenders.length,
      totalSpend: totalSpendAllVendors
    });
    
    return NextResponse.json({
      success: true,
      topSpenders: spenders.map((spender, index) => ({
        rank: index + 1,
        ...spender,
        percentageOfTotal: totalSpendAllVendors > 0 
          ? parseFloat(((spender.totalSpend / totalSpendAllVendors) * 100).toFixed(2))
          : 0
      })),
      summary: {
        totalVendors: spenderMap.size,
        totalSpend: totalSpendAllVendors,
        topSpendersTotal,
        topSpendersPercentage: totalSpendAllVendors > 0
          ? parseFloat(((topSpendersTotal / totalSpendAllVendors) * 100).toFixed(2))
          : 0,
        dateRange: {
          from: periodStart.toISOString(),
          to: periodEnd.toISOString()
        },
        dataSource: 'general_ledger'
      }
    });
    
  } catch (error) {
    structuredLogger.error('[GL Top Spenders] Error analyzing data', error);
    
    return NextResponse.json({
      error: 'Failed to analyze General Ledger data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}