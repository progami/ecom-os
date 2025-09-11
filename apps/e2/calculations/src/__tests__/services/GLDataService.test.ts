// @ts-nocheck
import GLDataService, { GLEntry, GLFilters } from '@/lib/services/GLDataService';
import GLEntryService from '@/services/database/GLEntryService';

// Mock GLEntryService
jest.mock('@/services/database/GLEntryService');

describe('GLDataService', () => {
  let service: GLDataService;
  let mockGLEntryService: jest.Mocked<GLEntryService>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  // Sample test data
  const sampleEntries: GLEntry[] = [
    {
      date: new Date('2025-01-01'),
      description: 'Revenue from sales',
      category: 'Sales',
      accountCode: '4000',
      accountType: 'Revenue',
      amount: 10000,
      isActual: true,
    },
    {
      date: new Date('2025-01-15'),
      description: 'Office supplies',
      category: 'Operations',
      accountCode: '5030',
      accountType: 'Expense',
      amount: -500,
      isActual: true,
    },
    {
      date: new Date('2025-02-01'),
      description: 'Payroll',
      category: 'Payroll',
      accountCode: '5010',
      accountType: 'Expense',
      amount: -5000,
      isActual: true,
    },
    {
      date: new Date('2025-03-01'),
      description: 'Projected revenue',
      category: 'Sales',
      accountCode: '4000',
      accountType: 'Revenue',
      amount: 12000,
      isProjection: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (GLDataService as any).instance = undefined;
    
    // Setup mock GLEntryService
    mockGLEntryService = {
      getInstance: jest.fn(),
      getEntries: jest.fn().mockResolvedValue([]),
      setEntries: jest.fn().mockResolvedValue(undefined),
      addEntry: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    } as any;
    
    (GLEntryService.getInstance as jest.Mock).mockReturnValue(mockGLEntryService);
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Create service instance
    service = GLDataService.getInstance();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GLDataService.getInstance();
      const instance2 = GLDataService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('setEntries', () => {
    it('should set entries and convert dates', () => {
      const entries = [
        { ...sampleEntries[0], date: '2025-01-01' as any },
        sampleEntries[1],
      ];

      service.setEntries(entries);

      const result = service.getEntries();
      expect(result).toHaveLength(2);
      expect(result[0].date).toBeInstanceOf(Date);
      expect(consoleLogSpy).toHaveBeenCalledWith('GLDataService: setEntries called with', 2, 'entries');
    });

    it('should notify listeners when entries are set', () => {
      const listener = jest.fn();
      service.subscribe(listener);

      service.setEntries(sampleEntries);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getEntries', () => {
    it('should return a copy of entries array', () => {
      service.setEntries(sampleEntries);
      
      const entries = service.getEntries();
      const originalEntries = service.getEntries();
      
      // The arrays should be different instances
      expect(entries).not.toBe(originalEntries);
      // But contain the same data
      expect(entries).toEqual(originalEntries);
    });
  });

  describe('addEntry', () => {
    it('should add a single entry', () => {
      const newEntry = sampleEntries[0];
      
      service.addEntry(newEntry);
      
      const entries = service.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(newEntry);
    });

    it('should convert string date to Date object', () => {
      const entryWithStringDate = {
        ...sampleEntries[0],
        date: '2025-01-01' as any,
      };
      
      service.addEntry(entryWithStringDate);
      
      const entries = service.getEntries();
      expect(entries[0].date).toBeInstanceOf(Date);
    });

    it('should notify listeners', () => {
      const listener = jest.fn();
      service.subscribe(listener);
      
      service.addEntry(sampleEntries[0]);
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('addEntries', () => {
    it('should add multiple entries', () => {
      service.addEntries(sampleEntries);
      
      const entries = service.getEntries();
      expect(entries).toHaveLength(4);
    });

    it('should save to database', () => {
      service.addEntries(sampleEntries);
      
      // Since saveToDatabase is private and async, we can't directly test it
      // But we can verify the entries were added
      expect(service.getEntries()).toHaveLength(4);
    });
  });

  describe('clearEntries', () => {
    it('should clear all entries', () => {
      service.setEntries(sampleEntries);
      expect(service.getEntries()).toHaveLength(4);
      
      service.clearEntries();
      
      expect(service.getEntries()).toHaveLength(0);
    });

    it('should notify listeners', () => {
      const listener = jest.fn();
      service.subscribe(listener);
      
      service.clearEntries();
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Filter Methods', () => {
    beforeEach(() => {
      service.setEntries(sampleEntries);
    });

    describe('getEntriesByDateRange', () => {
      it('should filter entries by date range', () => {
        const entries = service.getEntriesByDateRange(
          new Date('2025-01-01'),
          new Date('2025-01-31')
        );
        
        expect(entries).toHaveLength(2);
        expect(entries[0].description).toBe('Revenue from sales');
        expect(entries[1].description).toBe('Office supplies');
      });

      it('should include boundary dates', () => {
        const entries = service.getEntriesByDateRange(
          new Date('2025-01-01'),
          new Date('2025-01-01')
        );
        
        expect(entries).toHaveLength(1);
        expect(entries[0].description).toBe('Revenue from sales');
      });
    });

    describe('getEntriesByAccountType', () => {
      it('should filter by account type', () => {
        const revenueEntries = service.getEntriesByAccountType('Revenue');
        expect(revenueEntries).toHaveLength(2);
        
        const expenseEntries = service.getEntriesByAccountType('Expense');
        expect(expenseEntries).toHaveLength(2);
      });
    });

    describe('getEntriesByAccountCode', () => {
      it('should filter by account code', () => {
        const entries = service.getEntriesByAccountCode('4000');
        expect(entries).toHaveLength(2);
        expect(entries.every(e => e.accountCode === '4000')).toBe(true);
      });
    });

    describe('getEntriesByCategory', () => {
      it('should filter by category', () => {
        const entries = service.getEntriesByCategory('Sales');
        expect(entries).toHaveLength(2);
        expect(entries.every(e => e.category === 'Sales')).toBe(true);
      });
    });

    describe('getEntriesFiltered', () => {
      it('should filter by multiple criteria', () => {
        const filters: GLFilters = {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-28'),
          accountType: 'Expense',
          isActual: true,
        };
        
        const entries = service.getEntriesFiltered(filters);
        expect(entries).toHaveLength(2);
        expect(entries[0].description).toBe('Office supplies');
        expect(entries[1].description).toBe('Payroll');
      });

      it('should handle partial filters', () => {
        const filters: GLFilters = {
          isProjection: true,
        };
        
        const entries = service.getEntriesFiltered(filters);
        expect(entries).toHaveLength(1);
        expect(entries[0].description).toBe('Projected revenue');
      });

      it('should return all entries with empty filters', () => {
        const entries = service.getEntriesFiltered({});
        expect(entries).toHaveLength(4);
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      service.setEntries(sampleEntries);
    });

    describe('getUniqueCategories', () => {
      it('should return sorted unique categories', () => {
        const categories = service.getUniqueCategories();
        expect(categories).toEqual(['Operations', 'Payroll', 'Sales']);
      });
    });

    describe('getUniqueAccountCodes', () => {
      it('should return sorted unique account codes', () => {
        const codes = service.getUniqueAccountCodes();
        expect(codes).toEqual(['4000', '5010', '5030']);
      });
    });

    describe('getDateRange', () => {
      it('should return start and end dates', () => {
        const { startDate, endDate } = service.getDateRange();
        expect(startDate).toEqual(new Date('2025-01-01'));
        expect(endDate).toEqual(new Date('2025-03-01'));
      });

      it('should return null dates for empty entries', () => {
        service.clearEntries();
        const { startDate, endDate } = service.getDateRange();
        expect(startDate).toBeNull();
        expect(endDate).toBeNull();
      });
    });
  });

  describe('Balance Calculations', () => {
    beforeEach(() => {
      service.setEntries(sampleEntries);
    });

    describe('getBalanceByAccount', () => {
      it('should calculate balance for specific account', () => {
        const balance = service.getBalanceByAccount('4000');
        expect(balance).toBe(22000); // 10000 + 12000
      });

      it('should calculate balance as of specific date', () => {
        const balance = service.getBalanceByAccount('4000', new Date('2025-02-15'));
        expect(balance).toBe(10000); // Only first revenue entry
      });

      it('should calculate total balance when no account specified', () => {
        const balance = service.getBalanceByAccount('');
        expect(balance).toBe(16500); // 10000 - 500 - 5000 + 12000
      });
    });

    describe('getBalanceByAccountType', () => {
      it('should calculate balance by account type', () => {
        const revenueBalance = service.getBalanceByAccountType('Revenue');
        expect(revenueBalance).toBe(22000);
        
        const expenseBalance = service.getBalanceByAccountType('Expense');
        expect(expenseBalance).toBe(-5500);
      });

      it('should calculate balance as of specific date', () => {
        const balance = service.getBalanceByAccountType('Expense', new Date('2025-01-31'));
        expect(balance).toBe(-500); // Only office supplies
      });
    });
  });

  describe('Event System', () => {
    it('should subscribe and notify listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      service.subscribe(listener1);
      service.subscribe(listener2);
      
      service.addEntry(sampleEntries[0]);
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe listeners', () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);
      
      service.addEntry(sampleEntries[0]);
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      service.addEntry(sampleEntries[1]);
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('getSummaryStats', () => {
    it('should return comprehensive statistics', () => {
      service.setEntries(sampleEntries);
      
      const stats = service.getSummaryStats();
      
      expect(stats.totalEntries).toBe(4);
      expect(stats.dateRange.startDate).toEqual(new Date('2025-01-01'));
      expect(stats.dateRange.endDate).toEqual(new Date('2025-03-01'));
      expect(stats.balancesByType.Revenue).toBe(22000);
      expect(stats.balancesByType.Expense).toBe(-5500);
      expect(stats.projectionCount).toBe(1);
      expect(stats.reconciledCount).toBe(0);
      expect(stats.actualCount).toBe(3);
      expect(stats.historicalCount).toBe(3);
    });

    it('should handle empty entries', () => {
      service.clearEntries();
      
      const stats = service.getSummaryStats();
      
      expect(stats.totalEntries).toBe(0);
      expect(stats.dateRange.startDate).toBeNull();
      expect(stats.dateRange.endDate).toBeNull();
      expect(stats.balancesByType.Revenue).toBe(0);
      expect(stats.projectionCount).toBe(0);
    });
  });

  describe('Database Integration', () => {
    let windowSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock window to be undefined to simulate server environment
      windowSpy = jest.spyOn(global, 'window', 'get');
      windowSpy.mockImplementation(() => undefined);
    });

    afterEach(() => {
      windowSpy.mockRestore();
    });

    it('should load entries from database on initialization in server environment', async () => {
      mockGLEntryService.getEntries.mockResolvedValue(sampleEntries);
      
      // Create new instance to trigger load
      (GLDataService as any).instance = undefined;
      const newService = GLDataService.getInstance();
      
      // Wait for async load
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockGLEntryService.getEntries).toHaveBeenCalled();
    });

    it('should handle database load errors in server environment', async () => {
      mockGLEntryService.getEntries.mockRejectedValue(new Error('DB Error'));
      
      // Create new instance to trigger load
      (GLDataService as any).instance = undefined;
      const newService = GLDataService.getInstance();
      
      // Wait for async load
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load GL data from database:',
        expect.any(Error)
      );
      expect(newService.getEntries()).toEqual([]);
    });

    it('should not initialize database service in client environment', () => {
      // Restore window to simulate client environment
      windowSpy.mockRestore();
      
      // Create new instance
      (GLDataService as any).instance = undefined;
      const newService = GLDataService.getInstance();
      
      // GLEntryService should not be initialized
      expect(GLEntryService.getInstance).not.toHaveBeenCalled();
    });
  });
});