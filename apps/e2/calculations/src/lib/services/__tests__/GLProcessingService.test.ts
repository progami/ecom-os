// @ts-nocheck
import { GLProcessingService } from '../GLProcessingService';
import { RevenueData, ExpenseData, FreightData } from '../GLProcessingService';

describe('GLProcessingService - Double Entry Balance', () => {
  it('should maintain balanced double-entry bookkeeping', () => {
    // Test data
    const revenueData: RevenueData = {
      '2025-01': {
        'TS-007': 10,
        'TS-009': 5
      },
      '2025-02': {
        'TS-007': 12,
        'TS-009': 6
      },
      '2025-03': {
        'TS-007': 15,
        'TS-009': 8
      }
    };

    const expenseData: ExpenseData = {
      setup: {
        payroll: {
          'CEO': 5000,
          'Developer': 4000
        },
        rent: 2000,
        advertising: 1000,
        software: {
          'AWS': 300,
          'Other': 200
        },
        insurance: 500
      },
      inventory: [
        {
          yearMonth: '2025-01',
          amount: 10000,
          paymentSchedule: [
            { percentage: 30, monthsDelay: 0 },
            { percentage: 70, monthsDelay: 2 }
          ]
        }
      ]
    };

    const freightData: FreightData = {
      containerType: '40ft',
      totalFreightCost: 3000,
      containerCBM: 67
    };

    // Create processor with initial cash and retained earnings
    const processor = new GLProcessingService(50000, -5000);

    // Process transactions
    const result = processor.processMultiYearPlan(
      revenueData,
      expenseData,
      freightData,
      2025,
      2025
    );

    // Verify balance
    const balanceCheck = result.ledger.validateBalance();
    
    // Log details if not balanced
    if (!balanceCheck.isBalanced) {
      console.log('Total Debits:', balanceCheck.totalDebits);
      console.log('Total Credits:', balanceCheck.totalCredits);
      console.log('Difference:', balanceCheck.difference);
      
      const imbalanceBySource = result.ledger.getImbalanceByRuleSource();
      console.log('Imbalance by source:');
      Object.entries(imbalanceBySource).forEach(([source, data]) => {
        if (Math.abs(data.difference) > 0.01) {
          console.log(`  ${source}: ${data.difference} (D: ${data.debits}, C: ${data.credits})`);
        }
      });
    }

    // Assert the ledger is balanced
    expect(balanceCheck.isBalanced).toBe(true);
    expect(balanceCheck.difference).toBeLessThan(0.01);
  });

  it('should properly handle payroll tax payments quarterly', () => {
    const expenseData: ExpenseData = {
      setup: {
        payroll: {
          'Employee': 10000
        },
        rent: 0,
        advertising: 0,
        software: {},
        insurance: 0
      },
      inventory: []
    };

    const processor = new GLProcessingService(100000);
    const result = processor.processMultiYearPlan(
      {},
      expenseData,
      { containerType: '40ft', totalFreightCost: 0, containerCBM: 0 },
      2025,
      2025
    );

    // Get payroll tax transactions
    const payrollTaxTransactions = result.transactions.filter(
      t => t.description.includes('Payroll Tax')
    );

    // Should have monthly accruals and quarterly payments
    const accruals = payrollTaxTransactions.filter(t => t.account === 'Payroll Tax Payable' && t.credit > 0);
    const payments = payrollTaxTransactions.filter(t => t.account === 'Payroll Tax Payable' && t.debit > 0);

    expect(accruals.length).toBe(12); // Monthly accruals
    expect(payments.length).toBe(4); // Quarterly payments

    // Verify balance
    const balanceCheck = result.ledger.validateBalance();
    expect(balanceCheck.isBalanced).toBe(true);
  });

  it('should properly record inventory purchases with accounts payable', () => {
    const expenseData: ExpenseData = {
      setup: {
        payroll: {},
        rent: 0,
        advertising: 0,
        software: {},
        insurance: 0
      },
      inventory: [
        {
          yearMonth: '2025-01',
          amount: 20000,
          paymentSchedule: [
            { percentage: 30, monthsDelay: 0 },
            { percentage: 70, monthsDelay: 2 }
          ]
        }
      ]
    };

    const processor = new GLProcessingService(100000);
    const result = processor.processMultiYearPlan(
      {},
      expenseData,
      { containerType: '40ft', totalFreightCost: 0, containerCBM: 0 },
      2025,
      2025
    );

    // Check inventory purchase transactions
    const inventoryTransactions = result.transactions.filter(
      t => t.category === 'Inventory Purchase'
    );

    // Should have initial purchase order and payment transactions
    const purchaseOrders = inventoryTransactions.filter(
      t => t.description === 'Inventory Purchase Order'
    );
    const payments = inventoryTransactions.filter(
      t => t.description.includes('Inventory Payment')
    );

    expect(purchaseOrders.length).toBe(2); // Debit Inventory, Credit AP
    expect(payments.length).toBe(2); // One payment schedule with 30% immediate, one with 70% after 2 months

    // Verify balance
    const balanceCheck = result.ledger.validateBalance();
    expect(balanceCheck.isBalanced).toBe(true);
  });

  it('should handle opening retained earnings correctly', () => {
    // Test with negative retained earnings
    const processor1 = new GLProcessingService(50000, -10000);
    const result1 = processor1.processMultiYearPlan(
      {},
      { setup: { payroll: {}, rent: 0, advertising: 0, software: {}, insurance: 0 }, inventory: [] },
      { containerType: '40ft', totalFreightCost: 0, containerCBM: 0 },
      2025,
      2025
    );

    const balance1 = result1.ledger.validateBalance();
    expect(balance1.isBalanced).toBe(true);

    // Test with positive retained earnings
    const processor2 = new GLProcessingService(50000, 15000);
    const result2 = processor2.processMultiYearPlan(
      {},
      { setup: { payroll: {}, rent: 0, advertising: 0, software: {}, insurance: 0 }, inventory: [] },
      { containerType: '40ft', totalFreightCost: 0, containerCBM: 0 },
      2025,
      2025
    );

    const balance2 = result2.ledger.validateBalance();
    expect(balance2.isBalanced).toBe(true);
  });
});