// src/lib/reporting/ReportingEngine.ts

import { GeneralLedger } from '../engine/GeneralLedger';
import { UserInputs, FinancialStatements, MonthlySummary, Transaction } from '@/types/v4/financial';

export class ReportingEngine {
  private generalLedger: GeneralLedger;
  private userInputs: UserInputs;
  private startDate: Date;
  
  constructor(generalLedger: GeneralLedger, userInputs: UserInputs, startDate: Date) {
    this.generalLedger = generalLedger;
    this.userInputs = userInputs;
    this.startDate = startDate;
  }
  
  /**
   * Generate complete financial statements
   */
  generateFinancialStatements(): FinancialStatements {
    const monthlySummaries = this.generateMonthlySummaries();
    const yearlyPnL = this.generateYearlyPnL(monthlySummaries);
    const finalBalanceSheet = this.generateFinalBalanceSheet();
    const allTransactions = this.generalLedger.getTransactions();
    
    return {
      monthlySummaries,
      transactions: allTransactions,
      yearlyPnL,
      balanceSheet: finalBalanceSheet
    };
  }
  
  /**
   * Generate monthly summaries for all 60 months
   */
  private generateMonthlySummaries(): MonthlySummary[] {
    const summaries: MonthlySummary[] = [];
    
    for (let month = 1; month <= 60; month++) {
      const currentDate = new Date(this.startDate);
      currentDate.setMonth(currentDate.getMonth() + month - 1);
      
      const summary = this.generateMonthSummary(month, currentDate);
      summaries.push(summary);
    }
    
    return summaries;
  }
  
  /**
   * Generate summary for a single month
   */
  private generateMonthSummary(monthNumber: number, monthDate: Date): MonthlySummary {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    
    // Get P&L data for the month
    const pnl = this.generalLedger.getMonthlyPnL(year, month);
    
    // Get month-end balances
    const monthEnd = new Date(year, month, 0); // Last day of month
    
    const endingCash = this.generalLedger.getAccountBalance('Cash', monthEnd);
    const endingInventory = this.generalLedger.getAccountBalance('Inventory', monthEnd);
    const accountsReceivable = this.generalLedger.getAccountBalance('AccountsReceivable', monthEnd);
    
    // Calculate total assets
    const totalAssets = endingCash + endingInventory + accountsReceivable;
    
    // Get liabilities
    const payrollTaxPayable = this.generalLedger.getAccountBalance('PayrollTaxPayable', monthEnd);
    const totalLiabilities = payrollTaxPayable;
    
    // Calculate equity (Assets - Liabilities)
    const equity = totalAssets - totalLiabilities;
    
    // Get inventory value in dollars
    const inventoryTransactions = this.generalLedger.getTransactions({
      endDate: monthEnd,
      account: 'Inventory'
    });
    
    // Inventory value is sum of debits minus credits
    const inventoryValue = inventoryTransactions.reduce(
      (value, t) => value + t.debit - t.credit,
      0
    );
    
    return {
      month: monthNumber,
      date: monthDate.toISOString().split('T')[0],
      revenue: pnl.revenue,
      cogs: pnl.cogs,
      grossProfit: pnl.revenue - pnl.cogs,
      operatingExpenses: pnl.operatingExpenses,
      netIncome: pnl.netIncome,
      endingCash,
      endingInventory, // Units on hand (not used in this simplified version)
      inventoryValue,
      accountsReceivable,
      totalAssets,
      totalLiabilities,
      equity
    };
  }
  
  /**
   * Generate yearly P&L summaries
   */
  private generateYearlyPnL(monthlySummaries: MonthlySummary[]): FinancialStatements['yearlyPnL'] {
    const yearlyData: FinancialStatements['yearlyPnL'] = [];
    
    // Group by year (5 years total)
    for (let year = 1; year <= 5; year++) {
      const startMonth = (year - 1) * 12 + 1;
      const endMonth = year * 12;
      
      const yearSummaries = monthlySummaries.filter(
        s => s.month >= startMonth && s.month <= endMonth
      );
      
      const yearTotal = yearSummaries.reduce((acc, month) => ({
        revenue: acc.revenue + month.revenue,
        cogs: acc.cogs + month.cogs,
        grossProfit: acc.grossProfit + month.grossProfit,
        operatingExpenses: acc.operatingExpenses + month.operatingExpenses,
        netIncome: acc.netIncome + month.netIncome
      }), {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        netIncome: 0
      });
      
      yearlyData.push({
        year,
        ...yearTotal
      });
    }
    
    return yearlyData;
  }
  
