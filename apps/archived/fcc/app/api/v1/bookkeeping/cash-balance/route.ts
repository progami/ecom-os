import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CurrencyService } from '@/lib/currency-service';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Fetching authoritative bank account balances from database', {
      component: 'cash-balance-api'
    });
    
    // Fetch all bank accounts with their stored balances
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        currencyCode: {
          not: null
        },
        status: 'ACTIVE' // Only show active accounts
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Calculate total balance in GBP
    let totalBalance = 0;
    const accountsWithBalance: any[] = [];
    const baseCurrency = 'GBP';
    
    // Process each account using the stored authoritative balance
    for (const account of bankAccounts) {
      const accountCurrency = account.currencyCode || baseCurrency;
      
      // Use the stored balance from the database (authoritative from Xero)
      const balance = account.balance.toNumber();
      
      structuredLogger.debug(`Account ${account.name}: authoritative balance = ${balance}`, {
        component: 'cash-balance-api',
        accountId: account.id,
        currency: accountCurrency,
        balanceLastUpdated: account.balanceLastUpdated
      });
      
      try {
        // Get exchange rate using currency service
        const balanceInGBP = await CurrencyService.convert(
          balance,
          accountCurrency,
          baseCurrency,
          account.balanceLastUpdated || undefined
        );
        
        totalBalance += balanceInGBP;
        
        accountsWithBalance.push({
          id: account.id,
          name: account.name,
          code: account.code || '',
          balance: balance,
          balanceInGBP: balanceInGBP,
          currency: accountCurrency,
          type: 'BANK',
          lastUpdated: account.balanceLastUpdated || account.updatedAt
        });
      } catch (error) {
        structuredLogger.error('Failed to convert currency for account', error, {
          component: 'cash-balance-api',
          accountId: account.id,
          currency: accountCurrency
        });
        
        // Include account with unconverted balance
        accountsWithBalance.push({
          id: account.id,
          name: account.name,
          code: account.code || '',
          balance: balance,
          balanceInGBP: 0, // Unable to convert
          currency: accountCurrency,
          type: 'BANK',
          lastUpdated: account.balanceLastUpdated || account.updatedAt,
          conversionError: true
        });
      }
    }
    
    structuredLogger.info('Successfully calculated cash balance', {
      component: 'cash-balance-api',
      totalBalance,
      accountCount: accountsWithBalance.length
    });
    
    return NextResponse.json({
      totalBalance: totalBalance,
      currency: baseCurrency,
      accounts: accountsWithBalance,
      count: accountsWithBalance.length,
      lastUpdated: bankAccounts.length > 0 
        ? bankAccounts.reduce((latest, account) => {
            const accountDate = account.balanceLastUpdated || account.updatedAt;
            return accountDate > latest ? accountDate : latest;
          }, new Date(0)).toISOString()
        : new Date().toISOString()
    });
    
  } catch (error: any) {
    structuredLogger.error('Cash balance API error', error, {
      component: 'cash-balance-api'
    });
    
    return NextResponse.json({
      error: 'Failed to fetch cash balance',
      details: error.message
    }, { status: 500 });
  }
}