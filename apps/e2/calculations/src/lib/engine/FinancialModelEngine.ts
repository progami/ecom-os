// src/lib/engine/FinancialModelEngine.ts

import { UserInputs, Transaction, FinancialStatements } from '@/types/v4/financial';
import { GeneralLedger } from './GeneralLedger';
import { SalesRule } from '../rules/SalesRule';
import { OpExRule } from '../rules/OpExRule';
import { InventoryRule } from '../rules/InventoryRule';
import { BalanceSheetRule } from '../rules/BalanceSheetRule';
import { ReportingEngine } from '../reporting/ReportingEngine';

export class FinancialModelEngine {
  private userInputs: UserInputs;
  private generalLedger: GeneralLedger;
  private salesRule: SalesRule;
  private opExRule: OpExRule;
  private inventoryRule: InventoryRule;
  private balanceSheetRule: BalanceSheetRule;
  private startDate: Date;
  
  constructor(userInputs: UserInputs) {
    this.userInputs = userInputs;
    this.generalLedger = new GeneralLedger();
    
    // Set start date to beginning of current month
    const now = new Date();
    this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Initialize rules
    this.salesRule = new SalesRule(
      userInputs.salesForecast,
      userInputs.productDetails,
      this.startDate
    );
    
    this.opExRule = new OpExRule(userInputs.operatingExpenses);
    
    this.inventoryRule = new InventoryRule(
      userInputs.inventoryRules,
      userInputs.productDetails
    );
    
    this.balanceSheetRule = new BalanceSheetRule();
  }
  
  /**
   * Run the complete 60-month forecast
   */
  runForecast(): FinancialStatements {
    // Clear any existing transactions
    this.generalLedger.clear();
    
    // Initialize opening balance sheet
    this.initializeOpeningBalances();
    
    // Run simulation for 60 months
    for (let month = 1; month <= 60; month++) {
      this.processMonth(month);
    }
    
    // Generate reports
    const reportingEngine = new ReportingEngine(
      this.generalLedger,
      this.userInputs,
      this.startDate
    );
    
    return reportingEngine.generateFinancialStatements();
  }
  
  /**
   * Initialize opening balance sheet transactions
   */
  private initializeOpeningBalances(): void {
    const openingDate = new Date(this.startDate);
    openingDate.setDate(openingDate.getDate() - 1); // Day before start
    
    // Opening balance sheet must balance: Assets = Liabilities + Equity
    // We have: Cash (asset) = Retained Earnings + Additional Equity
    
    if (this.userInputs.openingCash === 0 && this.userInputs.openingRetainedEarnings === 0) {
      return; // No opening balances to record
    }
    
    const openingTransactions: Transaction[] = [];
    
    // Record opening cash (debit to increase asset)
    openingTransactions.push({
      date: openingDate,
      description: 'Opening Cash Balance',
      category: 'Opening Balance',
      account: 'Cash',
      debit: this.userInputs.openingCash,
      credit: 0,
      ruleSource: 'Opening'
    });
    
    // Record opening retained earnings
    if (this.userInputs.openingRetainedEarnings !== 0) {
      openingTransactions.push({
        date: openingDate,
        description: 'Opening Retained Earnings',
        category: 'Opening Balance',
        account: 'Equity',
        debit: this.userInputs.openingRetainedEarnings < 0 ? Math.abs(this.userInputs.openingRetainedEarnings) : 0,
        credit: this.userInputs.openingRetainedEarnings > 0 ? this.userInputs.openingRetainedEarnings : 0,
        ruleSource: 'Opening'
      });
    }
    
    // Calculate balancing entry needed
    const cashDebit = this.userInputs.openingCash;
    const retainedEarningsNet = this.userInputs.openingRetainedEarnings;
    const balancingAmount = cashDebit - retainedEarningsNet;
    
    // Record balancing equity entry
    if (balancingAmount !== 0) {
      openingTransactions.push({
        date: openingDate,
        description: 'Opening Contributed Capital',
        category: 'Opening Balance',
        account: 'Equity',
        debit: 0,
        credit: balancingAmount,
        ruleSource: 'Opening'
      });
    }
    
    // Add all opening balance transactions as a batch
    this.generalLedger.addTransactions(openingTransactions);
  }
  
