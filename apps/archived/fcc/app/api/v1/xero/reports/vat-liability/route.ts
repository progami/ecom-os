import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Removed getTenantId import - not needed for database-only operations
import { structuredLogger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('[VAT API] Starting VAT liability fetch from database', {
      component: 'vat-liability-report'
    });
    
    // No tenant ID check needed - using database data only
    structuredLogger.info('[VAT API] Using database data only - no Xero connection required', {
      component: 'vat-liability-report'
    });

    // Fetch VAT liability from database GL accounts
    // Look for common VAT liability account codes
    // Fixed: Removed unsupported 'mode: insensitive' from Prisma query
    const vatAccounts = await prisma.gLAccount.findMany({
      where: {
        OR: [
          { code: { in: ['820', '821', '822', '823', '824', '825'] } }, // Common UK VAT codes
          { name: { contains: 'VAT' } },
          { name: { contains: 'GST' } },
          { reportingCode: { in: ['LIAB.CUR.OUTPUT', 'LIAB.CUR.INPUT'] } }
        ],
        class: 'LIABILITY',
        status: 'ACTIVE'
      }
    });

    // Calculate total VAT liability from account balances
    let vatLiability = new Decimal(0);
    
    for (const account of vatAccounts) {
      if (account.balance) {
        // Liability accounts typically have negative balances in Xero
        // We want the absolute value for the liability amount
        vatLiability = vatLiability.add(account.balance.abs());
        
        structuredLogger.debug('[VAT API] VAT account found', {
          component: 'vat-liability-report',
          accountCode: account.code,
          accountName: account.name,
          balance: account.balance.toString(),
          absBalance: account.balance.abs().toString()
        });
      }
    }
    
    const vatLiabilityNumber = vatLiability.toNumber();
    
    structuredLogger.info('[VAT API] Calculated VAT liability from database', {
      component: 'vat-liability-report',
      vatLiability: vatLiabilityNumber,
      accountCount: vatAccounts.length,
      source: 'database_gl_accounts'
    });

    // Also check if we have any tax obligations stored (from UK Tax Calculator)
    const vatObligations = await prisma.taxObligation.findMany({
      where: {
        type: 'VAT',
        status: 'PENDING',
        dueDate: {
          gte: new Date()
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    // Use the next VAT obligation amount if available
    const upcomingVatPayment = vatObligations[0]?.amount || 0;

    // Get the last successful sync time from the correct table
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

    const response = {
      currentLiability: Math.abs(vatLiabilityNumber),
      vatCollected: 0, // Not available from GL accounts - would need transaction analysis
      vatPaid: 0, // Not available from GL accounts - would need transaction analysis
      netAmount: vatLiabilityNumber,
      upcomingPayment: upcomingVatPayment,
      nextPaymentDue: vatObligations[0]?.dueDate || null,
      reportDate: new Date().toISOString(),
      reportPeriod: 'Current', // Based on current GL account balances
      currency: 'GBP',
      calculatedFromTransactions: false, // Using GL account balances
      source: 'database_gl_accounts',
      lastSyncedAt: lastSync?.completedAt || null,
      syncType: lastSync?.syncType || null,
      itemsSynced: lastSync?.recordsCreated || 0
    };
    
    structuredLogger.info('[VAT API] Returning VAT liability response', {
      component: 'vat-liability-report',
      response
    });
    
    return NextResponse.json(response);

  } catch (error: any) {
    structuredLogger.error('[VAT API] Error fetching VAT liability from database', error, {
      component: 'vat-liability-report'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch VAT liability from database',
        details: error.message || 'Unknown error',
        recommendation: 'Please ensure data has been synced from Xero'
      },
      { status: 500 }
    );
  }
}