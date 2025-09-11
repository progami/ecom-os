import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withRateLimit } from '@/lib/rate-limiter';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { logTaxSync } from '@/lib/logger/development-logger';

export const POST = withRateLimit(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      try {
        structuredLogger.info('[Tax Sync] Starting tax rate sync', {
          userId: session?.user?.userId,
          tenantId: session?.user?.tenantId
        });

        const xero = await getXeroClient(session.user.userId);
        const tenantId = session.user.tenantId;

        if (!tenantId) {
          throw new Error('No Xero tenant ID found');
        }

        // Fetch tax rates from Xero
        const taxRatesResponse = await xero.accountingApi.getTaxRates(tenantId);
        const taxRates = taxRatesResponse.body.taxRates || [];

        const taxRatesSummary = taxRates.map(tr => ({
          taxType: tr.taxType,
          name: tr.name,
          displayName: tr.displayName,
          effectiveRate: tr.effectiveRate,
          status: tr.status
        }));

        structuredLogger.info('[Tax Sync] Fetched tax rates from Xero', {
          count: taxRates.length,
          taxRates: taxRatesSummary
        });

        // Log to development file
        logTaxSync('API: Fetched tax rates from Xero', {
          count: taxRates.length,
          taxRates: taxRatesSummary
        });

        let created = 0;
        let updated = 0;
        const errors: any[] = [];

        // Process each tax rate
        for (const taxRate of taxRates) {
          try {
            if (!taxRate.taxType) {
              structuredLogger.warn('[Tax Sync] Skipping tax rate without taxType', { taxRate });
              continue;
            }

            // Log the full tax rate object for debugging
            structuredLogger.info('[Tax Sync] Processing tax rate', {
              taxType: taxRate.taxType,
              name: taxRate.name,
              displayName: taxRate.displayName,
              effectiveRate: taxRate.effectiveRate,
              status: taxRate.status,
              reportTaxType: taxRate.reportTaxType,
              canApplyToAssets: taxRate.canApplyToAssets,
              canApplyToEquity: taxRate.canApplyToEquity,
              canApplyToExpenses: taxRate.canApplyToExpenses,
              canApplyToLiabilities: taxRate.canApplyToLiabilities,
              canApplyToRevenue: taxRate.canApplyToRevenue
            });

            const existingRate = await prisma.taxRate.findUnique({
              where: { xeroTaxType: taxRate.taxType }
            });

            const taxRateData = {
              xeroTaxType: taxRate.taxType,
              name: taxRate.name || taxRate.taxType,
              displayName: taxRate.displayName || taxRate.name || taxRate.taxType,
              effectiveRate: taxRate.effectiveRate || 0,
              status: taxRate.status?.toString() || null,
              reportTaxType: taxRate.reportTaxType || null,
              canApplyToAssets: taxRate.canApplyToAssets || false,
              canApplyToEquity: taxRate.canApplyToEquity || false,
              canApplyToExpenses: taxRate.canApplyToExpenses || false,
              canApplyToLiabilities: taxRate.canApplyToLiabilities || false,
              canApplyToRevenue: taxRate.canApplyToRevenue || false,
              updatedAt: new Date()
            };

            if (existingRate) {
              await prisma.taxRate.update({
                where: { xeroTaxType: taxRate.taxType },
                data: taxRateData
              });
              updated++;
            } else {
              await prisma.taxRate.create({
                data: taxRateData
              });
              created++;
            }

          } catch (error: any) {
            structuredLogger.error('[Tax Sync] Failed to process tax rate', error, {
              taxType: taxRate.taxType,
              error: error.message
            });
            errors.push({
              taxType: taxRate.taxType,
              error: error.message
            });
          }
        }

        // Create sync log
        await prisma.syncLog.create({
          data: {
            syncType: 'tax_rates',
            status: errors.length > 0 ? 'partial' : 'success',
            startedAt: new Date(),
            completedAt: new Date(),
            recordsCreated: created,
            recordsUpdated: updated,
            errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
            details: JSON.stringify({
              totalRates: taxRates.length,
              created,
              updated,
              errors: errors.length
            })
          }
        });

        // Log success
        await auditLogger.logSuccess(
          AuditAction.DATA_SYNC,
          AuditResource.TAX_RATES,
          {
            metadata: {
              created,
              updated,
              total: taxRates.length,
              errors: errors.length
            }
          }
        );

        structuredLogger.info('[Tax Sync] Tax rate sync completed', {
          created,
          updated,
          total: taxRates.length,
          errors: errors.length
        });

        return NextResponse.json({
          success: true,
          summary: {
            total: taxRates.length,
            created,
            updated,
            errors: errors.length
          },
          taxRates: await prisma.taxRate.findMany({
            orderBy: { name: 'asc' }
          })
        });

      } catch (error: any) {
        structuredLogger.error('[Tax Sync] Tax rate sync failed', error);
        
        // Log failure
        await auditLogger.logFailure(
          AuditAction.DATA_SYNC,
          AuditResource.TAX_RATES,
          error,
          {
            metadata: {
              error: error.message
            }
          }
        );

        return NextResponse.json({
          error: 'Failed to sync tax rates',
          message: error.message
        }, { status: 500 });
      }
    }
  )
);

// GET endpoint to list current tax rates
export async function GET(request: NextRequest) {
  try {
    const taxRates = await prisma.taxRate.findMany({
      orderBy: { name: 'asc' }
    });

    const stats = await prisma.taxRate.aggregate({
      _count: true
    });

    return NextResponse.json({
      taxRates,
      stats: {
        total: stats._count
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get tax rates',
      message: error.message
    }, { status: 500 });
  }
}