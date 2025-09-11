// src/lib/rules/OpExRule.ts

import { Transaction, OperatingExpenseInput } from '@/types/v4/financial';
import { TAX_RATES } from '@/config/business-rules';

export class OpExRule {
  private expenses: OperatingExpenseInput[];
  
  constructor(operatingExpenses: OperatingExpenseInput[]) {
    this.expenses = operatingExpenses;
  }
  
  /**
   * Generate operating expense transactions for a specific month
   */
  generateTransactions(currentMonth: number, currentDate: Date): Transaction[] {
    const transactions: Transaction[] = [];
    
    this.expenses.forEach(expense => {
      // Check if expense is active in current month
      if (!this.isExpenseActive(expense, currentMonth)) return;
      
      const amount = this.calculateExpenseAmount(expense, currentMonth);
      if (amount === 0) return;
      
      // Generate transactions based on expense category
      if (expense.category === 'Payroll') {
        // Payroll requires special handling for taxes
        this.generatePayrollTransactions(expense, amount, currentDate, transactions);
      } else {
        // Standard expense transaction
        this.generateStandardExpenseTransaction(expense, amount, currentDate, transactions);
      }
    });
    
    return transactions;
  }
  
  /**
   * Check if an expense should be processed in the current month
   */
  private isExpenseActive(expense: OperatingExpenseInput, currentMonth: number): boolean {
    if (currentMonth < expense.startMonth) return false;
    
    switch (expense.frequency) {
      case 'Monthly':
        return true;
      case 'Annually':
        // Annual expenses occur on the anniversary of the start month
        return (currentMonth - expense.startMonth) % 12 === 0;
      case 'One-Time':
        return currentMonth === expense.startMonth;
      default:
        return false;
    }
  }
  
  /**
   * Calculate the expense amount for the current month
   */
  private calculateExpenseAmount(expense: OperatingExpenseInput, currentMonth: number): number {
    let baseAmount = expense.amount;
    
    // Apply promotional rate if applicable
    if (expense.promoRate && expense.promoDurationMonths) {
      const monthsSinceStart = currentMonth - expense.startMonth;
      if (monthsSinceStart < expense.promoDurationMonths) {
        baseAmount = baseAmount * expense.promoRate;
      }
    }
    
    return baseAmount;
  }
  
  /**
   * Generate standard expense transactions (non-payroll)
   */
  private generateStandardExpenseTransaction(
    expense: OperatingExpenseInput,
    amount: number,
    currentDate: Date,
    transactions: Transaction[]
  ): void {
    // Expense recognition
    transactions.push({
      date: new Date(currentDate),
      description: `${expense.name} - ${expense.frequency}`,
      category: expense.category,
      account: 'OpEx',
      debit: amount,
      credit: 0,
      ruleSource: 'OpExRule'
    });
    
    // Cash payment
    transactions.push({
      date: new Date(currentDate),
      description: `Payment for ${expense.name}`,
      category: 'Cash Payment',
      account: 'Cash',
      debit: 0,
      credit: amount,
      ruleSource: 'OpExRule'
    });
  }
  
  /**
   * Generate payroll transactions with tax withholding
   */
  private generatePayrollTransactions(
    expense: OperatingExpenseInput,
    grossAmount: number,
    currentDate: Date,
    transactions: Transaction[]
  ): void {
    const payrollTax = grossAmount * TAX_RATES.payrollTaxRate;
    const netPay = grossAmount - payrollTax;
    
    // 1. Salary expense
    transactions.push({
      date: new Date(currentDate),
      description: `${expense.name} - Gross Salary`,
      category: 'Payroll',
      account: 'OpEx',
      debit: grossAmount,
      credit: 0,
      ruleSource: 'OpExRule'
    });
    
    // 2. Employer payroll tax expense
    transactions.push({
      date: new Date(currentDate),
      description: `${expense.name} - Employer Payroll Tax`,
      category: 'Payroll Tax',
      account: 'OpEx',
      debit: payrollTax,
      credit: 0,
      ruleSource: 'OpExRule'
    });
    
    // 3. Net pay to employee (cash out)
    transactions.push({
      date: new Date(currentDate),
      description: `${expense.name} - Net Pay`,
      category: 'Cash Payment',
      account: 'Cash',
      debit: 0,
      credit: netPay,
      ruleSource: 'OpExRule'
    });
    
    // 4. Payroll tax liability (employee + employer portions)
    const totalPayrollTaxLiability = payrollTax * 2; // Employee + Employer portions
    transactions.push({
      date: new Date(currentDate),
      description: `${expense.name} - Payroll Tax Payable`,
      category: 'Payroll Tax Payable',
      account: 'PayrollTaxPayable',
      debit: 0,
      credit: totalPayrollTaxLiability,
      ruleSource: 'OpExRule'
    });
    
    // 5. Quarterly tax payment (every 3 months)
    if (currentDate.getMonth() % 3 === 0) {
      const taxPaymentDate = new Date(currentDate);
      taxPaymentDate.setDate(15); // Quarterly taxes due on 15th
      
      // Calculate accumulated tax liability (simplified - in reality would track actual liability)
      const quarterlyTaxPayment = totalPayrollTaxLiability * 3;
      
      // Pay accumulated payroll taxes
      transactions.push({
        date: taxPaymentDate,
        description: 'Quarterly Payroll Tax Payment',
        category: 'Tax Payment',
        account: 'Cash',
        debit: 0,
        credit: quarterlyTaxPayment,
        ruleSource: 'OpExRule'
      });
      
      // Clear payroll tax liability
      transactions.push({
        date: taxPaymentDate,
        description: 'Clear Payroll Tax Liability',
        category: 'Payroll Tax Payable',
        account: 'PayrollTaxPayable',
        debit: quarterlyTaxPayment,
        credit: 0,
        ruleSource: 'OpExRule'
      });
    }
  }
  
  /**
   * Get total monthly operating expenses (for reporting)
   */
  getTotalMonthlyExpenses(currentMonth: number): number {
    return this.expenses.reduce((total, expense) => {
      if (this.isExpenseActive(expense, currentMonth)) {
        const amount = this.calculateExpenseAmount(expense, currentMonth);
        // For payroll, include both salary and employer taxes
        if (expense.category === 'Payroll') {
          return total + amount + (amount * TAX_RATES.payrollTaxRate);
        }
        return total + amount;
      }
      return total;
    }, 0);
  }
  
  /**
   * Get expenses by category for a specific month
   */
  getExpensesByCategory(currentMonth: number): Map<string, number> {
    const categoryTotals = new Map<string, number>();
    
    this.expenses.forEach(expense => {
      if (this.isExpenseActive(expense, currentMonth)) {
        const amount = this.calculateExpenseAmount(expense, currentMonth);
        const current = categoryTotals.get(expense.category) || 0;
        
        if (expense.category === 'Payroll') {
          // Include employer taxes in payroll category
          categoryTotals.set(expense.category, current + amount + (amount * TAX_RATES.payrollTaxRate));
        } else {
          categoryTotals.set(expense.category, current + amount);
        }
      }
    });
    
    return categoryTotals;
  }
}