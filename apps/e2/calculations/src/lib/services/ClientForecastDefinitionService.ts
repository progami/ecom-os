// Client-side version of ForecastDefinitionService that uses API calls
import clientLogger from '@/utils/clientLogger';
interface GeneratedForecast {
  date: Date;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  accountCode: string;
  type: string;
  sourceDefinitionId: string;
}

interface ForecastDefinitionInput {
  type: string;
  category: string;
  subcategory?: string;
  sku?: string;
  description: string;
  baseAmount?: number;
  percentage?: number;
  frequency?: string;
  startDate: Date;
  endDate?: Date;
  metadata?: any;
}

class ClientForecastDefinitionService {
  private static instance: ClientForecastDefinitionService;

  private constructor() {}

  static getInstance(): ClientForecastDefinitionService {
    if (!ClientForecastDefinitionService.instance) {
      ClientForecastDefinitionService.instance = new ClientForecastDefinitionService();
    }
    return ClientForecastDefinitionService.instance;
  }

  /**
   * Generate forecast entries via API
   */
  async generateForecasts(fromDate?: Date, toDate?: Date): Promise<GeneratedForecast[]> {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate.toISOString());
      if (toDate) params.append('toDate', toDate.toISOString());

      const response = await fetch(`/api/forecasts/generate?${params}`);
      if (!response.ok) {
        throw new Error('Failed to generate forecasts');
      }

      const data = await response.json();
      
      // Convert date strings back to Date objects
      return data.forecasts.map((forecast: any) => ({
        ...forecast,
        date: new Date(forecast.date)
      }));
    } catch (error) {
      clientLogger.error('Error generating forecasts:', error);
      return [];
    }
  }

  /**
   * Create a new forecast definition via API
   */
  async createDefinition(data: ForecastDefinitionInput): Promise<void> {
    try {
      const response = await fetch('/api/forecasts/definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate?.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create forecast definition');
      }
    } catch (error) {
      clientLogger.error('Error creating forecast definition:', error);
      throw error;
    }
  }

  /**
   * Regenerate all forecasts
   */
  async regenerateForecasts(): Promise<void> {
    try {
      const response = await fetch('/api/forecasts/regenerate', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate forecasts');
      }
    } catch (error) {
      clientLogger.error('Error regenerating forecasts:', error);
      throw error;
    }
  }
}

export default ClientForecastDefinitionService;
export type { GeneratedForecast, ForecastDefinitionInput };