  /**
   * Generate final balance sheet (end of Year 5)
   */
  private generateFinalBalanceSheet(): FinancialStatements['balanceSheet'] {
    const finalDate = new Date(this.startDate);
    finalDate.setMonth(finalDate.getMonth() + 60); // End of month 60
    
    // Get final account balances
    const cash = this.generalLedger.getAccountBalance('Cash', finalDate);
    const accountsReceivable = this.generalLedger.getAccountBalance('AccountsReceivable', finalDate);
    const inventory = this.generalLedger.getAccountBalance('Inventory', finalDate);
    const payrollTaxPayable = this.generalLedger.getAccountBalance('PayrollTaxPayable', finalDate);
    
    // Calculate retained earnings
    // This is opening retained earnings + all net income over 5 years
    const allTransactions = this.generalLedger.getTransactions({ endDate: finalDate });
    
    const totalRevenue = allTransactions
      .filter(t => t.account === 'SalesRevenue')
      .reduce((sum, t) => sum + t.credit - t.debit, 0);
      
    const totalExpenses = allTransactions
      .filter(t => t.account === 'COGS' || t.account === 'OpEx')
      .reduce((sum, t) => sum + t.debit - t.credit, 0);
      
    const netIncome = totalRevenue - totalExpenses;
    const retainedEarnings = this.userInputs.openingRetainedEarnings + netIncome;
    
    // Calculate totals
    const totalAssets = cash + accountsReceivable + inventory;
    const totalLiabilities = payrollTaxPayable;
    const totalEquity = retainedEarnings;
    
    return {
      assets: {
        cash,
        accountsReceivable,
        inventory,
        totalAssets
      },
      liabilities: {
        payrollTaxPayable,
        totalLiabilities
      },
      equity: {
        retainedEarnings,
        totalEquity
      }
    };
  }
  
  /**
   * Generate cash flow statement data
   */
  generateCashFlowStatement(): {
    month: number;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    netCashFlow: number;
    endingCash: number;
  }[] {
    const cashFlowData = [];
    let previousCash = this.userInputs.openingCash;
    
    for (let month = 1; month <= 60; month++) {
      const currentDate = new Date(this.startDate);
      currentDate.setMonth(currentDate.getMonth() + month - 1);
      
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      // Get all cash transactions for the month
      const cashTransactions = this.generalLedger.getTransactions({
        startDate: monthStart,
        endDate: monthEnd,
        account: 'Cash'
      });
      
      // Categorize cash flows
      let operatingCashFlow = 0;
      let investingCashFlow = 0;
      let financingCashFlow = 0;
      
      cashTransactions.forEach(t => {
        const netCash = t.debit - t.credit; // Positive = cash in, Negative = cash out
        
        // Categorize based on transaction description/category
        if (t.category.includes('Sales') || t.category.includes('Operating') || 
            t.category.includes('Payment') || t.category.includes('Receipt')) {
          operatingCashFlow += netCash;
        } else if (t.category.includes('Investment')) {
          investingCashFlow += netCash;
        } else if (t.category.includes('Financing')) {
          financingCashFlow += netCash;
        } else {
          // Default to operating
          operatingCashFlow += netCash;
        }
      });
      
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      const endingCash = previousCash + netCashFlow;
      
      cashFlowData.push({
        month,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashFlow,
        endingCash
      });
      
      previousCash = endingCash;
    }
    
    return cashFlowData;
  }
  
  /**
   * Get detailed transaction report by category
   */
  getTransactionsByCategory(category: string, startMonth?: number, endMonth?: number): Transaction[] {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (startMonth) {
      startDate = new Date(this.startDate);
      startDate.setMonth(startDate.getMonth() + startMonth - 1);
    }
    
    if (endMonth) {
      endDate = new Date(this.startDate);
      endDate.setMonth(endDate.getMonth() + endMonth);
      endDate.setDate(0); // Last day of previous month
    }
    
    return this.generalLedger.getTransactions({
      category,
      startDate,
      endDate
    });
  }
}