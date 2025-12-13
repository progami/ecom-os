import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();

interface SaveReportDataOptions {
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  data: any;
  summary?: any;
  importedReportId?: string;
  deactivatePrevious?: boolean;
}

/**
 * Saves report data with proper versioning support
 * Handles scenarios where the same period might be fetched multiple times
 */
export async function saveReportDataWithVersioning(options: SaveReportDataOptions) {
  const {
    reportType,
    periodStart,
    periodEnd,
    data,
    summary,
    importedReportId,
    deactivatePrevious = true
  } = options;

  try {
    // Find the highest version for this period
    const latestVersion = await prisma.reportData.findFirst({
      where: {
        reportType,
        periodStart,
        periodEnd
      },
      orderBy: {
        version: 'desc'
      },
      select: {
        version: true
      }
    });

    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    // If requested, deactivate all previous versions
    if (deactivatePrevious && latestVersion) {
      await prisma.reportData.updateMany({
        where: {
          reportType,
          periodStart,
          periodEnd,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      structuredLogger.info('[Report Versioning] Deactivated previous versions', {
        reportType,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        deactivatedCount: latestVersion ? 1 : 0
      });
    }

    // Create the new version
    const newReportData = await prisma.reportData.create({
      data: {
        reportType,
        periodStart,
        periodEnd,
        data: JSON.stringify(data),
        summary: summary ? JSON.stringify(summary) : null,
        version: newVersion,
        importedReportId,
        isActive: true
      }
    });

    structuredLogger.info('[Report Versioning] Created new report data version', {
      reportType,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      version: newVersion,
      id: newReportData.id
    });

    return newReportData;
  } catch (error) {
    structuredLogger.error('[Report Versioning] Failed to save report data', {
      error,
      reportType,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
    throw error;
  }
}

/**
 * Gets the latest active version of report data for a period
 */
export async function getLatestReportData(
  reportType: string,
  periodStart: Date,
  periodEnd: Date
) {
  return prisma.reportData.findFirst({
    where: {
      reportType,
      periodStart,
      periodEnd,
      isActive: true
    },
    orderBy: {
      version: 'desc'
    }
  });
}

/**
 * Gets all versions of report data for a period (for comparison/audit)
 */
export async function getAllReportDataVersions(
  reportType: string,
  periodStart: Date,
  periodEnd: Date
) {
  return prisma.reportData.findMany({
    where: {
      reportType,
      periodStart,
      periodEnd
    },
    orderBy: {
      version: 'desc'
    },
    include: {
      importedReport: true
    }
  });
}