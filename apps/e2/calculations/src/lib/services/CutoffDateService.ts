import { PrismaClient, ReconciliationStatus } from '@prisma/client';
import { validateDateFormat } from '@/config/validator';
import SystemConfigService from '@/services/database/SystemConfigService';
import logger from '@/utils/logger';

class CutoffDateService {
  private static instance: CutoffDateService;
  private prisma: PrismaClient;
  private cachedCutoffDate: Date | null = null;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): CutoffDateService {
    if (!CutoffDateService.instance) {
      CutoffDateService.instance = new CutoffDateService();
    }
    return CutoffDateService.instance;
  }

  /**
   * Get the active cutoff date from the latest bank reconciliation
   * Returns a default date if no reconciliation exists
   */
  async getActiveCutoffDate(): Promise<Date> {
    // Return cached value if available
    if (this.cachedCutoffDate) {
      return this.cachedCutoffDate;
    }

    try {
      // First try to get the active reconciliation with new fields
      try {
        const activeReconciliation = await this.prisma.reconciliationStatus.findFirst({
          where: { isActive: true },
          orderBy: { cutoffDate: 'desc' }
        });

        if (activeReconciliation && 'cutoffDate' in activeReconciliation && activeReconciliation.cutoffDate) {
          this.cachedCutoffDate = new Date(activeReconciliation.cutoffDate);
          return this.cachedCutoffDate;
        }
      } catch (e) {
        // isActive or cutoffDate field might not exist
        logger.info('New fields not available in query');
      }

      // Fallback to using lastReconciledDate
      const latestReconciliation = await this.prisma.reconciliationStatus.findFirst({
        orderBy: { lastReconciledDate: 'desc' }
      });

      if (latestReconciliation?.lastReconciledDate) {
        this.cachedCutoffDate = new Date(latestReconciliation.lastReconciledDate);
        return this.cachedCutoffDate;
      }

      // Default cutoff date from centralized config
      const configService = SystemConfigService.getInstance();
      const systemDates = await configService.getSystemDates();
      const defaultDate = new Date(systemDates.cutoffDate);
      logger.info('No reconciliation found, using default cutoff date:', defaultDate);
      return defaultDate;
    } catch (error) {
      logger.error('Error getting cutoff date:', error);
      // Return default date on error
      const configService = SystemConfigService.getInstance();
      const systemDates = await configService.getSystemDates();
      return new Date(systemDates.cutoffDate);
    }
  }

  /**
   * Update the cutoff date when a bank statement is uploaded
   * This will deactivate previous reconciliations and create/update the current one
   */
  async updateCutoffDate(date: Date, fileName: string, transactionCount: number, totalAmount: number): Promise<void> {
    // Validate date format if date is provided as string
    if (typeof date === 'string') {
      if (!validateDateFormat(date)) {
        throw new Error(`Invalid date format: ${date}. Date must be in ISO format (YYYY-MM-DD).`);
      }
      date = new Date(date);
    }
    
    try {
      // Try to use new fields, fallback if they don't exist
      try {
        // Deactivate all existing active reconciliations
        await this.prisma.reconciliationStatus.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });
      } catch (e) {
        // Fields might not exist in older schema
        logger.info('isActive field not available, skipping deactivation');
      }

      // Create new active reconciliation
      const reconciliationData: any = {
        lastReconciledDate: date,
        fileName,
        transactionCount,
        totalAmount,
        bankName: 'Chase Bank' // Default, can be made configurable
      };

      // Add new fields if they exist
      try {
        reconciliationData.cutoffDate = date;
        reconciliationData.isActive = true;
      } catch (e) {
        logger.info('New fields not available, using basic data');
      }

      await this.prisma.reconciliationStatus.create({
        data: reconciliationData
      });

      // Clear cache
      this.cachedCutoffDate = null;
      
      logger.info('Updated cutoff date to:', date);
    } catch (error) {
      logger.error('Error updating cutoff date:', error);
      throw error;
    }
  }

  /**
   * Check if a date is before the cutoff (actual data) or after (forecast)
   */
  async isActualData(date: Date): Promise<boolean> {
    const cutoffDate = await this.getActiveCutoffDate();
    return date <= cutoffDate;
  }

  /**
   * Get the date from which forecasts should start (cutoff + 1 day)
   */
  async getForecastStartDate(): Promise<Date> {
    const cutoffDate = await this.getActiveCutoffDate();
    const forecastStart = new Date(cutoffDate);
    forecastStart.setDate(forecastStart.getDate() + 1);
    return forecastStart;
  }

  /**
   * Clear the cached cutoff date (useful for testing or when data changes)
   */
  clearCache(): void {
    this.cachedCutoffDate = null;
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(): Promise<ReconciliationStatus[]> {
    return await this.prisma.reconciliationStatus.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
  }
}

export default CutoffDateService;