// src/lib/engine/GeneralLedger.ts

import { Transaction } from '@/types/v4/financial';
import SystemConfigService from '@/services/database/SystemConfigService';
import { validateDateFormat } from '@/config/validator';

export class GeneralLedger {
  private transactions: Transaction[];
  private configService: SystemConfigService;
  private accountCodes: any = {};
  
  constructor() {
    this.transactions = [];
    this.configService = SystemConfigService.getInstance();
    this.loadAccountCodes();
  }
  
  private async loadAccountCodes() {
    try {
      this.accountCodes = await this.configService.getGLAccountCodes();
    } catch (error) {
      console.error('Failed to load GL account codes:', error);
      // Continue with empty account codes - validation will be skipped
    }
  }
  
  /**
   * Add a single transaction to the ledger
   */
  addTransaction(transaction: Transaction): void {
    // Validate account code exists in configuration if account codes are loaded
    if (Object.keys(this.accountCodes).length > 0) {
      const validAccountCodes = Object.values(this.accountCodes).map((acc: any) => acc.code);
      const validAccountNames = Object.values(this.accountCodes).map((acc: any) => acc.name);
      
      // Check if the account field matches either a code or name
      if (!validAccountCodes.includes(transaction.account) && !validAccountNames.includes(transaction.account)) {
        throw new Error(`Invalid account code or name: ${transaction.account}. Must be one of the configured account codes or names.`);
      }
    }
    
    // Validate date format if date is provided as string
    if (typeof transaction.date === 'string') {
      if (!validateDateFormat(transaction.date)) {
        throw new Error(`Invalid date format: ${transaction.date}. Date must be in ISO format (YYYY-MM-DD).`);
      }
    }
    
    // In double-entry bookkeeping, each transaction affects one account
    // with either a debit OR a credit, not both
    // The balance is maintained across multiple related transactions
    if (transaction.debit > 0 && transaction.credit > 0) {
      throw new Error(`Transaction cannot have both debit and credit: Debit (${transaction.debit}), Credit (${transaction.credit})`);
    }
    
    if (transaction.debit === 0 && transaction.credit === 0) {
      throw new Error(`Transaction must have either a debit or credit amount`);
    }
    
    // Validate amounts are non-negative
    if (transaction.debit < 0 || transaction.credit < 0) {
      throw new Error(`Transaction amounts cannot be negative. Debit: ${transaction.debit}, Credit: ${transaction.credit}`);
    }
    
    this.transactions.push(transaction);
  }
  
  /**
   * Add multiple transactions (for rules that generate multiple entries)
   */
  addTransactions(transactions: Transaction[]): void {
    // Validate that the batch balances
    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(`Batch imbalance: Total Debits (${totalDebits}) != Total Credits (${totalCredits})`);
    }
    
    transactions.forEach(t => this.transactions.push(t));
  }
  
  /**
   * Get all transactions, optionally filtered
   */
  getTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    account?: string;
    category?: string;
    ruleSource?: string;
  }): Transaction[] {
    let result = [...this.transactions];
    
    if (filters) {
      if (filters.startDate) {
        result = result.filter(t => t.date >= filters.startDate!);
      }
      if (filters.endDate) {
        result = result.filter(t => t.date <= filters.endDate!);
      }
      if (filters.account) {
        result = result.filter(t => t.account === filters.account);
      }
      if (filters.category) {
        result = result.filter(t => t.category === filters.category);
      }
      if (filters.ruleSource) {
        result = result.filter(t => t.ruleSource === filters.ruleSource);
      }
    }
    
    // Sort by date
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  /**
   * Get account balance at a specific date
   */
  getAccountBalance(account: string, asOfDate: Date): number {
    const relevantTransactions = this.transactions.filter(
      t => t.account === account && t.date <= asOfDate
    );
    
    // Calculate net balance (debits - credits)
    const debits = relevantTransactions.reduce((sum, t) => sum + t.debit, 0);
    const credits = relevantTransactions.reduce((sum, t) => sum + t.credit, 0);
    
    // For asset accounts (Cash, AR, Inventory), debit increases balance
    // For liability/equity accounts, credit increases balance
    // For revenue accounts, credit increases balance
    // For expense accounts, debit increases balance
    const assetAccounts = ['Cash', 'AccountsReceivable', 'Inventory'];
    const isAssetAccount = assetAccounts.includes(account);
    
    return isAssetAccount ? debits - credits : credits - debits;
  }
  
  /**
   * Get P&L summary for a specific month
   */
  getMonthlyPnL(year: number, month: number): {
    revenue: number;
    cogs: number;
    operatingExpenses: number;
    netIncome: number;
  } {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    const monthTransactions = this.transactions.filter(
      t => t.date >= startDate && t.date <= endDate
    );
    
    const revenue = monthTransactions
      .filter(t => t.account === 'SalesRevenue')
      .reduce((sum, t) => sum + t.credit - t.debit, 0);
      
    const cogs = monthTransactions
      .filter(t => t.account === 'COGS')
      .reduce((sum, t) => sum + t.debit - t.credit, 0);
      
    const operatingExpenses = monthTransactions
      .filter(t => t.account === 'OpEx')
      .reduce((sum, t) => sum + t.debit - t.credit, 0);
    
    const netIncome = revenue - cogs - operatingExpenses;
    
    return { revenue, cogs, operatingExpenses, netIncome };
  }
  
  /**
   * Clear all transactions (useful for recalculations)
   */
  clear(): void {
    this.transactions = [];
  }
  
  /**
   * Get total number of transactions
   */
  getTransactionCount(): number {
    return this.transactions.length;
  }
  
  /**
   * Export transactions for debugging/analysis
   */
  exportToCSV(): string {
    const headers = ['Date', 'Description', 'Category', 'Account', 'Debit', 'Credit', 'Rule Source'];
    const rows = this.transactions.map(t => [
      t.date.toISOString().split('T')[0],
      t.description,
      t.category,
      t.account,
      t.debit.toFixed(2),
      t.credit.toFixed(2),
      t.ruleSource
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\\n');
  }

  /**
   * Validate that the ledger is balanced
   */
  validateBalance(): { isBalanced: boolean; totalDebits: number; totalCredits: number; difference: number } {
    const totalDebits = this.transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = this.transactions.reduce((sum, t) => sum + t.credit, 0);
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01; // Allow for minor rounding differences
    
    return {
      isBalanced,
      totalDebits,
      totalCredits,
      difference
    };
  }

  /**
   * Get imbalance analysis by rule source
   */
  getImbalanceByRuleSource(): Record<string, { debits: number; credits: number; difference: number }> {
    const byRuleSource: Record<string, { debits: number; credits: number }> = {};
    
    this.transactions.forEach(t => {
      if (!byRuleSource[t.ruleSource]) {
        byRuleSource[t.ruleSource] = { debits: 0, credits: 0 };
      }
      byRuleSource[t.ruleSource].debits += t.debit;
      byRuleSource[t.ruleSource].credits += t.credit;
    });
    
    const result: Record<string, { debits: number; credits: number; difference: number }> = {};
    Object.entries(byRuleSource).forEach(([source, data]) => {
      result[source] = {
        debits: data.debits,
        credits: data.credits,
        difference: data.debits - data.credits
      };
    });
    
    return result;
  }
}