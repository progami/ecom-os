// src/lib/clientDataLoader.ts

import { ProductMargin, Assumptions, CSVData } from '@/types/financial';
import clientLogger from '@/utils/clientLogger';

/**
 * Client-side data loader that fetches pre-processed CSV data from API
 */
export class ClientDataLoader {
  private static instance: ClientDataLoader;
  private cachedData?: CSVData;
  private cachedAssumptions?: Partial<Assumptions>;
  
  private constructor() {}
  
  static getInstance(): ClientDataLoader {
    if (!ClientDataLoader.instance) {
      ClientDataLoader.instance = new ClientDataLoader();
    }
    return ClientDataLoader.instance;
  }
  
  /**
   * Fetch all CSV data from the API
   */
  async loadAllData(): Promise<CSVData> {
    if (this.cachedData) {
      return this.cachedData;
    }
    
    try {
      const response = await fetch('/api/csv-data');
      if (!response.ok) {
        throw new Error('Failed to fetch CSV data');
      }
      
      this.cachedData = await response.json();
      return this.cachedData!;
    } catch (error) {
      clientLogger.error('Error loading CSV data:', error);
      throw error;
    }
  }
  
  /**
   * Get default assumptions from CSV data
   */
  async getDefaultAssumptions(): Promise<Partial<Assumptions>> {
    if (this.cachedAssumptions) {
      return this.cachedAssumptions;
    }
    
    try {
      const response = await fetch('/api/default-assumptions');
      if (!response.ok) {
        throw new Error('Failed to fetch default assumptions');
      }
      
      this.cachedAssumptions = await response.json();
      return this.cachedAssumptions!;
    } catch (error) {
      clientLogger.error('Error loading default assumptions:', error);
      throw error;
    }
  }
  
  /**
   * Get product margins
   */
  async getProductMargins(): Promise<ProductMargin[]> {
    const data = await this.loadAllData();
    return data.productMargins || [];
  }
  
  /**
   * Get yearly figures
   */
  async getYearlyFigures(): Promise<any[]> {
    const data = await this.loadAllData();
    return data.yearlyFigures || [];
  }
  
  /**
   * Get investment breakdown
   */
  async getInvestmentBreakdown(): Promise<any> {
    const data = await this.loadAllData();
    return data.investmentBreakdown || {};
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedData = undefined;
    this.cachedAssumptions = undefined;
  }
}

// Export singleton instance
export const dataLoader = ClientDataLoader.getInstance();