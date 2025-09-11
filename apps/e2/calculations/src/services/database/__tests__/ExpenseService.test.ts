// @ts-nocheck
import ExpenseService, { ExpenseData } from '../ExpenseService';
import ProductService from '../ProductService';
import { prisma } from '@/utils/database';

// Mock the database module
jest.mock('@/utils/database', () => ({
  prisma: {
    $transaction: jest.fn(),
    expense: {
      upsert: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn()
    }
  }
}));

// Mock ProductService
jest.mock('../ProductService');

describe('ExpenseService', () => {
  let service: ExpenseService;
  let mockTransaction: jest.Mock;
  let mockProductService: jest.Mocked<ProductService>;

  beforeEach(() => {
    // Reset singleton instance
    (ExpenseService as any).instance = null;
    
    // Setup ProductService mock
    mockProductService = {
      getInstance: jest.fn(),
      initializeCache: jest.fn().mockResolvedValue(undefined),
      getAllProducts: jest.fn().mockReturnValue({
        'SKU001': { 
          sku: 'SKU001',
          name: 'SKU001',
          fbaFee: 3.50,
          price: 20,
          manufacturingCost: 1.5,
          freightCost: 0.3,
          warehouseCost: 0.12,
          amazonReferralFee: 3,
          refundAllowance: 0.2
        },
        'SKU002': { 
          sku: 'SKU002',
          name: 'SKU002',
          fbaFee: 4.25,
          price: 25,
          manufacturingCost: 2,
          freightCost: 0.4,
          warehouseCost: 0.12,
          amazonReferralFee: 3.75,
          refundAllowance: 0.25
        }
      }),
      getProduct: jest.fn().mockImplementation((sku) => {
        const products = mockProductService.getAllProducts();
        return products[sku] || null;
      }),
      isValidSku: jest.fn().mockImplementation((sku) => {
        const products = mockProductService.getAllProducts();
        return sku in products;
      })
    } as any;
    (ProductService.getInstance as jest.Mock).mockReturnValue(mockProductService);
    
    service = ExpenseService.getInstance();
    
    // Setup transaction mock
    mockTransaction = jest.fn().mockImplementation(async (callback) => {
      return callback(prisma);
    });
    (prisma.$transaction as jest.Mock) = mockTransaction;
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = ExpenseService.getInstance();
      const instance2 = ExpenseService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('upsertExpenses', () => {
    it('creates manual expenses successfully', async () => {
      const expenses: ExpenseData[] = [
        {
          date: new Date('2024-01-15'),
          weekStarting: new Date('2024-01-15'),
          category: 'Office Supplies',
          description: 'Printer paper',
          amount: 125.50,
          type: 'manual',
          vendor: 'Staples'
        }
      ];

      await service.upsertExpenses(expenses);

      expect(mockTransaction).toHaveBeenCalled();
      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          date: expenses[0].date,
          category: 'Office Supplies',
          description: 'Printer paper',
          amount: 125.50,
          type: 'manual',
          vendor: 'Staples'
        })
      });
    });

    it('upserts automated Amazon expenses to avoid duplicates', async () => {
      const expenses: ExpenseData[] = [
        {
          date: new Date('2024-01-15'),
          weekStarting: new Date('2024-01-15'),
          category: 'Amazon Fees',
          subcategory: 'Referral Fee',
          description: 'Amazon Referral Fee (15% of sales)',
          amount: 300,
          type: 'automated',
          vendor: 'Amazon',
          metadata: { percentage: 0.15 }
        }
      ];

      await service.upsertExpenses(expenses);

      expect(mockTransaction).toHaveBeenCalled();
      expect(prisma.expense.upsert).toHaveBeenCalledWith({
        where: {
          date_category_subcategory_vendor: {
            date: expenses[0].date,
            category: 'Amazon Fees',
            subcategory: 'Referral Fee',
            vendor: 'Amazon'
          }
        },
        update: expect.objectContaining({
          amount: 300,
          description: 'Amazon Referral Fee (15% of sales)'
        }),
        create: expect.objectContaining({
          date: expenses[0].date,
          category: 'Amazon Fees',
          subcategory: 'Referral Fee',
          amount: 300,
          type: 'automated',
          vendor: 'Amazon'
        })
      });
    });

    it('calculates weekStarting correctly for different days', async () => {
      const expenses: ExpenseData[] = [
        {
          date: new Date('2024-01-18'), // Thursday
          weekStarting: new Date('2024-01-15'), // Should be Monday
          category: 'Test',
          description: 'Test expense',
          amount: 100,
          type: 'manual'
        }
      ];

      await service.upsertExpenses(expenses);

      const createCall = (prisma.expense.create as jest.Mock).mock.calls[0][0];
      const calculatedWeekStarting = createCall.data.weekStarting;
      
      // Should be Monday of that week
      expect(calculatedWeekStarting.getDay()).toBe(1); // Monday
      expect(calculatedWeekStarting.getDate()).toBe(15);
    });

    it('handles transaction errors', async () => {
      const error = new Error('Database connection failed');
      mockTransaction.mockRejectedValueOnce(error);

      const expenses: ExpenseData[] = [
        {
          date: new Date('2024-01-15'),
          weekStarting: new Date('2024-01-15'),
          category: 'Test',
          description: 'Test',
          amount: 100,
          type: 'manual'
        }
      ];

      await expect(service.upsertExpenses(expenses)).rejects.toThrow('Database connection failed');
    });

    it('notifies subscribers after successful save', async () => {
      const mockSubscriber = jest.fn();
      service.subscribe(mockSubscriber);

      const expenses: ExpenseData[] = [
        {
          date: new Date('2024-01-15'),
          weekStarting: new Date('2024-01-15'),
          category: 'Test',
          description: 'Test',
          amount: 100,
          type: 'manual'
        }
      ];

      await service.upsertExpenses(expenses);

      expect(mockSubscriber).toHaveBeenCalled();
    });
  });

  describe('getExpensesByDateRange', () => {
    it('retrieves expenses within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockExpenses = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          weekStarting: new Date('2024-01-15'),
          category: 'Office Supplies',
          subcategory: null,
          description: 'Supplies',
          amount: 125.50,
          type: 'manual',
          vendor: 'Staples',
          invoiceNumber: null,
          isRecurring: false,
          recurringFreq: null,
          metadata: null
        }
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValueOnce(mockExpenses);

      const result = await service.getExpensesByDateRange(startDate, endDate);

      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        category: 'Office Supplies',
        amount: 125.50
      });
    });

    it('handles empty results', async () => {
      (prisma.expense.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getExpensesByDateRange(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual([]);
    });

    it('handles database errors gracefully', async () => {
      (prisma.expense.findMany as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await service.getExpensesByDateRange(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual([]);
    });
  });

  describe('getExpensesByWeek', () => {
    it('retrieves expenses for a specific week', async () => {
      const weekStarting = new Date('2024-01-15');
      
      const mockExpenses = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          weekStarting: weekStarting,
          category: 'Office Supplies',
          subcategory: null,
          description: 'Weekly supplies',
          amount: 200,
          type: 'manual',
          vendor: 'Staples',
          invoiceNumber: null,
          isRecurring: false,
          recurringFreq: null,
          metadata: null
        }
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValueOnce(mockExpenses);

      const result = await service.getExpensesByWeek(weekStarting);

      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { weekStarting },
        orderBy: { date: 'asc' }
      });

      expect(result).toHaveLength(1);
      expect(result[0].weekStarting).toEqual(weekStarting);
    });
  });

  describe('calculateAndStoreAmazonFees', () => {
    it('calculates and stores all Amazon fee types', async () => {
      const weekData = {
        weekStarting: new Date('2024-01-15'),
        year: 2025,
        skuData: [
          {
            sku: 'SKU001',
            units: 100,
            grossRevenue: 2000
          },
          {
            sku: 'SKU002',
            units: 50,
            grossRevenue: 1500
          }
        ]
      };

      await service.calculateAndStoreAmazonFees(weekData);

      expect(mockTransaction).toHaveBeenCalled();

      // Check referral fee was created
      expect(prisma.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            category: 'Amazon Fees',
            subcategory: 'Referral Fee',
            amount: 525, // 15% of 3500
            type: 'automated',
            vendor: 'Amazon'
          })
        })
      );

      // Check FBA fee was created
      expect(prisma.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            category: 'Amazon Fees',
            subcategory: 'FBA Fees',
            amount: 562.5, // (100 * 3.50) + (50 * 4.25)
            type: 'automated',
            vendor: 'Amazon'
          })
        })
      );

      // Check TACoS/PPC fee was created
      expect(prisma.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            category: 'Amazon Fees',
            subcategory: 'Advertising',
            amount: 262.5, // 7.5% TACoS for 2025
            type: 'automated',
            vendor: 'Amazon'
          })
        })
      );
    });

    it('uses correct TACoS rates by year', async () => {
      const weekData = {
        weekStarting: new Date('2027-01-15'),
        year: 2027,
        skuData: [
          {
            sku: 'SKU001',
            units: 100,
            grossRevenue: 1000
          }
        ]
      };

      await service.calculateAndStoreAmazonFees(weekData);

      // Check TACoS rate for 2027 (6.5%)
      expect(prisma.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            subcategory: 'Advertising',
            amount: 65, // 6.5% of 1000
            description: expect.stringContaining('6.5% TACoS')
          })
        })
      );
    });

    it('handles SKUs without FBA fees', async () => {
      const weekData = {
        weekStarting: new Date('2025-01-15'),
        year: 2025,
        skuData: [
          {
            sku: 'UNKNOWN_SKU',
            units: 100,
            grossRevenue: 1000
          }
        ]
      };

      await service.calculateAndStoreAmazonFees(weekData);

      // Should still calculate referral and TACoS fees
      expect(prisma.expense.upsert).toHaveBeenCalledTimes(2); // No FBA fee
    });

    it('skips creation when no revenue', async () => {
      const weekData = {
        weekStarting: new Date('2025-01-15'),
        year: 2025,
        skuData: []
      };

      await service.calculateAndStoreAmazonFees(weekData);

      expect(prisma.expense.upsert).not.toHaveBeenCalled();
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('adds and removes subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = service.subscribe(callback1);
      const unsubscribe2 = service.subscribe(callback2);

      // Trigger notification
      service['notifySubscribers']();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      // Unsubscribe first callback
      unsubscribe1();
      callback1.mockClear();
      callback2.mockClear();

      // Trigger notification again
      service['notifySubscribers']();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('handles multiple unsubscribes safely', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);

      unsubscribe();
      unsubscribe(); // Second call should not throw

      service['notifySubscribers']();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    it('getWeekStarting returns Monday for various days', () => {
      // Use a week where we know the dates
      // Week of Jan 8-14, 2024 (Monday Jan 8)
      const testCases = [
        { input: new Date('2024-01-08T12:00:00'), dayName: 'Monday', expectedMonday: 8 },
        { input: new Date('2024-01-09T12:00:00'), dayName: 'Tuesday', expectedMonday: 8 },
        { input: new Date('2024-01-10T12:00:00'), dayName: 'Wednesday', expectedMonday: 8 },
        { input: new Date('2024-01-11T12:00:00'), dayName: 'Thursday', expectedMonday: 8 },
        { input: new Date('2024-01-12T12:00:00'), dayName: 'Friday', expectedMonday: 8 },
        { input: new Date('2024-01-13T12:00:00'), dayName: 'Saturday', expectedMonday: 8 },
        { input: new Date('2024-01-14T12:00:00'), dayName: 'Sunday', expectedMonday: 8 },
      ];

      testCases.forEach(({ input, dayName, expectedMonday }) => {
        const result = service['getWeekStarting'](input);
        
        // The result should always be a Monday
        expect(result.getDay()).toBe(1);
        
        // The result should be the Monday of the same week
        expect(result.getDate()).toBe(expectedMonday);
        
        // The month and year should be preserved correctly
        expect(result.getMonth()).toBe(0); // January
        expect(result.getFullYear()).toBe(2024);
      });
    });
  });
});