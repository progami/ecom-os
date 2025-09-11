import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/auth-wrapper';

export const GET = withAdminAuth(async (
  request,
  session
) => {
  const tableName = request.nextUrl.pathname.split('/').pop() || '';
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let records: any[] = [];
    let total = 0;

    // Fetch data based on table name
    switch (tableName) {
      case 'BankAccount':
        [records, total] = await Promise.all([
          prisma.bankAccount.findMany({
            take: limit,
            skip: offset,
            orderBy: { name: 'asc' }
          }),
          prisma.bankAccount.count()
        ]);
        break;

      case 'SyncLog':
        [records, total] = await Promise.all([
          prisma.syncLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { startedAt: 'desc' }
          }),
          prisma.syncLog.count()
        ]);
        break;

      case 'StandardOperatingProcedure':
        [records, total] = await Promise.all([
          prisma.standardOperatingProcedure.findMany({
            take: limit,
            skip: offset,
            orderBy: [{ year: 'desc' }, { chartOfAccount: 'asc' }]
          }),
          prisma.standardOperatingProcedure.count()
        ]);
        break;

      case 'SyncedInvoice':
        [records, total] = await Promise.all([
          prisma.syncedInvoice.findMany({
            take: limit,
            skip: offset,
            orderBy: { dueDate: 'desc' }
          }),
          prisma.syncedInvoice.count()
        ]);
        break;

      case 'RepeatingTransaction':
        [records, total] = await Promise.all([
          prisma.repeatingTransaction.findMany({
            take: limit,
            skip: offset,
            orderBy: { nextScheduledDate: 'asc' }
          }),
          prisma.repeatingTransaction.count()
        ]);
        break;

      case 'CashFlowBudget':
        [records, total] = await Promise.all([
          prisma.cashFlowBudget.findMany({
            take: limit,
            skip: offset,
            orderBy: [{ monthYear: 'desc' }, { accountCode: 'asc' }]
          }),
          prisma.cashFlowBudget.count()
        ]);
        break;

      case 'CashFlowForecast':
        [records, total] = await Promise.all([
          prisma.cashFlowForecast.findMany({
            take: limit,
            skip: offset,
            orderBy: { date: 'asc' }
          }),
          prisma.cashFlowForecast.count()
        ]);
        break;

      case 'PaymentPattern':
        [records, total] = await Promise.all([
          prisma.paymentPattern.findMany({
            take: limit,
            skip: offset,
            orderBy: { contactName: 'asc' }
          }),
          prisma.paymentPattern.count()
        ]);
        break;

      case 'TaxObligation':
        [records, total] = await Promise.all([
          prisma.taxObligation.findMany({
            take: limit,
            skip: offset,
            orderBy: { dueDate: 'asc' }
          }),
          prisma.taxObligation.count()
        ]);
        break;

      case 'CashFlowSyncLog':
        [records, total] = await Promise.all([
          prisma.cashFlowSyncLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { startedAt: 'desc' }
          }),
          prisma.cashFlowSyncLog.count()
        ]);
        break;

      case 'User':
        [records, total] = await Promise.all([
          prisma.user.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              name: true,
              xeroUserId: true,
              tenantName: true,
              hasCompletedSetup: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true
            }
          }),
          prisma.user.count()
        ]);
        break;

      case 'Invoice':
        [records, total] = await Promise.all([
          prisma.invoice.findMany({
            take: limit,
            skip: offset,
            orderBy: { date: 'desc' },
            include: {
              contact: {
                select: {
                  name: true
                }
              }
            }
          }),
          prisma.invoice.count()
        ]);
        break;

      case 'Contact':
        [records, total] = await Promise.all([
          prisma.contact.findMany({
            take: limit,
            skip: offset,
            orderBy: { name: 'asc' }
          }),
          prisma.contact.count()
        ]);
        break;

      case 'ErrorLog':
        [records, total] = await Promise.all([
          prisma.errorLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { occurredAt: 'desc' }
          }),
          prisma.errorLog.count()
        ]);
        break;

      case 'AuditLog':
        [records, total] = await Promise.all([
          prisma.auditLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { timestamp: 'desc' }
          }),
          prisma.auditLog.count()
        ]);
        break;

      case 'CurrencyRate':
        [records, total] = await Promise.all([
          prisma.currencyRate.findMany({
            take: limit,
            skip: offset,
            orderBy: { effectiveDate: 'desc' }
          }),
          prisma.currencyRate.count()
        ]);
        break;

      case 'Report':
        [records, total] = await Promise.all([
          prisma.report.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              userId: true,
              type: true,
              format: true,
              status: true,
              startDate: true,
              endDate: true,
              fileSize: true,
              generatedAt: true,
              expiresAt: true,
              downloadCount: true,
              createdAt: true
            }
          }),
          prisma.report.count()
        ]);
        break;

      case 'SyncCheckpoint':
        [records, total] = await Promise.all([
          prisma.syncCheckpoint.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
              syncLog: {
                select: {
                  syncType: true,
                  status: true
                }
              }
            }
          }),
          prisma.syncCheckpoint.count()
        ]);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid table name'
        }, { status: 400 });
    }

    return NextResponse.json({
      records,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error: any) {
    console.error(`Error fetching ${tableName} data:`, error);
    return NextResponse.json({
      error: 'Failed to fetch table data',
      message: error.message
    }, { status: 500 });
  }
});