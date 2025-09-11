// Client-side service for GL operations
// This service makes API calls instead of direct database access
import clientLogger from '@/utils/clientLogger';

interface GLEntry {
  date: Date | string
  description: string
  category: string
  accountCode?: string
  accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  amount: number
  runningBalance?: number
  isProjection?: boolean
  isReconciled?: boolean
  source?: string
}

interface ExpenseData {
  date: Date | string
  weekStarting: Date | string
  category: string
  subcategory?: string | null
  description: string
  amount: number
  type: string
  vendor?: string
  isRecurring?: boolean
  recurringFreq?: string
}

class ClientGLService {
  private static instance: ClientGLService;
  
  static getInstance(): ClientGLService {
    if (!ClientGLService.instance) {
      ClientGLService.instance = new ClientGLService();
    }
    return ClientGLService.instance;
  }
  
  // GL Entry operations
  async getGLEntries(startDate?: Date, endDate?: Date): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      
      // Use raw-entries endpoint to get original GL entry structure
      const response = await fetch(`/api/gl/raw-entries?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch GL entries');
      
      const data = await response.json();
      return data.entries || [];
    } catch (error) {
      clientLogger.error('Error fetching GL entries:', error);
      return [];
    }
  }
  
  async saveGLEntries(entries: GLEntry[]): Promise<void> {
    try {
      const response = await fetch('/api/gl/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
      
      if (!response.ok) throw new Error('Failed to save GL entries');
    } catch (error) {
      clientLogger.error('Error saving GL entries:', error);
      throw error;
    }
  }
  
  // Expense operations
  async getExpenses(startDate: Date, endDate: Date): Promise<ExpenseData[]> {
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const response = await fetch(`/api/expenses/manage?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch expenses');
      
      const data = await response.json();
      return data.expenses || [];
    } catch (error) {
      clientLogger.error('Error fetching expenses:', error);
      return [];
    }
  }
  
  async saveExpenses(expenses: ExpenseData[]): Promise<void> {
    try {
      const response = await fetch('/api/expenses/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses })
      });
      
      if (!response.ok) throw new Error('Failed to save expenses');
    } catch (error) {
      clientLogger.error('Error saving expenses:', error);
      throw error;
    }
  }
  
  async calculateAmazonFees(weekStarting: Date, year: number, skuData: any[]): Promise<void> {
    try {
      const response = await fetch('/api/expenses/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          weekStarting: weekStarting.toISOString(),
          year,
          skuData 
        })
      });
      
      if (!response.ok) throw new Error('Failed to calculate Amazon fees');
    } catch (error) {
      clientLogger.error('Error calculating Amazon fees:', error);
      throw error;
    }
  }
  
  // Revenue operations
  async getRevenue(): Promise<any[]> {
    try {
      const response = await fetch('/api/revenue/shared?type=revenue');
      if (!response.ok) throw new Error('Failed to fetch revenue');
      
      const data = await response.json();
      return data.revenue || [];
    } catch (error) {
      clientLogger.error('Error fetching revenue:', error);
      return [];
    }
  }
  
}

export default ClientGLService;