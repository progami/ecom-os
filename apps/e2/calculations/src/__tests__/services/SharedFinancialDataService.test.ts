// @ts-nocheck
import SharedFinancialDataService from '@/services/database/SharedFinancialDataService';
import { prisma } from '@/utils/database';
import { startOfWeek, endOfWeek, format } from 'date-fns';

// Mock the prisma client
jest.mock('@/utils/database', () => ({
  prisma: {
    revenue: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    gLEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

describe('SharedFinancialDataService', () => {
  let service: SharedFinancialDataService;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = SharedFinancialDataService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SharedFinancialDataService.getInstance();
      const instance2 = SharedFinancialDataService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Subscription Management', () => {
    it('should allow subscribing and unsubscribing', async () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);
      
      // Trigger a notification by calling a method that modifies data
      mockPrisma.revenue.create.mockResolvedValue({} as any);
      mockPrisma.gLEntry.create.mockResolvedValue({} as any);
      
      await service.addRevenue({
        weekStarting: '2025-01-01',
        weekEnding: '2025-01-07',
        category: 'Test',
        amount: 1000,
      });
      
      // The service calls notifySubscribers once for revenue creation and twice for GL entries (debit and credit)
      expect(callback).toHaveBeenCalledTimes(3);
      
      // Unsubscribe and verify callback is not called
      unsubscribe();
      await service.addRevenue({
        weekStarting: '2025-01-08',
        weekEnding: '2025-01-14',
        category: 'Test',
        amount: 2000,
      });
      
      expect(callback).toHaveBeenCalledTimes(3); // Still 3
    });
  });

  describe('Revenue Operations', () => {
    const mockRevenueData = [
      {
        id: '1',
        weekStarting: new Date('2025-01-01'),
        weekEnding: new Date('2025-01-07'),
        category: 'Amazon FBA',
        subcategory: 'US',
        amount: 5000,
        units: 200,
        orderCount: 50,
        metadata: { marketplace: 'amazon.com' },
      },
    ];

    it('should get all revenue data', async () => {
      mockPrisma.revenue.findMany.mockResolvedValue(mockRevenueData);
      
      const result = await service.getRevenue();
      
      expect(mockPrisma.revenue.findMany).toHaveBeenCalledWith({
        orderBy: { weekStarting: 'desc' }
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        weekStarting: '2025-01-01',
        weekEnding: '2025-01-07',
        category: 'Amazon FBA',
        subcategory: 'US',
        amount: 5000,
        units: 200,
        orderCount: 50,
        metadata: { marketplace: 'amazon.com' },
      });
    });

    it('should add revenue and create GL entry', async () => {
      const newRevenue = {
        weekStarting: '2025-01-08',
        weekEnding: '2025-01-14',
        category: 'Amazon FBA',
        amount: 6000,
        units: 250,
      };

      mockPrisma.revenue.create.mockResolvedValue({
        id: '2',
        ...newRevenue,
        weekStarting: new Date(newRevenue.weekStarting),
        weekEnding: new Date(newRevenue.weekEnding),
        subcategory: null,
        orderCount: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.addRevenue(newRevenue);

      expect(mockPrisma.revenue.create).toHaveBeenCalledWith({
        data: {
          weekStarting: new Date('2025-01-08'),
          weekEnding: new Date('2025-01-14'),
          category: 'Amazon FBA',
          subcategory: undefined,
          amount: 6000,
          units: 250,
          orderCount: undefined,
          metadata: undefined,
        }
      });

      // Check first GL entry (credit to revenue account)
      expect(mockPrisma.gLEntry.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.gLEntry.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          date: new Date('2025-01-08'),
          account: 'Revenue - Amazon FBA',
          accountCategory: 'Revenue',
          debit: 0,
          credit: 6000,
          description: 'Amazon FBA ',
          source: 'automated',
        })
      });
      
      // Check second GL entry (debit to cash account)
      expect(mockPrisma.gLEntry.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          date: new Date('2025-01-08'),
          account: 'Cash',
          accountCategory: 'Assets',
          debit: 6000,
          credit: 0,
          description: 'Amazon FBA ',
          source: 'automated',
        })
      });
    });

    it('should update revenue', async () => {
      const updateData = {
        amount: 7000,
        units: 300,
      };

      mockPrisma.revenue.update.mockResolvedValue({} as any);

      await service.updateRevenue('1', updateData);

      expect(mockPrisma.revenue.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { amount: 7000, units: 300 }
      });
    });

    it('should delete revenue', async () => {
      await service.deleteRevenue('1');

      expect(mockPrisma.revenue.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });
  });

  describe('Expense Operations', () => {
    const mockExpenseData = [
      {
        id: '1',
        date: new Date('2025-01-05'),
        weekStarting: new Date('2025-01-01'),
        category: 'Marketing',
        subcategory: 'PPC',
        description: 'Amazon PPC Campaign',
        amount: 500,
        type: 'automated',
        vendor: 'Amazon',
        invoiceNumber: 'INV-001',
        metadata: { campaignId: 'camp-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should get all expenses', async () => {
      mockPrisma.expense.findMany.mockResolvedValue(mockExpenseData);
      
      const result = await service.getExpenses();
      
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        orderBy: { date: 'desc' }
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        date: '2025-01-05',
        weekStarting: '2025-01-01',
        category: 'Marketing',
        subcategory: 'PPC',
        description: 'Amazon PPC Campaign',
        amount: 500,
        type: 'automated',
        vendor: 'Amazon',
        invoiceNumber: 'INV-001',
        metadata: { campaignId: 'camp-123' },
      });
    });

    it('should add expense and create GL entry', async () => {
      const newExpense = {
        date: '2025-01-10',
        weekStarting: '2025-01-05',
        category: 'Office',
        description: 'Office Supplies',
        amount: 200,
      };

      const weekStart = startOfWeek(new Date(newExpense.date));
      
      mockPrisma.expense.create.mockResolvedValue({} as any);
      mockPrisma.gLEntry.create.mockResolvedValue({} as any);

      await service.addExpense(newExpense);

      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          date: new Date('2025-01-10'),
          weekStarting: weekStart,
          category: 'Office',
          subcategory: undefined,
          description: 'Office Supplies',
          amount: 200,
          type: 'manual',
          vendor: undefined,
          invoiceNumber: undefined,
          metadata: undefined,
        }
      });

      // Check first GL entry (debit to expense account)
      expect(mockPrisma.gLEntry.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.gLEntry.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          date: new Date('2025-01-10'),
          account: 'Office',
          accountCategory: 'Office',
          debit: 200,
          credit: 0,
          description: 'Office Supplies',
          source: 'manual',
        })
      });
      
      // Check second GL entry (credit to cash account)
      expect(mockPrisma.gLEntry.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          date: new Date('2025-01-10'),
          account: 'Cash',
          accountCategory: 'Assets',
          debit: 0,
          credit: 200,
          description: 'Office Supplies',
          source: 'manual',
        })
      });
    });
  });

  describe('Weekly Financial Data', () => {
    it('should get weekly financial data', async () => {
      const now = new Date();
      const weekStart = startOfWeek(now);

      mockPrisma.revenue.findMany.mockResolvedValue([
        {
          amount: 5000,
          weekStarting: weekStart,
          weekEnding: endOfWeek(weekStart),
          category: 'Amazon FBA',
        }
      ]);

      mockPrisma.expense.findMany.mockResolvedValue([
        {
          amount: 1000,
          date: new Date(weekStart),
          weekStarting: weekStart,
        }
      ]);

      mockPrisma.gLEntry.findMany.mockResolvedValue([]);

      const result = await service.getWeeklyFinancialData(1); // Get 1 week of data

      expect(result.length).toBeGreaterThan(0);
      // The result will include aggregated weekly data
    });
  });

  describe('Product and Inventory Operations', () => {
    it('should get all products', async () => {
      const mockProducts = [
        { id: '1', sku: 'TS-007', name: 'T-Shirt', category: 'Apparel' }
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      
      const result = await service.getProducts();
      
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' }
      });
      expect(result).toEqual(mockProducts);
    });

    it('should get inventory batches', async () => {
      const mockBatches = [
        {
          id: '1',
          sku: 'TS-007',
          quantity: 100,
          unitCost: 5.5,
          totalCost: 550,
          arrivalDate: new Date('2025-01-15'),
        }
      ];

      mockPrisma.inventoryBatch.findMany.mockResolvedValue(mockBatches);
      
      const result = await service.getInventoryBatches();
      
      expect(mockPrisma.inventoryBatch.findMany).toHaveBeenCalledWith({
        where: {},
        include: { product: true },
        orderBy: { manufactureDate: 'desc' }
      });
      expect(result).toEqual(mockBatches);
    });
  });


  describe('Data Persistence', () => {
    it('should persist data without transaction', async () => {
      // The service doesn't use transactions for addRevenue
      mockPrisma.revenue.create.mockResolvedValue({} as any);
      mockPrisma.gLEntry.create.mockResolvedValue({} as any);

      // Add revenue without transaction
      await service.addRevenue({
        weekStarting: '2025-01-01',
        weekEnding: '2025-01-07',
        category: 'Test',
        amount: 1000,
      });

      expect(mockPrisma.revenue.create).toHaveBeenCalled();
      expect(mockPrisma.gLEntry.create).toHaveBeenCalledTimes(2); // Two GL entries
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Additional Operations', () => {
    it('should update expense', async () => {
      const updateData = {
        amount: 300,
        description: 'Updated Office Supplies',
      };

      mockPrisma.expense.update.mockResolvedValue({} as any);

      await service.updateExpense('1', updateData);

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { 
          amount: 300, 
          description: 'Updated Office Supplies' 
        }
      });
    });

    it('should delete expense', async () => {
      mockPrisma.expense.delete.mockResolvedValue({} as any);

      await service.deleteExpense('1');

      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
        where: { id: '1' }
      });
    });

    it('should get GL entries with date filter', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const mockGLEntries = [
        {
          id: '1',
          date: new Date('2025-01-15'),
          account: 'Revenue',
          debit: 0,
          credit: 1000,
        }
      ];

      mockPrisma.gLEntry.findMany.mockResolvedValue(mockGLEntries);

      const result = await service.getGLEntries(startDate, endDate);

      expect(mockPrisma.gLEntry.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          }
        },
        orderBy: { date: 'desc' }
      });
      expect(result).toEqual(mockGLEntries);
    });

    it('should create GL entry', async () => {
      const glData = {
        date: new Date('2025-01-15'),
        account: 'Test Account',
        accountCategory: 'Test Category',
        description: 'Test Entry',
        debit: 100,
        credit: 0,
        source: 'manual',
        metadata: {},
        reference: null,
        periodId: null,
      };

      mockPrisma.gLEntry.create.mockResolvedValue({ 
        id: '1', 
        ...glData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.createGLEntry(glData);

      expect(mockPrisma.gLEntry.create).toHaveBeenCalledWith({
        data: glData
      });
      expect(result.id).toBe('1');
    });

    it('should create product', async () => {
      const productData = {
        sku: 'TEST-001',
        name: 'Test Product',
        category: 'Test Category',
        unitCost: 10,
        shippingCost: 2,
        isActive: true,
      };

      mockPrisma.product.create.mockResolvedValue({
        id: '1',
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.createProduct(productData as any);

      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: productData
      });
      expect(result.id).toBe('1');
    });

    it('should update product', async () => {
      const updateData = {
        name: 'Updated Product',
        unitCost: 15,
      };

      mockPrisma.product.update.mockResolvedValue({
        id: '1',
        ...updateData,
      } as any);

      const result = await service.updateProduct('1', updateData);

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData
      });
      expect(result.id).toBe('1');
    });

    it('should create inventory batch', async () => {
      const batchData = {
        productId: 'prod-1',
        quantity: 100,
        unitCost: 5,
        totalCost: 500,
        manufactureDate: new Date('2025-01-01'),
        expirationDate: new Date('2026-01-01'),
        batchNumber: 'BATCH-001',
        status: 'active',
      };

      mockPrisma.inventoryBatch.create.mockResolvedValue({
        id: '1',
        ...batchData,
        product: { id: 'prod-1', name: 'Test Product' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.createInventoryBatch(batchData as any);

      expect(mockPrisma.inventoryBatch.create).toHaveBeenCalledWith({
        data: batchData,
        include: { product: true }
      });
      expect(result.id).toBe('1');
    });

    it('should get inventory batches for specific product', async () => {
      const productId = 'prod-1';
      const mockBatches = [
        {
          id: '1',
          productId,
          quantity: 100,
          product: { id: productId, name: 'Test Product' },
        }
      ];

      mockPrisma.inventoryBatch.findMany.mockResolvedValue(mockBatches);

      const result = await service.getInventoryBatches(productId);

      expect(mockPrisma.inventoryBatch.findMany).toHaveBeenCalledWith({
        where: { productId },
        include: { product: true },
        orderBy: { manufactureDate: 'desc' }
      });
      expect(result).toEqual(mockBatches);
    });

    it('should disconnect from database', async () => {
      mockPrisma.$disconnect.mockResolvedValue();

      await service.disconnect();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});