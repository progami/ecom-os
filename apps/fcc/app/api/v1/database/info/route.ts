import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/auth-wrapper';
import { withRateLimit } from '@/lib/rate-limiter';

export const GET = withRateLimit(
  withAdminAuth(async (request, session) => {
  try {
    // Get record counts for each table
    const [
      userCount,
      glAccountCount,
      bankAccountCount,
      bankTransactionCount,
      invoiceCount,
      contactCount,
      lineItemCount,
      syncLogCount,
      sopCount,
      syncedInvoiceCount,
      repeatingTransactionCount,
      cashFlowBudgetCount,
      cashFlowForecastCount,
      paymentPatternCount,
      taxObligationCount,
      errorLogCount,
      cashFlowSyncLogCount,
      auditLogCount,
      currencyRateCount,
      reportCount,
      syncCheckpointCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.gLAccount.count(),
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.invoice.count(),
      prisma.contact.count(),
      prisma.lineItem.count(),
      prisma.syncLog.count(),
      prisma.standardOperatingProcedure.count(),
      prisma.syncedInvoice.count(),
      prisma.repeatingTransaction.count(),
      prisma.cashFlowBudget.count(),
      prisma.cashFlowForecast.count(),
      prisma.paymentPattern.count(),
      prisma.taxObligation.count(),
      prisma.errorLog.count(),
      prisma.cashFlowSyncLog.count(),
      prisma.auditLog.count(),
      prisma.currencyRate.count(),
      prisma.report.count(),
      prisma.syncCheckpoint.count()
    ]);

    // Get last update times
    const [
      lastUser,
      lastGLAccount,
      lastBankAccount,
      lastBankTransaction,
      lastInvoice,
      lastContact,
      lastLineItem,
      lastSyncLog,
      lastSOP,
      lastSyncedInvoice,
      lastRepeatingTransaction,
      lastCashFlowBudget,
      lastCashFlowForecast,
      lastPaymentPattern,
      lastTaxObligation,
      lastErrorLog,
      lastCashFlowSyncLog,
      lastAuditLog,
      lastCurrencyRate,
      lastReport,
      lastSyncCheckpoint
    ] = await Promise.all([
      prisma.user.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.gLAccount.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.bankAccount.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.bankTransaction.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.invoice.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.contact.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.lineItem.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.syncLog.findFirst({ orderBy: { completedAt: 'desc' } }),
      prisma.standardOperatingProcedure.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.syncedInvoice.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.repeatingTransaction.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.cashFlowBudget.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.cashFlowForecast.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.paymentPattern.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.taxObligation.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.errorLog.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.cashFlowSyncLog.findFirst({ orderBy: { completedAt: 'desc' } }),
      prisma.auditLog.findFirst({ orderBy: { timestamp: 'desc' } }),
      prisma.currencyRate.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.report.findFirst({ orderBy: { updatedAt: 'desc' } }),
      prisma.syncCheckpoint.findFirst({ orderBy: { updatedAt: 'desc' } })
    ]);

    const tables = [
      {
        name: 'GLAccount',
        recordCount: glAccountCount,
        lastUpdated: lastGLAccount?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'code', type: 'String', isPrimary: false, isOptional: false },
          { name: 'name', type: 'String', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: true },
          { name: 'description', type: 'String', isPrimary: false, isOptional: true },
          { name: 'systemAccount', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'class', type: 'String', isPrimary: false, isOptional: true },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'BankAccount',
        recordCount: bankAccountCount,
        lastUpdated: lastBankAccount?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'xeroAccountId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'name', type: 'String', isPrimary: false, isOptional: false },
          { name: 'code', type: 'String', isPrimary: false, isOptional: true },
          { name: 'currencyCode', type: 'String', isPrimary: false, isOptional: true },
          { name: 'balance', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'balanceLastUpdated', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'BankTransaction',
        recordCount: bankTransactionCount,
        lastUpdated: lastBankTransaction?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'xeroTransactionId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'bankAccountId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'isReconciled', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
          { name: 'description', type: 'String', isPrimary: false, isOptional: true },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'SyncLog',
        recordCount: syncLogCount,
        lastUpdated: lastSyncLog?.completedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'recordsCreated', type: 'Int', isPrimary: false, isOptional: false },
          { name: 'recordsUpdated', type: 'Int', isPrimary: false, isOptional: false },
          { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
        ]
      },
      {
        name: 'StandardOperatingProcedure',
        recordCount: sopCount,
        lastUpdated: lastSOP?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'year', type: 'String', isPrimary: false, isOptional: false },
          { name: 'chartOfAccount', type: 'String', isPrimary: false, isOptional: false },
          { name: 'pointOfInvoice', type: 'String', isPrimary: false, isOptional: true },
          { name: 'serviceType', type: 'String', isPrimary: false, isOptional: false },
          { name: 'referenceTemplate', type: 'String', isPrimary: false, isOptional: false },
          { name: 'descriptionTemplate', type: 'String', isPrimary: false, isOptional: false },
          { name: 'isActive', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'SyncedInvoice',
        recordCount: syncedInvoiceCount,
        lastUpdated: lastSyncedInvoice?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
          { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
          { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'amountDue', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'total', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'RepeatingTransaction',
        recordCount: repeatingTransactionCount,
        lastUpdated: lastRepeatingTransaction?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
          { name: 'scheduleUnit', type: 'String', isPrimary: false, isOptional: false },
          { name: 'scheduleInterval', type: 'Int', isPrimary: false, isOptional: false },
          { name: 'nextScheduledDate', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'CashFlowBudget',
        recordCount: cashFlowBudgetCount,
        lastUpdated: lastCashFlowBudget?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'accountCode', type: 'String', isPrimary: false, isOptional: false },
          { name: 'accountName', type: 'String', isPrimary: false, isOptional: false },
          { name: 'category', type: 'String', isPrimary: false, isOptional: false },
          { name: 'monthYear', type: 'String', isPrimary: false, isOptional: false },
          { name: 'budgetedAmount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'actualAmount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'variance', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'CashFlowForecast',
        recordCount: cashFlowForecastCount,
        lastUpdated: lastCashFlowForecast?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'openingBalance', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'totalInflows', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'totalOutflows', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'closingBalance', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'confidenceLevel', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'PaymentPattern',
        recordCount: paymentPatternCount,
        lastUpdated: lastPaymentPattern?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'contactName', type: 'String', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'averageDaysToPay', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'onTimeRate', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'sampleSize', type: 'Int', isPrimary: false, isOptional: false },
          { name: 'lastCalculated', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'TaxObligation',
        recordCount: taxObligationCount,
        lastUpdated: lastTaxObligation?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'reference', type: 'String', isPrimary: false, isOptional: true },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'CashFlowSyncLog',
        recordCount: cashFlowSyncLogCount,
        lastUpdated: lastCashFlowSyncLog?.completedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
          { name: 'entityType', type: 'String', isPrimary: false, isOptional: false },
          { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'itemsSynced', type: 'Int', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
        ]
      },
      {
        name: 'User',
        recordCount: userCount,
        lastUpdated: lastUser?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'email', type: 'String', isPrimary: false, isOptional: false },
          { name: 'name', type: 'String', isPrimary: false, isOptional: true },
          { name: 'xeroUserId', type: 'String', isPrimary: false, isOptional: true },
          { name: 'tenantName', type: 'String', isPrimary: false, isOptional: true },
          { name: 'hasCompletedSetup', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'lastLoginAt', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'Invoice',
        recordCount: invoiceCount,
        lastUpdated: lastInvoice?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'xeroInvoiceId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
          { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'total', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'amountDue', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'amountPaid', type: 'Float', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'Contact',
        recordCount: contactCount,
        lastUpdated: lastContact?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'xeroContactId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'name', type: 'String', isPrimary: false, isOptional: false },
          { name: 'emailAddress', type: 'String', isPrimary: false, isOptional: true },
          { name: 'contactNumber', type: 'String', isPrimary: false, isOptional: true },
          { name: 'isSupplier', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'isCustomer', type: 'Boolean', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'LineItem',
        recordCount: lineItemCount,
        lastUpdated: lastLineItem?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'transactionId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'description', type: 'String', isPrimary: false, isOptional: true },
          { name: 'quantity', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'unitAmount', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'accountCode', type: 'String', isPrimary: false, isOptional: false },
          { name: 'taxType', type: 'String', isPrimary: false, isOptional: true },
          { name: 'lineAmount', type: 'Float', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'ErrorLog',
        recordCount: errorLogCount,
        lastUpdated: lastErrorLog?.createdAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'fingerprint', type: 'String', isPrimary: false, isOptional: false },
          { name: 'errorName', type: 'String', isPrimary: false, isOptional: false },
          { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: false },
          { name: 'severity', type: 'String', isPrimary: false, isOptional: false },
          { name: 'context', type: 'String', isPrimary: false, isOptional: false },
          { name: 'occurredAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'AuditLog',
        recordCount: auditLogCount,
        lastUpdated: lastAuditLog?.timestamp?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'userId', type: 'String', isPrimary: false, isOptional: true },
          { name: 'userEmail', type: 'String', isPrimary: false, isOptional: true },
          { name: 'action', type: 'String', isPrimary: false, isOptional: false },
          { name: 'resource', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'timestamp', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'CurrencyRate',
        recordCount: currencyRateCount,
        lastUpdated: lastCurrencyRate?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'fromCurrency', type: 'String', isPrimary: false, isOptional: false },
          { name: 'toCurrency', type: 'String', isPrimary: false, isOptional: false },
          { name: 'rate', type: 'Float', isPrimary: false, isOptional: false },
          { name: 'source', type: 'String', isPrimary: false, isOptional: false },
          { name: 'effectiveDate', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'Report',
        recordCount: reportCount,
        lastUpdated: lastReport?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'userId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'type', type: 'String', isPrimary: false, isOptional: false },
          { name: 'format', type: 'String', isPrimary: false, isOptional: false },
          { name: 'status', type: 'String', isPrimary: false, isOptional: false },
          { name: 'filePath', type: 'String', isPrimary: false, isOptional: false },
          { name: 'generatedAt', type: 'DateTime', isPrimary: false, isOptional: true },
          { name: 'expiresAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      },
      {
        name: 'SyncCheckpoint',
        recordCount: syncCheckpointCount,
        lastUpdated: lastSyncCheckpoint?.updatedAt?.toISOString(),
        columns: [
          { name: 'id', type: 'String', isPrimary: true, isOptional: false },
          { name: 'syncLogId', type: 'String', isPrimary: false, isOptional: false },
          { name: 'checkpointKey', type: 'String', isPrimary: false, isOptional: false },
          { name: 'data', type: 'String', isPrimary: false, isOptional: false },
          { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
          { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
        ]
      }
    ];

    return NextResponse.json({
      tables,
      totalRecords: userCount + glAccountCount + bankAccountCount + bankTransactionCount + 
                   invoiceCount + contactCount + lineItemCount + syncLogCount + sopCount + 
                   syncedInvoiceCount + repeatingTransactionCount + cashFlowBudgetCount + 
                   cashFlowForecastCount + paymentPatternCount + taxObligationCount + 
                   errorLogCount + cashFlowSyncLogCount + auditLogCount + currencyRateCount + 
                   reportCount + syncCheckpointCount,
      databaseType: 'SQLite',
      lastActivity: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching database info:', error);
    return NextResponse.json({
      error: 'Failed to fetch database info',
      message: error.message
    }, { status: 500 });
  }
  })
);