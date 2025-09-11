// Client-side version of CutoffDateService that uses API calls
import { SYSTEM_DATES } from '@/config/dates';
import clientLogger from '@/utils/clientLogger';

class ClientCutoffDateService {
  private static instance: ClientCutoffDateService;
  private cachedCutoffDate: Date | null = null;

  private constructor() {}

  static getInstance(): ClientCutoffDateService {
    if (!ClientCutoffDateService.instance) {
      ClientCutoffDateService.instance = new ClientCutoffDateService();
    }
    return ClientCutoffDateService.instance;
  }

  /**
   * Get the active cutoff date from the API
   */
  async getActiveCutoffDate(): Promise<Date> {
    // Return cached value if available
    if (this.cachedCutoffDate) {
      return this.cachedCutoffDate;
    }

    try {
      const response = await fetch('/api/cutoff-date');
      if (!response.ok) {
        throw new Error('Failed to fetch cutoff date');
      }
      
      const data = await response.json();
      this.cachedCutoffDate = new Date(data.cutoffDate);
      return this.cachedCutoffDate;
    } catch (error) {
      clientLogger.error('Error getting cutoff date:', error);
      // Return default date on error
      return SYSTEM_DATES.CUTOFF_DATE;
    }
  }

  /**
   * Update the cutoff date via API
   */
  async updateCutoffDate(date: Date, fileName: string, transactionCount: number, totalAmount: number): Promise<void> {
    try {
      const response = await fetch('/api/cutoff-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date.toISOString(),
          fileName,
          transactionCount,
          totalAmount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update cutoff date');
      }

      // Clear cache
      this.cachedCutoffDate = null;
      
      clientLogger.info('Updated cutoff date to:', date);
    } catch (error) {
      clientLogger.error('Error updating cutoff date:', error);
      throw error;
    }
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
   * Clear the cached cutoff date
   */
  clearCache(): void {
    this.cachedCutoffDate = null;
  }
}

export default ClientCutoffDateService;