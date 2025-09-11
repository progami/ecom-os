// @ts-nocheck
import CutoffDateService from '@/lib/services/CutoffDateService';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    reconciliationStatus: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  })),
}));

// Mock config dates
jest.mock('@/config/dates', () => ({
  SYSTEM_DATES: {
    CUTOFF_DATE: new Date('2025-07-01'),
  },
}));

// Mock validator
jest.mock('@/config/validator', () => ({
  validateDateFormat: jest.fn((date) => {
    if (typeof date === 'string') {
      return /^\d{4}-\d{2}-\d{2}$/.test(date);
    }
    return true;
  }),
}));

describe('CutoffDateService', () => {
  let service: CutoffDateService;
  let mockPrisma: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear singleton instance
    (CutoffDateService as any).instance = undefined;
    service = CutoffDateService.getInstance();
    mockPrisma = (service as any).prisma;
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CutoffDateService.getInstance();
      const instance2 = CutoffDateService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getActiveCutoffDate', () => {
    it('should return cached cutoff date if available', async () => {
      // Set cached date
      (service as any).cachedCutoffDate = new Date('2025-07-15');
      
      const result = await service.getActiveCutoffDate();
      
      expect(result).toEqual(new Date('2025-07-15'));
      expect(mockPrisma.reconciliationStatus.findFirst).not.toHaveBeenCalled();
    });

    it('should return cutoff date from active reconciliation', async () => {
      const mockReconciliation = {
        id: '1',
        cutoffDate: new Date('2025-07-20'),
        isActive: true,
        lastReconciledDate: new Date('2025-07-20'),
      };

      mockPrisma.reconciliationStatus.findFirst.mockResolvedValueOnce(mockReconciliation);

      const result = await service.getActiveCutoffDate();

      expect(mockPrisma.reconciliationStatus.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { cutoffDate: 'desc' },
      });
      expect(result).toEqual(new Date('2025-07-20'));
      expect((service as any).cachedCutoffDate).toEqual(new Date('2025-07-20'));
    });

    it('should fallback to lastReconciledDate if new fields not available', async () => {
      // First query throws error (new fields not available)
      mockPrisma.reconciliationStatus.findFirst
        .mockRejectedValueOnce(new Error('Unknown field'))
        .mockResolvedValueOnce({
          id: '1',
          lastReconciledDate: new Date('2025-07-10'),
        });

      const result = await service.getActiveCutoffDate();

      expect(mockPrisma.reconciliationStatus.findFirst).toHaveBeenCalledTimes(2);
      expect(result).toEqual(new Date('2025-07-10'));
    });

    it('should return default date if no reconciliation found', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getActiveCutoffDate();

      expect(result).toEqual(new Date('2025-07-01')); // SYSTEM_DATES.CUTOFF_DATE
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No reconciliation found, using default cutoff date:',
        new Date('2025-07-01')
      );
    });

    it('should handle errors and return default date', async () => {
      mockPrisma.reconciliationStatus.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await service.getActiveCutoffDate();

      expect(result).toEqual(new Date('2025-07-01'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting cutoff date:', expect.any(Error));
    });
  });

  describe('updateCutoffDate', () => {
    it('should update cutoff date with new reconciliation', async () => {
      const date = new Date('2025-07-25');
      const fileName = 'bank-statement-july.csv';
      const transactionCount = 150;
      const totalAmount = 50000;

      mockPrisma.reconciliationStatus.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.reconciliationStatus.create.mockResolvedValue({
        id: '2',
        cutoffDate: date,
        isActive: true,
      });

      await service.updateCutoffDate(date, fileName, transactionCount, totalAmount);

      expect(mockPrisma.reconciliationStatus.updateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });

      expect(mockPrisma.reconciliationStatus.create).toHaveBeenCalledWith({
        data: {
          lastReconciledDate: date,
          fileName,
          transactionCount,
          totalAmount,
          bankName: 'Chase Bank',
          cutoffDate: date,
          isActive: true,
        },
      });

      expect((service as any).cachedCutoffDate).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith('Updated cutoff date to:', date);
    });

    it('should validate and convert string date format', async () => {
      const dateString = '2025-07-25';
      const fileName = 'bank-statement.csv';

      mockPrisma.reconciliationStatus.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.reconciliationStatus.create.mockResolvedValue({ id: '3' });

      await service.updateCutoffDate(dateString as any, fileName, 100, 25000);

      expect(mockPrisma.reconciliationStatus.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lastReconciledDate: new Date(dateString),
        }),
      });
    });

    it('should throw error for invalid date format', async () => {
      const invalidDate = '25-07-2025';
      
      await expect(
        service.updateCutoffDate(invalidDate as any, 'file.csv', 100, 25000)
      ).rejects.toThrow(`Invalid date format: ${invalidDate}`);
    });

    it('should handle missing new fields gracefully', async () => {
      const date = new Date('2025-07-25');
      
      // Simulate old schema where updateMany fails
      mockPrisma.reconciliationStatus.updateMany.mockRejectedValue(new Error('Unknown field'));
      mockPrisma.reconciliationStatus.create.mockResolvedValue({ id: '4' });

      await service.updateCutoffDate(date, 'file.csv', 100, 25000);

      expect(consoleLogSpy).toHaveBeenCalledWith('isActive field not available, skipping deactivation');
      expect(mockPrisma.reconciliationStatus.create).toHaveBeenCalled();
    });

    it('should propagate errors from database operations', async () => {
      const date = new Date('2025-07-25');
      const dbError = new Error('Database connection failed');
      
      mockPrisma.reconciliationStatus.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.reconciliationStatus.create.mockRejectedValue(dbError);

      await expect(
        service.updateCutoffDate(date, 'file.csv', 100, 25000)
      ).rejects.toThrow('Database connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating cutoff date:', dbError);
    });
  });

  describe('isActualData', () => {
    beforeEach(() => {
      // Clear cache before each test
      service.clearCache();
    });

    it('should return true for dates before cutoff', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce({ cutoffDate: new Date('2025-07-15'), isActive: true })
        .mockResolvedValueOnce(null);

      const result = await service.isActualData(new Date('2025-07-10'));
      
      expect(result).toBe(true);
    });

    it('should return true for dates equal to cutoff', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce({ cutoffDate: new Date('2025-07-15'), isActive: true })
        .mockResolvedValueOnce(null);

      const result = await service.isActualData(new Date('2025-07-15'));
      
      expect(result).toBe(true);
    });

    it('should return false for dates after cutoff', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce({ cutoffDate: new Date('2025-07-15'), isActive: true })
        .mockResolvedValueOnce(null);

      const result = await service.isActualData(new Date('2025-07-20'));
      
      expect(result).toBe(false);
    });
  });

  describe('getForecastStartDate', () => {
    beforeEach(() => {
      service.clearCache();
    });

    it('should return cutoff date + 1 day', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce({ cutoffDate: new Date('2025-07-15'), isActive: true })
        .mockResolvedValueOnce(null);

      const result = await service.getForecastStartDate();
      
      expect(result).toEqual(new Date('2025-07-16'));
    });

    it('should handle month boundaries correctly', async () => {
      mockPrisma.reconciliationStatus.findFirst
        .mockResolvedValueOnce({ cutoffDate: new Date('2025-07-31'), isActive: true })
        .mockResolvedValueOnce(null);

      const result = await service.getForecastStartDate();
      
      expect(result).toEqual(new Date('2025-08-01'));
    });
  });

  describe('clearCache', () => {
    it('should clear the cached cutoff date', () => {
      (service as any).cachedCutoffDate = new Date('2025-07-15');
      
      service.clearCache();
      
      expect((service as any).cachedCutoffDate).toBeNull();
    });
  });

  describe('getReconciliationHistory', () => {
    it('should return reconciliation history ordered by createdAt', async () => {
      const mockHistory = [
        { id: '3', createdAt: new Date('2025-07-20'), fileName: 'july.csv' },
        { id: '2', createdAt: new Date('2025-06-20'), fileName: 'june.csv' },
        { id: '1', createdAt: new Date('2025-05-20'), fileName: 'may.csv' },
      ];

      mockPrisma.reconciliationStatus.findMany.mockResolvedValue(mockHistory);

      const result = await service.getReconciliationHistory();

      expect(mockPrisma.reconciliationStatus.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array if no history exists', async () => {
      mockPrisma.reconciliationStatus.findMany.mockResolvedValue([]);

      const result = await service.getReconciliationHistory();

      expect(result).toEqual([]);
    });
  });
});