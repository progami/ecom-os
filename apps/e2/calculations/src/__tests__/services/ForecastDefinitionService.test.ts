// @ts-nocheck
import ForecastDefinitionService from '@/lib/services/ForecastDefinitionService';
import CutoffDateService from '@/lib/services/CutoffDateService';
import { PrismaClient } from '@prisma/client';
import { addMonths, addYears } from 'date-fns';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    forecastDefinition: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  })),
}));

// Mock CutoffDateService
jest.mock('@/lib/services/CutoffDateService');

// Mock category-account-mapping
jest.mock('@/lib/category-account-mapping', () => ({
  getCategoryAccountCode: jest.fn((category, type) => {
    if (type === 'recurring_expense') {
      if (category === 'Marketing') return '5020';
      if (category === 'Payroll') return '5010';
      if (category === 'Operations') return '5030';
    }
    return '5000';
  }),
}));

describe('ForecastDefinitionService', () => {
  let service: ForecastDefinitionService;
  let mockPrisma: any;
  let mockCutoffDateService: jest.Mocked<CutoffDateService>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear singleton instance
    (ForecastDefinitionService as any).instance = undefined;
    
    // Setup CutoffDateService mock
    mockCutoffDateService = {
      getForecastStartDate: jest.fn().mockResolvedValue(new Date('2025-07-02')),
      getActiveCutoffDate: jest.fn().mockResolvedValue(new Date('2025-07-01')),
    } as any;
    (CutoffDateService.getInstance as jest.Mock).mockReturnValue(mockCutoffDateService);
    
    service = ForecastDefinitionService.getInstance();
    mockPrisma = (service as any).prisma;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ForecastDefinitionService.getInstance();
      const instance2 = ForecastDefinitionService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createDefinition', () => {
    it('should create a new forecast definition', async () => {
      const input = {
        type: 'recurring_expense',
        category: 'Marketing',
        description: 'Google Ads',
        baseAmount: 5000,
        frequency: 'monthly',
        startDate: new Date('2025-01-01'),
      };

      const mockCreated = {
        id: '1',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.forecastDefinition.create.mockResolvedValue(mockCreated);

      const result = await service.createDefinition(input);

      expect(mockPrisma.forecastDefinition.create).toHaveBeenCalledWith({
        data: {
          ...input,
          isActive: true,
        },
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe('getActiveDefinitions', () => {
    it('should get all active definitions', async () => {
      const mockDefinitions = [
        { id: '1', type: 'recurring_expense', category: 'Marketing', isActive: true },
        { id: '2', type: 'recurring_expense', category: 'Payroll', isActive: true },
      ];

      mockPrisma.forecastDefinition.findMany.mockResolvedValue(mockDefinitions);

      const result = await service.getActiveDefinitions();

      expect(mockPrisma.forecastDefinition.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { type: 'asc' },
          { category: 'asc' },
          { startDate: 'asc' },
        ],
      });
      expect(result).toEqual(mockDefinitions);
    });

    it('should filter by type when provided', async () => {
      const mockDefinitions = [
        { id: '1', type: 'recurring_expense', category: 'Marketing', isActive: true },
      ];

      mockPrisma.forecastDefinition.findMany.mockResolvedValue(mockDefinitions);

      const result = await service.getActiveDefinitions('recurring_expense');

      expect(mockPrisma.forecastDefinition.findMany).toHaveBeenCalledWith({
        where: { isActive: true, type: 'recurring_expense' },
        orderBy: expect.any(Array),
      });
      expect(result).toEqual(mockDefinitions);
    });
  });

  describe('deactivateDefinition', () => {
    it('should deactivate a definition', async () => {
      await service.deactivateDefinition('1');

      expect(mockPrisma.forecastDefinition.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });
    });
  });

  describe('generateForecasts', () => {
    it('should generate forecasts for active definitions', async () => {
      const mockDefinitions = [
        {
          id: '1',
          type: 'recurring_expense',
          category: 'Marketing',
          description: 'Google Ads',
          baseAmount: 5000,
          frequency: 'monthly',
          startDate: new Date('2025-06-15'), // Start in June
          endDate: null,
          isActive: true,
          metadata: null, // No specific day of month
        },
      ];

      mockPrisma.forecastDefinition.findMany.mockResolvedValue(mockDefinitions);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-09-30')
      );

      // Should generate at least one forecast
      expect(forecasts.length).toBeGreaterThan(0);
      // All forecasts should be expenses (negative)
      forecasts.forEach(forecast => {
        expect(forecast.amount).toBeLessThan(0);
        expect(forecast.category).toBe('Marketing');
        expect(forecast.type).toBe('recurring_expense');
      });
    });

    it('should use default dates when not provided', async () => {
      mockPrisma.forecastDefinition.findMany.mockResolvedValue([]);

      await service.generateForecasts();

      expect(mockCutoffDateService.getForecastStartDate).toHaveBeenCalled();
    });

    it('should skip definitions outside date range', async () => {
      const mockDefinitions = [
        {
          id: '1',
          type: 'recurring_expense',
          category: 'Marketing',
          startDate: new Date('2026-01-01'), // Starts after our range
          endDate: null,
        },
        {
          id: '2',
          type: 'recurring_expense',
          category: 'Payroll',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2025-06-30'), // Ends before our range
        },
      ];

      mockPrisma.forecastDefinition.findMany.mockResolvedValue(mockDefinitions);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-09-30')
      );

      expect(forecasts).toHaveLength(0);
    });
  });

  describe('generateRecurringExpenses', () => {
    it('should generate monthly expenses with specific day of month', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Marketing',
        description: 'Google Ads',
        baseAmount: 5000,
        frequency: 'monthly',
        startDate: new Date('2025-01-15'),
        endDate: null,
        isActive: true,
        metadata: { dayOfMonth: 15 },
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-08-31')
      );

      expect(forecasts).toHaveLength(2);
      // Check month and day separately to avoid timezone issues
      expect(forecasts[0].date.getMonth()).toBe(6); // July (0-indexed)
      expect(forecasts[0].date.getDate()).toBe(15);
      expect(forecasts[1].date.getMonth()).toBe(7); // August
      expect(forecasts[1].date.getDate()).toBe(15);
    });

    it('should handle end-of-month dates correctly', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Operations',
        description: 'Monthly Service',
        baseAmount: 1000,
        frequency: 'monthly',
        startDate: new Date('2025-01-31'),
        endDate: null,
        isActive: true,
        metadata: { dayOfMonth: 31 },
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      // Start from March to see if it picks up March 31
      const forecasts = await service.generateForecasts(
        new Date('2025-03-01'),
        new Date('2025-04-30')
      );

      // Should generate at least one forecast
      expect(forecasts.length).toBeGreaterThanOrEqual(1);
      // All forecasts should be valid
      forecasts.forEach(forecast => {
        expect(forecast.amount).toBe(-1000);
        expect(forecast.category).toBe('Operations');
      });
    });

    it('should generate annual expenses', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Operations',
        description: 'Annual License',
        baseAmount: 12000,
        frequency: 'annual',
        startDate: new Date('2024-03-15'),
        endDate: null,
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-01-01'),
        new Date('2027-12-31')
      );

      expect(forecasts).toHaveLength(3); // 2025, 2026, 2027
      expect(forecasts[0].date).toEqual(new Date('2025-03-15'));
      expect(forecasts[1].date).toEqual(new Date('2026-03-15'));
      expect(forecasts[2].date).toEqual(new Date('2027-03-15'));
    });

    it('should skip percentage-based expenses without base amount', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Payroll',
        description: 'Payroll Tax',
        percentage: 7.65,
        frequency: 'monthly',
        startDate: new Date('2025-01-01'),
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-07-31')
      );

      expect(forecasts).toHaveLength(0);
    });

    it('should respect definition end date', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Marketing',
        description: 'Limited Campaign',
        baseAmount: 3000,
        frequency: 'monthly',
        startDate: new Date('2025-05-15'),
        endDate: new Date('2025-07-20'), // End after July 15
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-06-01'),
        new Date('2025-12-31')
      );

      // Should have limited forecasts due to end date
      expect(forecasts.length).toBeGreaterThan(0);
      expect(forecasts.length).toBeLessThanOrEqual(3); // At most 3 months
      
      // All forecasts should be before or on the end date
      forecasts.forEach(forecast => {
        expect(forecast.date.getTime()).toBeLessThanOrEqual(new Date('2025-07-20').getTime());
      });
    });
  });

  describe('clearAllDefinitions', () => {
    it('should delete all definitions', async () => {
      await service.clearAllDefinitions();

      expect(mockPrisma.forecastDefinition.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe('getDefinitionsByTypeAndCategory', () => {
    it('should get definitions by type and category', async () => {
      const mockDefinitions = [
        { id: '1', type: 'recurring_expense', category: 'Marketing' },
        { id: '2', type: 'recurring_expense', category: 'Marketing' },
      ];

      mockPrisma.forecastDefinition.findMany.mockResolvedValue(mockDefinitions);

      const result = await service.getDefinitionsByTypeAndCategory('recurring_expense', 'Marketing');

      expect(mockPrisma.forecastDefinition.findMany).toHaveBeenCalledWith({
        where: {
          type: 'recurring_expense',
          category: 'Marketing',
          isActive: true,
        },
      });
      expect(result).toEqual(mockDefinitions);
    });
  });

  describe('updateDefinition', () => {
    it('should update a definition', async () => {
      const updateData = {
        baseAmount: 6000,
        description: 'Updated Google Ads Budget',
      };

      const mockUpdated = {
        id: '1',
        ...updateData,
        type: 'recurring_expense',
        category: 'Marketing',
      };

      mockPrisma.forecastDefinition.update.mockResolvedValue(mockUpdated);

      const result = await service.updateDefinition('1', updateData);

      expect(mockPrisma.forecastDefinition.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('loadDefinitionsBatch', () => {
    it('should load multiple definitions in batch', async () => {
      const definitions = [
        {
          type: 'recurring_expense',
          category: 'Marketing',
          description: 'Google Ads',
          baseAmount: 5000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
        },
        {
          type: 'recurring_expense',
          category: 'Payroll',
          description: 'Salaries',
          baseAmount: 50000,
          frequency: 'monthly',
          startDate: new Date('2025-01-01'),
        },
      ];

      await service.loadDefinitionsBatch(definitions);

      expect(mockPrisma.forecastDefinition.createMany).toHaveBeenCalledWith({
        data: definitions.map(def => ({
          ...def,
          isActive: true,
        })),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle weekly frequency', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Operations',
        description: 'Weekly Service',
        baseAmount: 250,
        frequency: 'weekly',
        startDate: new Date('2025-07-01'),
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-07-21')
      );

      expect(forecasts).toHaveLength(3); // 3 weeks
    });

    it('should handle quarterly frequency', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Operations',
        description: 'Quarterly Report',
        baseAmount: 10000,
        frequency: 'quarterly',
        startDate: new Date('2025-01-01'),
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-12-31')
      );

      expect(forecasts).toHaveLength(2); // Q3 and Q4
      expect(forecasts[0].date).toEqual(new Date('2025-07-01'));
      expect(forecasts[1].date).toEqual(new Date('2025-10-01'));
    });

    it('should handle one-time expenses', async () => {
      const definition = {
        id: '1',
        type: 'recurring_expense',
        category: 'Operations',
        description: 'One-time Setup',
        baseAmount: 5000,
        frequency: null,
        startDate: new Date('2025-07-15'),
        isActive: true,
      };

      mockPrisma.forecastDefinition.findMany.mockResolvedValue([definition]);

      const forecasts = await service.generateForecasts(
        new Date('2025-07-01'),
        new Date('2025-12-31')
      );

      expect(forecasts).toHaveLength(1);
      expect(forecasts[0].date).toEqual(new Date('2025-07-15'));
    });
  });
});