import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export async function GET() {
  try {
    structuredLogger.info('[Trial Balance ALL] Fetching from database...');
    
    // Get current date for report
    const toDate = new Date().toISOString().split('T')[0];
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    
    // Fetch all GL accounts from database
    const glAccounts = await prisma.gLAccount.findMany({
      orderBy: { code: 'asc' }
    });
    
    // Fetch bank accounts to calculate YTD balances
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
    
    // Create a map of account codes to YTD amounts
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
    
    // Transform GL accounts to trial balance format
    const accounts = glAccounts.map(account => {
      const ytdAmount = ytdAmountsByCode[account.code] || account.balance.toNumber();
      const isDebitBalance = ytdAmount > 0;
      
      // Check if this is a system account (VAT, PAYE, etc)
      const isSystemAccount = account.name.includes('VAT') || 
                            account.name.includes('PAYE') || 
                            account.name.includes('NIC') ||
                            account.name.includes('Corporation Tax') ||
                            account.name.includes('HMRC') ||
                            account.systemAccount;
      
      return {
        accountName: `${account.name} (${account.code})`,
        accountCode: account.code,
        cleanAccountName: account.name,
        ytdDebit: isDebitBalance ? Math.abs(ytdAmount) : 0,
        ytdCredit: !isDebitBalance ? Math.abs(ytdAmount) : 0,
        ytdAmount: ytdAmount,
        hasActivity: ytdAmount !== 0,
        isSystemAccount,
        section: account.type || 'Unknown',
        accountType: account.type,
        accountClass: account.class
      };
    });
    
    structuredLogger.info(`[Trial Balance ALL] Found ${accounts.length} total accounts from database`);
    structuredLogger.info(`[Trial Balance ALL] Accounts with activity: ${accounts.filter(a => a.hasActivity).length}`);
    structuredLogger.info(`[Trial Balance ALL] System accounts: ${accounts.filter(a => a.isSystemAccount).length}`);
    
    // Log VAT accounts specifically if found
    const vatAccounts = accounts.filter(a => 
      a.accountCode === '825' || 
      a.accountCode === '820' || 
      a.cleanAccountName.includes('VAT') ||
      a.accountName.includes('VAT')
    );
    
    if (vatAccounts.length > 0) {
      structuredLogger.info('[Trial Balance ALL] VAT Accounts found:');
      vatAccounts.forEach(vat => {
        structuredLogger.info(`  - ${vat.accountName}: YTD Amount = ${vat.ytdAmount}`);
      });
    } else {
      structuredLogger.warn('[Trial Balance ALL] WARNING: No VAT accounts found in database!');
    }
    
    return NextResponse.json({
      accounts,
      totalAccounts: accounts.length,
      accountsWithActivity: accounts.filter(a => a.hasActivity).length,
      systemAccounts: accounts.filter(a => a.isSystemAccount),
      reportDate: toDate,
      source: 'database',
      note: 'YTD amounts calculated from bank transactions where available, otherwise using stored balances'
    });
    
  } catch (error: any) {
    structuredLogger.error('[Trial Balance ALL] Failed to fetch accounts from database', error, {
      errorMessage: error.message,
      errorStack: error.stack
    });
    return NextResponse.json({ 
      error: 'Failed to fetch accounts',
      message: error.message 
    }, { status: 500 });
  }
}