  /**
   * Process all transactions for a single month
   */
  private processMonth(monthNumber: number): void {
    // Calculate the actual date for this month
    const currentDate = new Date(this.startDate);
    currentDate.setMonth(currentDate.getMonth() + monthNumber - 1);
    
    // 1. Process Sales transactions
    const salesTransactions = this.salesRule.generateTransactions(monthNumber, currentDate);
    if (salesTransactions.length > 0) {
      this.generalLedger.addTransactions(salesTransactions);
    }
    
    // 1b. Process Settlement transactions (from sales 14 days ago)
    const settlementTransactions = this.salesRule.generateSettlementTransactions(monthNumber, currentDate);
    if (settlementTransactions.length > 0) {
      this.generalLedger.addTransactions(settlementTransactions);
    }
    
    // 2. Process Operating Expense transactions
    const opExTransactions = this.opExRule.generateTransactions(monthNumber, currentDate);
    if (opExTransactions.length > 0) {
      this.generalLedger.addTransactions(opExTransactions);
    }
    
    // 3. Process Inventory transactions
    const inventoryTransactions = this.inventoryRule.generateTransactions(
      monthNumber,
      currentDate,
      this.salesRule
    );
    if (inventoryTransactions.length > 0) {
      this.generalLedger.addTransactions(inventoryTransactions);
    }
    
    // 4. Update balance sheet at end of month
    this.balanceSheetRule.processMonth(this.generalLedger, currentDate);
  }
  
  /**
   * Get the general ledger (for debugging/analysis)
   */
  getGeneralLedger(): GeneralLedger {
    return this.generalLedger;
  }
  
  /**
   * Get the balance sheet rule (for balance sheet reports)
   */
  getBalanceSheetRule(): BalanceSheetRule {
    return this.balanceSheetRule;
  }
  
  /**
   * Export all transactions to CSV
   */
  exportTransactionsToCSV(): string {
    return this.generalLedger.exportToCSV();
  }
  
  /**
   * Get a preview of transactions for a specific month
   */
  previewMonth(monthNumber: number): Transaction[] {
    const previewDate = new Date(this.startDate);
    previewDate.setMonth(previewDate.getMonth() + monthNumber - 1);
    
    const transactions: Transaction[] = [];
    
    // Get transactions from each rule
    transactions.push(...this.salesRule.generateTransactions(monthNumber, previewDate));
    transactions.push(...this.opExRule.generateTransactions(monthNumber, previewDate));
    transactions.push(...this.inventoryRule.generateTransactions(
      monthNumber,
      previewDate,
      this.salesRule
    ));
    
    return transactions;
  }
  
  /**
   * Validate user inputs before running forecast
   */
  validateInputs(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate sales forecast
    if (!this.userInputs.salesForecast || this.userInputs.salesForecast.length === 0) {
      errors.push('Sales forecast is required');
    }
    
    // Validate product details match SKUs in sales forecast
    const forecastSKUs = new Set(this.userInputs.salesForecast.map(s => s.sku));
    const productSKUs = new Set(this.userInputs.productDetails.map(p => p.sku));
    
    forecastSKUs.forEach(sku => {
      if (!productSKUs.has(sku)) {
        errors.push(`Product details missing for SKU: ${sku}`);
      }
    });
    
    // Validate operating expenses
    if (!this.userInputs.operatingExpenses || this.userInputs.operatingExpenses.length === 0) {
      errors.push('At least one operating expense is required');
    }
    
    // Validate inventory rules
    if (!this.userInputs.inventoryRules) {
      errors.push('Inventory rules are required');
    } else {
      if (this.userInputs.inventoryRules.targetMonthsOfSupply <= 0) {
        errors.push('Target months of supply must be greater than 0');
      }
      
      const totalPaymentPercentage = this.userInputs.inventoryRules.supplierPaymentTerms
        .reduce((sum, term) => sum + term.percentage, 0);
      
      if (Math.abs(totalPaymentPercentage - 100) > 0.01) {
        errors.push('Supplier payment terms must total 100%');
      }
    }
    
    // Validate global assumptions
    if (this.userInputs.taxRate < 0 || this.userInputs.taxRate > 1) {
      errors.push('Tax rate must be between 0 and 1');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}