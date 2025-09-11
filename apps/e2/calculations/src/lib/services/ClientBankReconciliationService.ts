// Client-side version of BankReconciliationService that uses API calls
import clientLogger from '@/utils/clientLogger';
interface ReconciliationSummary {
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  totalAmount: number;
  matchedAmount: number;
  unmatchedAmount: number;
  newEntriesCreated: number;
  entriesReconciled: number;
  lastReconciledDate: Date;
}

class ClientBankReconciliationService {
  private static instance: ClientBankReconciliationService;

  private constructor() {}

  static getInstance(): ClientBankReconciliationService {
    if (!ClientBankReconciliationService.instance) {
      ClientBankReconciliationService.instance = new ClientBankReconciliationService();
    }
    return ClientBankReconciliationService.instance;
  }

  /**
   * Process bank statement via API
   */
  async processBankStatement(csvContent: string, fileName: string): Promise<ReconciliationSummary> {
    try {
      const response = await fetch('/api/bank-reconciliation/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvContent,
          fileName
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to process bank statement');
      }

      const data = await response.json();
      
      // Convert date string to Date object
      return {
        ...data,
        lastReconciledDate: new Date(data.lastReconciledDate)
      };
    } catch (error) {
      clientLogger.error('Error processing bank statement:', error);
      throw error;
    }
  }

  /**
   * Get reconciliation status via API
   */
  async getReconciliationStatus(): Promise<{
    lastReconciledDate: Date | null;
    totalEntries: number;
    reconciledEntries: number;
    unreconciledEntries: number;
    reconciliationRate: number;
  }> {
    try {
      const response = await fetch('/api/bank-reconciliation/status');
      if (!response.ok) {
        throw new Error('Failed to fetch reconciliation status');
      }

      const data = await response.json();
      
      return {
        ...data,
        lastReconciledDate: data.lastReconciledDate ? new Date(data.lastReconciledDate) : null
      };
    } catch (error) {
      clientLogger.error('Error getting reconciliation status:', error);
      return {
        lastReconciledDate: null,
        totalEntries: 0,
        reconciledEntries: 0,
        unreconciledEntries: 0,
        reconciliationRate: 0
      };
    }
  }
}

export default ClientBankReconciliationService;
export type { ReconciliationSummary };