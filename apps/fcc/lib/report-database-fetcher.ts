import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export class ReportDatabaseFetcher {
  /**
   * Fetch Balance Sheet data from database
   */
  static async fetchBalanceSheet(periodStart: Date, periodEnd: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'BALANCE_SHEET',
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
          isActive: true
        },
        orderBy: { version: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found balance sheet data in database', {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No balance sheet data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching balance sheet from database', error);
      return null;
    }
  }

  /**
   * Fetch Profit & Loss data from database
   */
  static async fetchProfitLoss(periodStart: Date, periodEnd: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'PROFIT_LOSS',
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
          isActive: true
        },
        orderBy: { version: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found profit & loss data in database', {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No profit & loss data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching profit & loss from database', error);
      return null;
    }
  }

  /**
   * Fetch Cash Flow data from database
   */
  static async fetchCashFlow(periodStart: Date, periodEnd: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'CASH_FLOW',
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
          isActive: true
        },
        orderBy: [
          { summary: 'desc' }, // Prioritize reports with summaries (non-null first)
          { createdAt: 'desc' }, // Then by most recent
          { version: 'desc' } // Then by version
        ]
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found cash flow data in database', {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No cash flow data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching cash flow from database', error);
      return null;
    }
  }

  /**
   * Fetch Cash Summary data from database
   */
  static async fetchCashSummary(periodStart: Date, periodEnd: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'CASH_SUMMARY',
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
          isActive: true
        },
        orderBy: { version: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found cash summary data in database', {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No cash summary data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching cash summary from database', error);
      return null;
    }
  }

  /**
   * Fetch Aged Payables data from database
   */
  static async fetchAgedPayables(asAtDate?: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'AGED_PAYABLES',
          isActive: true,
          ...(asAtDate && { periodEnd: { lte: asAtDate } })
        },
        orderBy: { periodEnd: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found aged payables data in database', {
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No aged payables data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching aged payables from database', error);
      return null;
    }
  }

  /**
   * Fetch Aged Receivables data from database
   */
  static async fetchAgedReceivables(asAtDate?: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'AGED_RECEIVABLES',
          isActive: true,
          ...(asAtDate && { periodEnd: { lte: asAtDate } })
        },
        orderBy: { periodEnd: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found aged receivables data in database', {
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No aged receivables data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching aged receivables from database', error);
      return null;
    }
  }

  /**
   * Fetch Trial Balance data from database
   */
  static async fetchTrialBalance(asAtDate?: Date) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'TRIAL_BALANCE',
          isActive: true,
          ...(asAtDate && { periodEnd: { lte: asAtDate } })
        },
        orderBy: { periodEnd: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found trial balance data in database', {
          periodEnd: reportData.periodEnd,
          version: reportData.version
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No trial balance data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching trial balance from database', error);
      return null;
    }
  }


  /**
   * Fetch General Ledger data from database
   */
  static async fetchGeneralLedger(periodStart: Date, periodEnd: Date, accountFilter?: string) {
    try {
      const reportData = await prisma.reportData.findFirst({
        where: {
          reportType: 'GENERAL_LEDGER',
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
          isActive: true,
          ...(accountFilter && {
            metadata: {
              path: ['accountFilter'],
              equals: accountFilter
            }
          })
        },
        orderBy: { version: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found general ledger data in database', {
          periodStart: reportData.periodStart,
          periodEnd: reportData.periodEnd,
          version: reportData.version,
          accountFilter
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No general ledger data found in database', {
        periodStart,
        periodEnd,
        accountFilter
      });
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching general ledger from database', error);
      return null;
    }
  }

  /**
   * Fetch Trial Balance data from database
   */
  static async fetchTrialBalance(asAtDate?: Date, importId?: string) {
    try {
      const where: any = {
        reportType: 'TRIAL_BALANCE',
        isActive: true
      };

      if (importId) {
        where.importedReportId = importId;
      } else if (asAtDate) {
        where.periodEnd = { lte: asAtDate };
      }

      const reportData = await prisma.reportData.findFirst({
        where,
        orderBy: importId ? { createdAt: 'desc' } : { periodEnd: 'desc' }
      });

      if (reportData) {
        structuredLogger.info('[ReportDB] Found trial balance data in database', {
          periodEnd: reportData.periodEnd,
          version: reportData.version,
          importId: reportData.importedReportId
        });
        return JSON.parse(reportData.data);
      }

      structuredLogger.info('[ReportDB] No trial balance data found in database');
      return null;
    } catch (error) {
      structuredLogger.error('[ReportDB] Error fetching trial balance from database', error);
      return null;
    }
  }

  /**
   * Check if Xero API is disabled
   */
  static async isXeroApiDisabled() {
    // Xero API is now always enabled to allow manual fetching from report pages
    return false;
  }
}