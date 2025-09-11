import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

interface ReportDataInput {
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  data: any;
  summary?: string;
  importedReportId?: string;
}

export class ReportDataManager {
  /**
   * Creates or updates report data, ensuring only one entry per period
   * This prevents duplicates by checking for existing data in the same period
   */
  static async upsertReportData(input: ReportDataInput) {
    const { reportType, periodStart, periodEnd, data, summary, importedReportId } = input;

    try {
      // First, check if there's existing data for this exact period
      const existingData = await prisma.reportData.findFirst({
        where: {
          reportType,
          periodStart,
          periodEnd,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (existingData) {
        structuredLogger.info('[ReportDataManager] Found existing report data for period, updating', {
          reportType,
          periodStart,
          periodEnd,
          existingId: existingData.id
        });

        // Update the existing record
        const updated = await prisma.reportData.update({
          where: { id: existingData.id },
          data: {
            data: JSON.stringify(data),
            summary: summary || existingData.summary,
            version: existingData.version + 1,
            importedReportId: importedReportId || existingData.importedReportId,
            updatedAt: new Date()
          }
        });

        return updated;
      }

      // No existing data, create new record
      structuredLogger.info('[ReportDataManager] Creating new report data', {
        reportType,
        periodStart,
        periodEnd
      });

      const created = await prisma.reportData.create({
        data: {
          reportType,
          periodStart,
          periodEnd,
          data: JSON.stringify(data),
          summary,
          version: 1,
          isActive: true,
          importedReportId
        }
      });

      return created;

    } catch (error) {
      structuredLogger.error('[ReportDataManager] Error upserting report data', error);
      throw error;
    }
  }

  /**
   * Deactivates old report data for a specific period
   * This is useful when you want to keep historical records but mark them as inactive
   */
  static async deactivateOldData(reportType: string, periodStart: Date, periodEnd: Date, excludeId?: string) {
    try {
      const where: any = {
        reportType,
        periodStart,
        periodEnd,
        isActive: true
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const result = await prisma.reportData.updateMany({
        where,
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      if (result.count > 0) {
        structuredLogger.info('[ReportDataManager] Deactivated old report data', {
          reportType,
          periodStart,
          periodEnd,
          count: result.count
        });
      }

      return result;

    } catch (error) {
      structuredLogger.error('[ReportDataManager] Error deactivating old data', error);
      throw error;
    }
  }

  /**
   * Cleans up duplicate report data entries
   * Keeps the most recent entry with a summary for each period
   */
  static async cleanupDuplicates(reportType: string) {
    try {
      // Get all reports of the specified type
      const allReports = await prisma.reportData.findMany({
        where: { reportType },
        orderBy: [
          { periodStart: 'asc' },
          { summary: 'desc' }, // Prioritize entries with summaries
          { createdAt: 'desc' } // Then by creation date
        ]
      });

      // Group by period
      const reportsByPeriod = new Map<string, typeof allReports>();
      
      allReports.forEach(report => {
        const periodKey = `${report.periodStart.toISOString()}_${report.periodEnd.toISOString()}`;
        if (!reportsByPeriod.has(periodKey)) {
          reportsByPeriod.set(periodKey, []);
        }
        reportsByPeriod.get(periodKey)!.push(report);
      });

      const idsToDelete: string[] = [];
      let keptCount = 0;

      // Process each period
      reportsByPeriod.forEach((reports, periodKey) => {
        if (reports.length > 1) {
          // Keep the first one (best according to our sort criteria)
          keptCount++;
          
          // Mark the rest for deletion
          for (let i = 1; i < reports.length; i++) {
            idsToDelete.push(reports[i].id);
          }
        } else {
          keptCount++;
        }
      });

      // Delete duplicates
      if (idsToDelete.length > 0) {
        const deleteResult = await prisma.reportData.deleteMany({
          where: {
            id: { in: idsToDelete }
          }
        });

        structuredLogger.info('[ReportDataManager] Cleaned up duplicate report data', {
          reportType,
          periodsProcessed: reportsByPeriod.size,
          entriesDeleted: deleteResult.count,
          entriesKept: keptCount
        });
      }

      return {
        periodsProcessed: reportsByPeriod.size,
        entriesDeleted: idsToDelete.length,
        entriesKept: keptCount
      };

    } catch (error) {
      structuredLogger.error('[ReportDataManager] Error cleaning duplicates', error);
      throw error;
    }
  }
}