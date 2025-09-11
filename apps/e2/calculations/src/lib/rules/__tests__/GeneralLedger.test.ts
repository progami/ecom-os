// @ts-nocheck
// src/lib/rules/__tests__/GeneralLedger.test.ts

import { GeneralLedger } from '../../engine/GeneralLedger';
import { Transaction } from '@/types/v4/financial';

describe('GeneralLedger', () => {
  let ledger: GeneralLedger;
  
  beforeEach(() => {
    ledger = new GeneralLedger();
  });
  
  describe('addTransaction', () => {
    it('should add a balanced transaction', () => {
      const transaction: Transaction = {
        date: new Date('2024-01-01'),
        description: 'Test Transaction',
        category: 'Test',
        account: 'Cash',
        debit: 100,
        credit: 0,
        ruleSource: 'Test'
      };
      
      ledger.addTransaction(transaction);
      expect(ledger.getTransactionCount()).toBe(1);
    });
    
    it('should reject a transaction with both debit and credit', () => {
      const transaction: Transaction = {
        date: new Date('2024-01-01'),
        description: 'Invalid Transaction',
        category: 'Test',
        account: 'Cash',
        debit: 100,
        credit: 50,
        ruleSource: 'Test'
      };
      
      expect(() => ledger.addTransaction(transaction)).toThrow('Transaction cannot have both debit and credit');
    });
  });
  
  describe('addTransactions', () => {
    it('should add multiple balanced transactions', () => {
      const transactions: Transaction[] = [
        {
          date: new Date('2024-01-01'),
          description: 'Debit Entry',
          category: 'Test',
          account: 'Cash',
          debit: 100,
          credit: 0,
          ruleSource: 'Test'
        },
        {
          date: new Date('2024-01-01'),
          description: 'Credit Entry',
          category: 'Test',
          account: 'Revenue',
          debit: 0,
          credit: 100,
          ruleSource: 'Test'
        }
      ];
      
      ledger.addTransactions(transactions);
      expect(ledger.getTransactionCount()).toBe(2);
    });
    
    it('should reject batch with imbalanced totals', () => {
      const transactions: Transaction[] = [
        {
          date: new Date('2024-01-01'),
          description: 'Debit Entry',
          category: 'Test',
          account: 'Cash',
          debit: 100,
          credit: 0,
          ruleSource: 'Test'
        },
        {
          date: new Date('2024-01-01'),
          description: 'Credit Entry',
          category: 'Test',
          account: 'Revenue',
          debit: 0,
          credit: 50, // Imbalanced!
          ruleSource: 'Test'
        }
      ];
      
      expect(() => ledger.addTransactions(transactions)).toThrow('Batch imbalance');
    });
  });
  
  describe('getAccountBalance', () => {
    it('should calculate correct balance for asset accounts', () => {
      const transactions: Transaction[] = [
        {
          date: new Date('2024-01-01'),
          description: 'Opening Balance',
          category: 'Opening',
          account: 'Cash',
          debit: 10000,
          credit: 0,
          ruleSource: 'Opening'
        },
        {
          date: new Date('2024-01-01'),
          description: 'Opening Balance',
          category: 'Opening',
          account: 'Equity',
          debit: 0,
          credit: 10000,
          ruleSource: 'Opening'
        },
        {
          date: new Date('2024-01-15'),
          description: 'Payment',
          category: 'Payment',
          account: 'Cash',
          debit: 0,
          credit: 2000,
          ruleSource: 'OpEx'
        },
        {
          date: new Date('2024-01-15'),
          description: 'Payment',
          category: 'Payment',
          account: 'Expenses',
          debit: 2000,
          credit: 0,
          ruleSource: 'OpEx'
        }
      ];
      
      ledger.addTransactions(transactions);
      const balance = ledger.getAccountBalance('Cash', new Date('2024-02-01'));
      expect(balance).toBe(8000); // 10000 - 2000
    });
    
    it('should calculate correct balance for revenue accounts', () => {
      const transactions: Transaction[] = [
        {
          date: new Date('2024-01-01'),
          description: 'Sales',
          category: 'Sales',
          account: 'SalesRevenue',
          debit: 0,
          credit: 5000,
          ruleSource: 'Sales'
        },
        {
          date: new Date('2024-01-01'),
          description: 'Sales',
          category: 'Sales',
          account: 'Cash',
          debit: 5000,
          credit: 0,
          ruleSource: 'Sales'
        }
      ];
      
      ledger.addTransactions(transactions);
      const balance = ledger.getAccountBalance('SalesRevenue', new Date('2024-02-01'));
      expect(balance).toBe(5000); // Credits increase revenue
    });
  });
  
  describe('getMonthlyPnL', () => {
    it('should calculate correct monthly P&L', () => {
      const transactions: Transaction[] = [
        // Sales transaction
        {
          date: new Date('2024-01-15'),
          description: 'Sales',
          category: 'Sales',
          account: 'SalesRevenue',
          debit: 0,
          credit: 10000,
          ruleSource: 'Sales'
        },
        {
          date: new Date('2024-01-15'),
          description: 'Sales',
          category: 'Sales',
          account: 'Cash',
          debit: 10000,
          credit: 0,
          ruleSource: 'Sales'
        },
        // COGS transaction
        {
          date: new Date('2024-01-15'),
          description: 'COGS',
          category: 'COGS',
          account: 'COGS',
          debit: 4000,
          credit: 0,
          ruleSource: 'Sales'
        },
        {
          date: new Date('2024-01-15'),
          description: 'COGS',
          category: 'COGS',
          account: 'Inventory',
          debit: 0,
          credit: 4000,
          ruleSource: 'Sales'
        },
        // Rent transaction
        {
          date: new Date('2024-01-15'),
          description: 'Rent',
          category: 'Rent',
          account: 'OpEx',
          debit: 2000,
          credit: 0,
          ruleSource: 'OpEx'
        },
        {
          date: new Date('2024-01-15'),
          description: 'Rent',
          category: 'Rent',
          account: 'Cash',
          debit: 0,
          credit: 2000,
          ruleSource: 'OpEx'
        }
      ];
      
      ledger.addTransactions(transactions);
      const pnl = ledger.getMonthlyPnL(2024, 1);
      
      expect(pnl.revenue).toBe(10000);
      expect(pnl.cogs).toBe(4000);
      expect(pnl.operatingExpenses).toBe(2000);
      expect(pnl.netIncome).toBe(4000); // 10000 - 4000 - 2000
    });
  });
});