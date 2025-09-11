interface RevenueForGL {
  date: Date;
  category: string;
  subcategory: string;
  description: string;
  amount: number;
  accountCode: string;
  type: string;
}

interface RevenueSummary {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalCOGS: number;
  averageMargin: number;
  bySkuMetrics: Record<string, {
    grossRevenue: number;
    netRevenue: number;
    units: number;
    margin: number;
  }>;
}
import clientLogger from '@/utils/clientLogger';

class ClientRevenueService {
  private static instance: ClientRevenueService;

  private constructor() {}

  static getInstance(): ClientRevenueService {
    if (!ClientRevenueService.instance) {
      ClientRevenueService.instance = new ClientRevenueService();
    }
    return ClientRevenueService.instance;
  }

  /**
   * Get revenue calculations for GL display
   */
  async getRevenueForGL(startDate: Date, endDate: Date): Promise<RevenueForGL[]> {
    try {
      const response = await fetch('/api/revenue/gl-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert date strings back to Date objects
      return data.map((entry: any) => ({
        ...entry,
        date: new Date(entry.date)
      }));
    } catch (error) {
      clientLogger.error('Error fetching revenue for GL:', error);
      return [];
    }
  }

  /**
   * Generate revenue forecasts
   */
  async generateForecasts(startDate?: Date, endDate?: Date): Promise<boolean> {
    try {
      const response = await fetch('/api/revenue/generate-forecasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        })
      });

      return response.ok;
    } catch (error) {
      clientLogger.error('Error generating revenue forecasts:', error);
      return false;
    }
  }

  /**
   * Get revenue summary metrics
   */
  async getSummaryMetrics(startDate: Date, endDate: Date): Promise<RevenueSummary | null> {
    try {
      const response = await fetch('/api/revenue/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clientLogger.error('Error fetching revenue summary:', error);
      return null;
    }
  }

  /**
   * Clear and regenerate all revenue calculations
   */
  async regenerateAll(): Promise<boolean> {
    try {
      const response = await fetch('/api/revenue/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return response.ok;
    } catch (error) {
      clientLogger.error('Error regenerating revenue calculations:', error);
      return false;
    }
  }
}

export default ClientRevenueService;
export type { RevenueForGL, RevenueSummary };