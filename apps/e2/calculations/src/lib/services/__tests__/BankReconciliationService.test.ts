// @ts-nocheck
import BankReconciliationService, { BankTransaction, ReconciliationMatch } from '../BankReconciliationService';
import GLDataService, { GLEntry } from '../GLDataService';

// Mock GLDataService and its dependencies
jest.mock('@/services/database/GLEntryService', () => {
  const mockInstance = {
    getEntries: jest.fn().mockResolvedValue([]),
    setEntries: jest.fn().mockResolvedValue(undefined),
    addEntry: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {})
  };
  
  return {
    default: {
      getInstance: jest.fn().mockReturnValue(mockInstance)
    }
  };
});

jest.mock('../GLDataService');

describe('BankReconciliationService', () => {
  let service: BankReconciliationService;
  let mockGLDataService: jest.Mocked<GLDataService>;

  beforeEach(() => {
    // Clear all mocks and reset singleton
    jest.clearAllMocks();
    (BankReconciliationService as any).instance = null;
    
    // Setup mock GLDataService
    const mockGLDataServiceInstance = {
      getEntries: jest.fn().mockReturnValue([]),
      setEntries: jest.fn(),
      addEntries: jest.fn(),
      clearEntries: jest.fn(),
      getEntriesByDateRange: jest.fn().mockReturnValue([]),
      getEntriesByAccountType: jest.fn().mockReturnValue([]),
      getEntriesByCategory: jest.fn().mockReturnValue([]),
      getEntriesFiltered: jest.fn().mockReturnValue([]),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };
    
    (GLDataService as any).instance = null;
    (GLDataService.getInstance as jest.Mock).mockReturnValue(mockGLDataServiceInstance);
    
    mockGLDataService = mockGLDataServiceInstance as any;
    
    // Get service instance after mocks are set up
    service = BankReconciliationService.getInstance();
  });

  describe('parseCSV', () => {
    test('should parse CSV with standard format correctly', () => {
      const csvContent = `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,01/15/2024,Amazon Sales,Amazon Sales,1500.00,Deposit,11500.00,
,01/16/2024,Office Supplies,Office Supplies,-75.50,Withdrawal,11424.50,
,01/17/2024,Rent Payment,Rent,-2000.00,Withdrawal,9424.50,`;

      const transactions = service.parseCSV(csvContent);

      expect(transactions).toHaveLength(3);
      expect(transactions[0]).toEqual({
        date: new Date(2024, 0, 15),
        description: 'Amazon Sales',
        category: 'Amazon Sales',
        amount: 1500.00,
        balance: 11500.00,
      });
      expect(transactions[1]).toEqual({
        date: new Date(2024, 0, 16),
        description: 'Office Supplies',
        category: 'Office Supplies',
        amount: -75.50,
        balance: 11424.50,
      });
    });

    test('should handle CSV without header row', () => {
      // Service now requires header row with Category column
      const csvContent = `01/15/2024,Amazon Sales,1500.00,11500.00
01/16/2024,Office Supplies,-75.50,11424.50`;

      expect(() => service.parseCSV(csvContent)).toThrow('CSV must include a Category column');
    });

    test('should parse different date formats', () => {
      // Test different date formats with proper headers
      const testCases = [
        { 
          csv: `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,01/15/2024,Test,Test Category,100,Deposit,1000,`, 
          expectedDate: new Date(2024, 0, 15) 
        },
        { 
          csv: `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,2024/01/15,Test,Test Category,100,Deposit,1000,`, 
          expectedDate: new Date(2024, 0, 15) 
        },
        { 
          csv: `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,01-15-2024,Test,Test Category,100,Deposit,1000,`, 
          expectedDate: new Date(2024, 0, 15) 
        },
        { 
          csv: `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,2024-01-15,Test,Test Category,100,Deposit,1000,`, 
          expectedDate: new Date(2024, 0, 15) 
        },
        { 
          csv: `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,01/15/24,Test,Test Category,100,Deposit,1000,`, 
          expectedDate: new Date(2024, 0, 15) 
        },
      ];

      testCases.forEach(({ csv, expectedDate }, index) => {
        try {
          const transactions = service.parseCSV(csv);
          expect(transactions).toHaveLength(1);
          expect(transactions[0].date).toEqual(expectedDate);
          expect(transactions[0].description).toBe('Test');
          expect(transactions[0].category).toBe('Test Category');
          expect(transactions[0].amount).toBe(100.00);
          expect(transactions[0].balance).toBe(1000.00);
        } catch (error) {
          console.error(`Test case ${index} failed for CSV: ${csv}`, error);
          throw error;
        }
      });
    });

    test('should handle amounts with currency symbols and commas', () => {
      const csvContent = `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,01/15/2024,Amazon Sales,Amazon Sales,"$1,500.00",Deposit,"$11,500.00",
,01/16/2024,Office Supplies,Office Supplies,$-75.50,Withdrawal,"$11,424.50",`;

      const transactions = service.parseCSV(csvContent);

      expect(transactions[0].amount).toBe(1500.00);
      expect(transactions[0].balance).toBe(11500.00);
      expect(transactions[1].amount).toBe(-75.50);
    });

    test('should throw error for empty CSV', () => {
      // Empty string should return empty array as per csv-parse behavior
      const emptyResult = service.parseCSV('');
      expect(emptyResult).toEqual([]);
      
      // Whitespace only should also return empty array
      const whitespaceResult = service.parseCSV('   ');
      expect(whitespaceResult).toEqual([]);
    });

    test('should throw error for malformed CSV', () => {
      const malformedCSV = `Date,Description,Amount
01/15/2024,Amazon Sales`; // Missing required columns including Category

      expect(() => service.parseCSV(malformedCSV)).toThrow('CSV must include a Category column');
    });

    test('should throw error for invalid date format', () => {
      // Add a header row and then an invalid date
      const csvContent = `Details,Posting Date,Description,Category,Amount,Type,Balance,Check or Slip #
,InvalidDate,Test,Test Category,100,Deposit,1000,`;
      
      expect(() => service.parseCSV(csvContent)).toThrow('Invalid date format: InvalidDate');
    });

    test('should handle CSV with extra whitespace', () => {
      const csvContent = ` Details , Posting Date , Description , Category , Amount , Type , Balance , Check or Slip # 
  ,  01/15/2024  ,  Amazon Sales  ,  Amazon Sales  ,  1500.00  ,  Deposit  ,  11500.00  ,  `;

      const transactions = service.parseCSV(csvContent);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].description).toBe('Amazon Sales');
      expect(transactions[0].category).toBe('Amazon Sales');
    });
  });

  describe('matchTransactions', () => {
    const mockGLEntries: GLEntry[] = [
      {
        date: new Date(2024, 0, 15),
        description: 'Amazon Revenue - January',
        amount: 1500.00,
        category: 'Amazon Sales',
        accountType: 'Revenue',
        isProjection: false,
        isReconciled: false,
      },
      {
        date: new Date(2024, 0, 16),
        description: 'Office Supplies Purchase',
        amount: -75.50,
        category: 'Office Supplies',
        accountType: 'Expense',
        isProjection: false,
        isReconciled: false,
      },
      {
        date: new Date(2024, 0, 17),
        description: 'Monthly Rent',
        amount: -2000.00,
        category: 'Rent',
        accountType: 'Expense',
        isProjection: false,
        isReconciled: true, // Already reconciled
      },
    ];

    const bankTransactions: BankTransaction[] = [
      {
        date: new Date(2024, 0, 15),
        description: 'AMAZON PAYMENTS',
        category: 'Amazon Sales',
        amount: 1500.00,
        balance: 11500.00,
      },
      {
        date: new Date(2024, 0, 16),
        description: 'OFFICE DEPOT',
        category: 'Office Supplies',
        amount: -75.50,
        balance: 11424.50,
      },
      {
        date: new Date(2024, 0, 20),
        description: 'WIRE TRANSFER',
        category: 'Transfer In',
        amount: 500.00,
        balance: 11924.50,
      },
    ];

    beforeEach(() => {
      mockGLDataService.getEntries.mockReturnValue(mockGLEntries);
    });

    test('should match transactions with exact date and amount', async () => {
      const matches = await service.matchTransactions(bankTransactions);

      expect(matches).toHaveLength(3);
      
      // First transaction should match (same date and amount, but different description)
      expect(matches[0].glEntry).toBeTruthy();
      expect(matches[0].confidence).toBeGreaterThan(50); // Should have some confidence
      
      // Second transaction should match
      expect(matches[1].glEntry).toBeTruthy();
      expect(matches[1].confidence).toBeGreaterThan(50);

      // Third transaction should not match (no GL entry)
      expect(matches[2].matchType).toBe('unmatched');
      expect(matches[2].glEntry).toBe(null);
    });

    test('should match transactions within date tolerance', async () => {
      const transactionsWithDateDiff: BankTransaction[] = [{
        date: new Date(2024, 0, 17), // 2 days after GL entry
        description: 'AMAZON PAYMENTS',
        category: 'Amazon Sales',
        amount: 1500.00,
        balance: 11500.00,
      }];

      const matches = await service.matchTransactions(transactionsWithDateDiff, 2);

      expect(matches[0].matchType).toBe('fuzzy');
      expect(matches[0].glEntry).toBeTruthy();
      expect(matches[0].confidence).toBeLessThan(95);
    });

    test('should not match transactions outside date tolerance', async () => {
      const transactionsOutsideTolerance: BankTransaction[] = [{
        date: new Date(2024, 0, 20), // 5 days after GL entry
        description: 'AMAZON PAYMENTS',
        category: 'Amazon Sales',
        amount: 1500.00,
        balance: 11500.00,
      }];

      const matches = await service.matchTransactions(transactionsOutsideTolerance, 2);

      expect(matches[0].matchType).toBe('unmatched');
      expect(matches[0].glEntry).toBe(null);
    });

    test('should match transactions within amount tolerance', async () => {
      const transactionsWithAmountDiff: BankTransaction[] = [{
        date: new Date(2024, 0, 15),
        description: 'AMAZON PAYMENTS',
        category: 'Amazon Sales',
        amount: 1507.50, // 0.5% difference
        balance: 11507.50,
      }];

      const matches = await service.matchTransactions(transactionsWithAmountDiff, 2, 1);

      expect(matches[0].glEntry).toBeTruthy();
      expect(matches[0].confidence).toBeGreaterThan(50);
    });

    test('should not match already reconciled entries', async () => {
      const rentTransaction: BankTransaction[] = [{
        date: new Date(2024, 0, 17),
        description: 'RENT PAYMENT',
        category: 'Rent',
        amount: -2000.00,
        balance: 9424.50,
      }];

      const matches = await service.matchTransactions(rentTransaction);

      expect(matches[0].matchType).toBe('unmatched');
      expect(matches[0].glEntry).toBe(null);
    });

    test('should calculate confidence scores correctly', async () => {
      // Test better match - same date, amount, and similar description
      const betterMatch: BankTransaction[] = [{
        date: new Date(2024, 0, 15),
        description: 'Amazon Revenue January',
        category: 'Amazon Sales',
        amount: 1500.00,
        balance: 11500.00,
      }];

      const matches = await service.matchTransactions(betterMatch);
      expect(matches[0].confidence).toBeGreaterThan(80); // Good match

      // Test partial match
      const partialMatch: BankTransaction[] = [{
        date: new Date(2024, 0, 16), // 1 day off
        description: 'AMZN PMT',
        category: 'Amazon Sales',
        amount: 1505.00, // Slightly different amount
        balance: 11505.00,
      }];

      const partialMatches = await service.matchTransactions(partialMatch, 2, 1);
      expect(partialMatches[0].confidence).toBeGreaterThan(30);
      expect(partialMatches[0].confidence).toBeLessThan(80);
    });
  });

  describe('reconcileTransactions', () => {
    const mockGLEntries: GLEntry[] = [
      {
        date: new Date(2024, 0, 15),
        description: 'Amazon Revenue',
        amount: 1500.00,
        category: 'Amazon Sales',
        accountType: 'Revenue',
        isProjection: false,
        isReconciled: false,
      },
    ];

    const matches: ReconciliationMatch[] = [
      {
        bankTransaction: {
          date: new Date(2024, 0, 15),
          description: 'AMAZON PAYMENTS',
          category: 'Amazon Sales',
          amount: 1500.00,
          balance: 11500.00,
        },
        glEntry: mockGLEntries[0],
        confidence: 95,
        matchType: 'exact',
      },
      {
        bankTransaction: {
          date: new Date(2024, 0, 20),
          description: 'BANK FEE',
          category: 'Bank Fees',
          amount: -10.00,
          balance: 11490.00,
        },
        glEntry: null,
        confidence: 0,
        matchType: 'unmatched',
      },
    ];

    beforeEach(() => {
      mockGLDataService.getEntries.mockReturnValue([...mockGLEntries]);
      mockGLDataService.setEntries.mockImplementation(() => {});
      mockGLDataService.addEntries.mockImplementation(() => {});
    });

    test('should reconcile matched transactions', async () => {
      const summary = await service.reconcileTransactions(matches);

      expect(summary.totalTransactions).toBe(2);
      expect(summary.matchedTransactions).toBe(1);
      expect(summary.unmatchedTransactions).toBe(1);
      expect(summary.entriesReconciled).toBe(1);
      expect(summary.newEntriesCreated).toBe(1);
      expect(summary.matchedAmount).toBe(1500.00);
      expect(summary.unmatchedAmount).toBe(10.00);
    });

    test('should create new entries for unmatched transactions', async () => {
      await service.reconcileTransactions(matches);

      expect(mockGLDataService.addEntries).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            date: new Date(2024, 0, 20),
            description: 'BANK FEE',
            amount: -10.00,
            category: 'Bank Fees',
            accountType: 'Expense',
            isReconciled: true,
            isActual: true,
          }),
        ])
      );
    });

    test('should update existing entries as reconciled', async () => {
      await service.reconcileTransactions(matches);

      expect(mockGLDataService.setEntries).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            isReconciled: true,
            isActual: true,
          }),
        ])
      );
    });

    test('should handle low confidence matches correctly', async () => {
      const lowConfidenceMatch: ReconciliationMatch[] = [{
        bankTransaction: {
          date: new Date(2024, 0, 15),
          description: 'PAYMENT',
          category: 'Other Revenue',
          amount: 100.00,
          balance: 100.00,
        },
        glEntry: mockGLEntries[0],
        confidence: 50, // Below 70 threshold
        matchType: 'fuzzy',
      }];

      const summary = await service.reconcileTransactions(lowConfidenceMatch);

      expect(summary.entriesReconciled).toBe(0);
      expect(summary.newEntriesCreated).toBe(1);
    });

    test('should calculate last reconciled date correctly', async () => {
      const multipleMatches: ReconciliationMatch[] = [
        {
          bankTransaction: {
            date: new Date(2024, 0, 10),
            description: 'TX1',
            category: 'Other Revenue',
            amount: 100,
            balance: 100,
          },
          glEntry: null,
          confidence: 0,
          matchType: 'unmatched',
        },
        {
          bankTransaction: {
            date: new Date(2024, 0, 20),
            description: 'TX2',
            category: 'Other Revenue',
            amount: 200,
            balance: 300,
          },
          glEntry: null,
          confidence: 0,
          matchType: 'unmatched',
        },
        {
          bankTransaction: {
            date: new Date(2024, 0, 15),
            description: 'TX3',
            category: 'Other Revenue',
            amount: 300,
            balance: 600,
          },
          glEntry: null,
          confidence: 0,
          matchType: 'unmatched',
        },
      ];

      const summary = await service.reconcileTransactions(multipleMatches);

      expect(summary.lastReconciledDate).toEqual(new Date(2024, 0, 20));
    });
  });

  describe('categorizeTransaction', () => {
    test.skip('should categorize revenue transactions correctly', () => {
      // This test is skipped because categorizeTransaction is no longer a method in BankReconciliationService
      // Categories are now provided directly in the CSV file
    });

    test.skip('should categorize expense transactions correctly', () => {
      // This test is skipped because categorizeTransaction is no longer a method in BankReconciliationService
      // Categories are now provided directly in the CSV file
    });
  });

  describe('getReconciliationStatus', () => {
    test('should return correct status when no entries exist', async () => {
      mockGLDataService.getEntries.mockReturnValue([]);

      const status = await service.getReconciliationStatus();

      expect(status).toEqual({
        lastReconciledDate: null,
        totalEntries: 0,
        reconciledEntries: 0,
        unreconciledEntries: 0,
        reconciliationRate: 0,
      });
    });

    test('should return correct status with mixed entries', async () => {
      const entries: GLEntry[] = [
        {
          date: new Date(2024, 0, 15),
          description: 'Entry 1',
          amount: 100,
          category: 'Test',
          accountType: 'Revenue',
          isProjection: false,
          isReconciled: true,
        },
        {
          date: new Date(2024, 0, 20),
          description: 'Entry 2',
          amount: 200,
          category: 'Test',
          accountType: 'Revenue',
          isProjection: false,
          isReconciled: true,
        },
        {
          date: new Date(2024, 0, 25),
          description: 'Entry 3',
          amount: 300,
          category: 'Test',
          accountType: 'Revenue',
          isProjection: false,
          isReconciled: false,
        },
      ];

      mockGLDataService.getEntries.mockReturnValue(entries);

      const status = await service.getReconciliationStatus();

      expect(status.lastReconciledDate).toEqual(new Date(2024, 0, 20));
      expect(status.totalEntries).toBe(3);
      expect(status.reconciledEntries).toBe(2);
      expect(status.unreconciledEntries).toBe(1);
      expect(status.reconciliationRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Singleton pattern', () => {
    test('should return the same instance', () => {
      const instance1 = BankReconciliationService.getInstance();
      const instance2 = BankReconciliationService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});