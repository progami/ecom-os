import GLDataService, { GLEntry } from '@/lib/services/GLDataService';
import { parse } from 'csv-parse/sync';
import CutoffDateService from '@/lib/services/CutoffDateService';
import logger from '@/utils/logger';

interface BankTransaction {
  date: Date;
  description: string;
  category: string;
  amount: number;
  balance: number;
}

interface ReconciliationMatch {
  bankTransaction: BankTransaction;
  glEntry: GLEntry | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'unmatched';
}

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
  matches: ReconciliationMatch[];
}

class BankReconciliationService {
  private static instance: BankReconciliationService;
  private glDataService: GLDataService;
  private cutoffDateService: CutoffDateService;

  private constructor() {
    this.glDataService = GLDataService.getInstance();
    this.cutoffDateService = CutoffDateService.getInstance();
  }

  static getInstance(): BankReconciliationService {
    if (!BankReconciliationService.instance) {
      BankReconciliationService.instance = new BankReconciliationService();
    }
    return BankReconciliationService.instance;
  }

  /**
   * Parse CSV file content into bank transactions
   * Supports Chase bank format: Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
   */
  parseCSV(csvContent: string): BankTransaction[] {
    try {
      // First parse with headers to check for Category column
      const recordsWithHeaders = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      // Check if Category column exists
      if (recordsWithHeaders.length > 0) {
        const headers = Object.keys(recordsWithHeaders[0]);
        logger.info('CSV headers found:', headers);
        
        if (!headers.includes('Category')) {
          throw new Error(`CSV must include a Category column. Found headers: ${headers.join(', ')}`);
        }

        // Parse transactions using header mapping
        return recordsWithHeaders.map((record: any) => {
          const dateStr = record['Posting Date'];
          const description = record['Description'];
          const category = record['Category'];
          const amountStr = record['Amount'];
          const balanceStr = record['Balance'];

          // Parse date - handle MM/DD/YYYY format
          const date = this.parseDate(dateStr);
          
          // Parse amount - already includes sign
          const amount = parseFloat(amountStr.replace(/[$,]/g, ''));
          
          // Parse balance
          const balance = parseFloat(balanceStr.replace(/[$,]/g, ''));
          
          // Validate category is provided
          if (!category || category.trim() === '') {
            throw new Error(`Missing category for transaction on ${dateStr}: ${description}`);
          }

          return {
            date,
            description: description.trim().replace(/"/g, ''), // Remove quotes
            category: category.trim(),
            amount,
            balance,
          };
        });
      }

      return [];
    } catch (error) {
      logger.error('Error parsing CSV:', error);
      // Re-throw specific errors
      if (error instanceof Error && error.message.includes('CSV must include a Category column')) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Invalid date format:')) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Missing category')) {
        throw error;
      }
      throw new Error('Failed to parse CSV file. Please ensure it includes a Category column. Expected format: Details, Posting Date, Description, Category, Amount, Type, Balance, Check or Slip #');
    }
  }

  /**
   * Check if the first row is a header
   */
  private isHeaderRow(row: string[]): boolean {
    if (!row || row.length < 4) return false;
    
    // Check for Chase header format
    if (row[0] === 'Details' || row[0].toLowerCase() === 'details') {
      return true;
    }
    
    // Check if first column looks like a date
    const datePatterns = [
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/, // MM/DD/YYYY or MM-DD-YYYY
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,   // YYYY/MM/DD or YYYY-MM-DD
    ];
    return !datePatterns.some(pattern => pattern.test(row[0]));
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date {
    // Try common date formats
    const formats = [
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/, // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/, // YYYY/MM/DD or YYYY-MM-DD
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/,  // MM/DD/YY or MM-DD-YY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          // MM/DD/YYYY
          return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (format === formats[1]) {
          // YYYY/MM/DD
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (format === formats[2]) {
          // MM/DD/YY - assume 20YY
          const year = 2000 + parseInt(match[3]);
          return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
        }
      }
    }

    // Fallback to Date constructor
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return date;
  }

  /**
   * Match bank transactions to GL entries
   */
  async matchTransactions(
    bankTransactions: BankTransaction[],
    dateToleranceDays: number = 2,
    amountTolerancePercent: number = 1
  ): Promise<ReconciliationMatch[]> {
    const glEntries = this.glDataService.getEntries();
    const matches: ReconciliationMatch[] = [];

    for (const bankTx of bankTransactions) {
      let bestMatch: GLEntry | null = null;
      let bestConfidence = 0;
      let matchType: 'exact' | 'fuzzy' | 'unmatched' = 'unmatched';

      // Filter GL entries by date range and amount
      const candidateEntries = glEntries.filter(entry => {
        // Check if entry is already reconciled
        if (entry.isReconciled) return false;

        // Date tolerance
        const daysDiff = Math.abs(
          (entry.date.getTime() - bankTx.date.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > dateToleranceDays) return false;

        // Amount tolerance
        const amountDiff = Math.abs(entry.amount - bankTx.amount);
        const tolerance = Math.abs(bankTx.amount) * (amountTolerancePercent / 100);
        if (amountDiff > tolerance) return false;

        return true;
      });

      // Score each candidate
      for (const entry of candidateEntries) {
        const confidence = this.calculateMatchConfidence(bankTx, entry);
        
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = entry;
          matchType = confidence >= 95 ? 'exact' : 'fuzzy';
        }
      }

      matches.push({
        bankTransaction: bankTx,
        glEntry: bestMatch,
        confidence: bestConfidence,
        matchType,
      });
    }

    return matches;
  }

  /**
   * Calculate match confidence between bank transaction and GL entry
   */
  private calculateMatchConfidence(
    bankTx: BankTransaction,
    entry: GLEntry
  ): number {
    let score = 0;

    // Date matching (40 points max)
    const daysDiff = Math.abs(
      (entry.date.getTime() - bankTx.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff === 0) score += 40;
    else if (daysDiff === 1) score += 30;
    else if (daysDiff === 2) score += 20;

    // Amount matching (40 points max)
    const amountDiff = Math.abs(entry.amount - bankTx.amount);
    const amountPercent = (amountDiff / Math.abs(bankTx.amount)) * 100;
    if (amountPercent === 0) score += 40;
    else if (amountPercent < 0.1) score += 35;
    else if (amountPercent < 0.5) score += 30;
    else if (amountPercent < 1) score += 20;

    // Description matching (20 points max)
    const descScore = this.compareDescriptions(
      bankTx.description,
      entry.description
    );
    score += descScore * 20;

    return score;
  }

  /**
   * Compare descriptions using keyword matching
   */
  private compareDescriptions(
    bankDesc: string,
    glDesc: string
  ): number {
    const bankWords = bankDesc.toLowerCase().split(/\s+/);
    const glWords = glDesc.toLowerCase().split(/\s+/);

    // Extract meaningful keywords (ignore common words)
    const commonWords = ['the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at'];
    const bankKeywords = bankWords.filter(w => w.length > 2 && !commonWords.includes(w));
    const glKeywords = glWords.filter(w => w.length > 2 && !commonWords.includes(w));

    if (bankKeywords.length === 0 || glKeywords.length === 0) return 0;

    // Count matching keywords
    const matches = bankKeywords.filter(keyword =>
      glKeywords.some(glKeyword => glKeyword.includes(keyword) || keyword.includes(glKeyword))
    ).length;

    return matches / Math.max(bankKeywords.length, glKeywords.length);
  }

  /**
   * Reconcile matched transactions
   */
  async reconcileTransactions(
    matches: ReconciliationMatch[]
  ): Promise<ReconciliationSummary> {
    const glEntries = this.glDataService.getEntries();
    const newEntries: GLEntry[] = [];
    let entriesReconciled = 0;
    let matchedAmount = 0;
    let unmatchedAmount = 0;

    for (const match of matches) {
      if (match.glEntry && match.confidence >= 70) {
        // Update existing entry as reconciled
        const glEntry = match.glEntry; // Store in local variable for type safety
        const index = glEntries.findIndex(
          e => e.date === glEntry.date && 
               e.description === glEntry.description &&
               e.amount === glEntry.amount
        );
        
        if (index !== -1) {
          glEntries[index].isReconciled = true;
          glEntries[index].isActual = true;  // Mark as actual bank transaction
          entriesReconciled++;
          matchedAmount += Math.abs(match.bankTransaction.amount);
        }
      } else {
        // Create new entry for unmatched transaction
        const newEntry: GLEntry = {
          date: match.bankTransaction.date,
          description: match.bankTransaction.description,
          amount: match.bankTransaction.amount,
          category: match.bankTransaction.category, // Category must be in CSV
          accountType: match.bankTransaction.amount > 0 ? 'Revenue' : 'Expense',
          isProjection: false,
          isReconciled: true,
          isActual: true,  // Mark as actual bank transaction
        };
        
        newEntries.push(newEntry);
        unmatchedAmount += Math.abs(match.bankTransaction.amount);
      }
    }

    // Add new entries to GL
    if (newEntries.length > 0) {
      this.glDataService.addEntries(newEntries);
    }

    // Update existing entries
    if (entriesReconciled > 0) {
      this.glDataService.setEntries(glEntries);
    }

    // Calculate summary
    const totalAmount = matches.reduce(
      (sum, m) => sum + Math.abs(m.bankTransaction.amount),
      0
    );

    const lastReconciledDate = matches.length > 0
      ? matches.reduce((latest, m) => 
          m.bankTransaction.date > latest ? m.bankTransaction.date : latest,
          matches[0].bankTransaction.date
        )
      : new Date();

    return {
      totalTransactions: matches.length,
      matchedTransactions: matches.filter(m => m.matchType !== 'unmatched').length,
      unmatchedTransactions: matches.filter(m => m.matchType === 'unmatched').length,
      totalAmount,
      matchedAmount,
      unmatchedAmount,
      newEntriesCreated: newEntries.length,
      entriesReconciled,
      lastReconciledDate,
      matches,
    };
  }


  /**
   * Get reconciliation status
   */
  async getReconciliationStatus(): Promise<{
    lastReconciledDate: Date | null;
    totalEntries: number;
    reconciledEntries: number;
    unreconciledEntries: number;
    reconciliationRate: number;
  }> {
    const entries = this.glDataService.getEntries();
    const reconciledEntries = entries.filter(e => e.isReconciled);
    const unreconciledEntries = entries.filter(e => !e.isReconciled);

    // Find the latest reconciled date
    const lastReconciledDate = reconciledEntries.length > 0
      ? reconciledEntries.reduce((latest, entry) =>
          entry.date > latest ? entry.date : latest,
          reconciledEntries[0].date
        )
      : null;

    return {
      lastReconciledDate,
      totalEntries: entries.length,
      reconciledEntries: reconciledEntries.length,
      unreconciledEntries: unreconciledEntries.length,
      reconciliationRate: entries.length > 0
        ? (reconciledEntries.length / entries.length) * 100
        : 0,
    };
  }

  /**
   * Process bank statement and update cutoff date
   * This is the main entry point for bank statement uploads
   */
  async processBankStatement(
    csvContent: string,
    fileName: string
  ): Promise<ReconciliationSummary> {
    // Parse the CSV
    const transactions = this.parseCSV(csvContent);
    
    if (transactions.length === 0) {
      throw new Error('No transactions found in the CSV file');
    }

    // Find the latest transaction date (this will be our cutoff)
    const latestDate = transactions.reduce((latest, tx) => 
      tx.date > latest ? tx.date : latest,
      transactions[0].date
    );

    // Calculate total amount
    const totalAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    // Update the cutoff date in the database
    await this.cutoffDateService.updateCutoffDate(
      latestDate,
      fileName,
      transactions.length,
      totalAmount
    );

    // Match and reconcile transactions
    const matches = await this.matchTransactions(transactions);
    const summary = await this.reconcileTransactions(matches);

    return summary;
  }
}

export default BankReconciliationService;
export type { BankTransaction, ReconciliationMatch, ReconciliationSummary };