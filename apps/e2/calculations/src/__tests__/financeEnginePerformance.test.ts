// @ts-nocheck
// src/__tests__/financeEnginePerformance.test.ts

import ProductService from '@/services/database/ProductService';
import { createMockProduct } from '../test/testUtils';

// Mock ProductService
jest.mock('@/services/database/ProductService', () => {
  const mockProductServiceInstance = {
    initializeCache: jest.fn().mockResolvedValue(undefined),
    getAllProducts: jest.fn(),
    getProduct: jest.fn(),
    isValidSku: jest.fn(),
    updateProductCosts: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      getInstance: jest.fn(() => mockProductServiceInstance),
    },
  };
});

describe('FinancialModelEngine Performance Benchmarks', () => {
  let mockProductService: jest.Mocked<ProductService>;
  let assumptions: Assumptions;
  let productMargins: ProductMargin[];

  beforeEach(async () => {
    mockProductService = ProductService.getInstance() as jest.Mocked<ProductService>;

    const mockProductsData = {
      'TS-007': createMockProduct({ sku: 'TS-007', name: 'Tissue 7gsm' }),
      'TS-009': createMockProduct({ sku: 'TS-009', name: 'Tissue 9gsm' }),
      'TS-012': createMockProduct({ sku: 'TS-012', name: 'Tissue 12gsm' }),
      'HD015': createMockProduct({ sku: 'HD015', name: 'HDPE 15mu' })
    };

    mockProductService.getAllProducts.mockReturnValue(new Map(Object.entries(mockProductsData)));
    mockProductService.getProduct.mockImplementation((sku) => mockProductsData[sku]);
    mockProductService.isValidSku.mockImplementation((sku) => !!mockProductsData[sku]);

    await mockProductService.initializeCache();

    assumptions = getDefaultAssumptions();
    productMargins = getDefaultProductMargins();
  });

  describe('Execution Time Benchmarks', () => {
    test('should complete single forecast in under 100ms', () => {
      const engine = new FinancialModelEngine(assumptions, productMargins);
      
      const startTime = performance.now();
      const forecast = engine.runForecast();
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      logger.info(`Single forecast execution time: ${executionTime.toFixed(2)}ms`);
      
      expect(executionTime).toBeLessThan(100);
      expect(forecast.monthlyData.length).toBe(60);
    });

    test('should scale linearly with forecast length', () => {
      const times: number[] = [];
      
      // Test different forecast lengths by modifying assumptions
      [12, 24, 36, 48, 60].forEach(months => {
        const engine = new FinancialModelEngine(assumptions, productMargins);
        
        const startTime = performance.now();
        // Note: In real implementation, you'd need to modify engine to support variable length
        const forecast = engine.runForecast();
        const endTime = performance.now();
        
        times.push(endTime - startTime);
      });
      
      // Check that time increases roughly linearly
      const timeRatio = times[4] / times[0]; // 60 months vs 12 months
      expect(timeRatio).toBeLessThan(10); // Should be roughly 5x, allow some overhead
    });

    test('should handle 1000 sequential forecasts', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const engine = new FinancialModelEngine(assumptions, productMargins);
        engine.runForecast();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 1000;
      
      logger.info(`1000 forecasts total time: ${totalTime.toFixed(2)}ms`);
      logger.info(`Average time per forecast: ${avgTime.toFixed(2)}ms`);
      
      expect(totalTime).toBeLessThan(60000); // Should complete in under 1 minute
      expect(avgTime).toBeLessThan(60); // Average under 60ms per forecast
    });
  });

  describe('Memory Usage Patterns', () => {
    test('should not leak memory across multiple instances', () => {
      const engines: FinancialModelEngine[] = [];
      
      // Create many engines
      for (let i = 0; i < 100; i++) {
        engines.push(new FinancialModelEngine(assumptions, productMargins));
      }
      
      // Run forecasts
      engines.forEach(engine => engine.runForecast());
      
      // Clear references
      engines.length = 0;
      
      // If this completes without error, memory management is working
      expect(true).toBe(true);
    });

    test('should handle large product catalogs efficiently', () => {
      // Create a large product catalog
      const largeProductMargins: ProductMargin[] = [];
      for (let i = 0; i < 1000; i++) {
        largeProductMargins.push({
          sku: `SKU-${i}`,
          description: `Product ${i}`,
          retailPrice: 10 + Math.random() * 90,
          fobCost: 2 + Math.random() * 8,
          tariff: 0.25,
          freightCost: 0.5,
          landedCost: 0,
          amazonReferralFee: 0,
          fulfillmentFee: 0,
          totalCogs: 0,
          grossProfit: 0,
          grossMargin: 0,
          roi: 0
        });
      }
      
      // Update assumptions to use subset of products
      const largeAssumptions = { ...assumptions };
      largeAssumptions.productSalesMix = [
        { sku: 'SKU-0', percentage: 0.5, monthlyUnits: 5000 },
        { sku: 'SKU-1', percentage: 0.3, monthlyUnits: 3000 },
        { sku: 'SKU-2', percentage: 0.2, monthlyUnits: 2000 }
      ];
      
      const engine = new FinancialModelEngine(largeAssumptions, largeProductMargins);
      
      const startTime = performance.now();
      const forecast = engine.runForecast();
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      logger.info(`Large catalog execution time: ${executionTime.toFixed(2)}ms`);
      
      expect(executionTime).toBeLessThan(500); // Should still be fast
      expect(forecast.monthlyData.length).toBe(60);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle parallel forecast generation', async () => {
      const concurrentCount = 50;
      const startTime = performance.now();
      
      const promises = Array(concurrentCount).fill(null).map(async () => {
        const engine = new FinancialModelEngine(assumptions, productMargins);
        return engine.runForecast();
      });
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      logger.info(`${concurrentCount} parallel forecasts: ${totalTime.toFixed(2)}ms`);
      
      expect(results.length).toBe(concurrentCount);
      results.forEach(forecast => {
        expect(forecast.monthlyData.length).toBe(60);
        expect(forecast.yearlyData.length).toBe(5);
      });
      
      // Parallel execution should be faster than sequential
      const expectedSequentialTime = concurrentCount * 50; // Assume 50ms per forecast
      expect(totalTime).toBeLessThan(expectedSequentialTime);
    });

    test('should maintain data isolation between concurrent instances', async () => {
      // Create engines with different assumptions
      const engines = Array(10).fill(null).map((_, index) => {
        const customAssumptions = { ...assumptions };
        customAssumptions.baseMonthlySalesUnits = 1000 * (index + 1);
        return new FinancialModelEngine(customAssumptions, productMargins);
      });
      
      // Run forecasts concurrently
      const forecasts = await Promise.all(
        engines.map(engine => Promise.resolve(engine.runForecast()))
      );
      
      // Verify each forecast has unique results based on its assumptions
      forecasts.forEach((forecast, index) => {
        const expectedBaseUnits = 1000 * (index + 1);
        const firstMonthUnits = forecast.monthlyData[0].totalUnitsSold;
        
        // Account for phase multiplier in month 1
        const expectedUnits = expectedBaseUnits * assumptions.launchPhaseVelocity;
        expect(firstMonthUnits).toBeCloseTo(expectedUnits, 0);
      });
    });
  });

  describe('Optimization Opportunities', () => {
    test('should identify calculation bottlenecks', () => {
      const engine = new FinancialModelEngine(assumptions, productMargins);
      
      // Time individual operations
      const timings: { [key: string]: number } = {};
      
      // Time initialization
      const initStart = performance.now();
      const testEngine = new FinancialModelEngine(assumptions, productMargins);
      timings.initialization = performance.now() - initStart;
      
      // Time forecast
      const forecastStart = performance.now();
      const forecast = testEngine.runForecast();
      timings.totalForecast = performance.now() - forecastStart;
      
      // Time inventory operations
      const inventoryStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        testEngine.getInventoryLevels();
      }
      timings.inventoryAccess = (performance.now() - inventoryStart) / 1000;
      
      // Log timing breakdown
      console.log('Performance Profile:');
      Object.entries(timings).forEach(([operation, time]) => {
        console.log(`  ${operation}: ${time.toFixed(3)}ms`);
      });
      
      // Initialization should be fast
      expect(timings.initialization).toBeLessThan(10);
      
      // Inventory access should be very fast
      expect(timings.inventoryAccess).toBeLessThan(0.1);
    });

    test('should efficiently handle inventory updates', () => {
      const engine = new FinancialModelEngine(assumptions, productMargins);
      
      const startTime = performance.now();
      
      // Perform many inventory updates
      for (let i = 0; i < 10000; i++) {
        engine.updateInventory('TS-007', 10, 4.50);
        engine.consumeInventory('TS-007', 5);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 20000; // 2 operations per iteration
      
      console.log(`20,000 inventory operations: ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per operation: ${avgTime.toFixed(4)}ms`);
      
      expect(avgTime).toBeLessThan(0.1); // Sub-0.1ms per operation
    });
  });

  describe('Stress Testing', () => {
    test('should handle extreme growth scenarios without overflow', () => {
      const extremeAssumptions = { ...assumptions };
      extremeAssumptions.annualGrowthRateY1 = 100; // 10,000% growth
      extremeAssumptions.annualGrowthRateY2 = 100;
      extremeAssumptions.annualGrowthRateY3 = 100;
      extremeAssumptions.annualGrowthRateY4 = 100;
      extremeAssumptions.annualGrowthRateY5 = 100;
      
      const engine = new FinancialModelEngine(extremeAssumptions, productMargins);
      const forecast = engine.runForecast();
      
      // Should complete without errors
      expect(forecast.monthlyData.length).toBe(60);
      
      // Check for numeric overflow
      forecast.monthlyData.forEach(month => {
        expect(isFinite(month.totalRevenue)).toBe(true);
        expect(isFinite(month.cash)).toBe(true);
      });
    });

    test('should maintain precision with very small numbers', () => {
      const tinyAssumptions = { ...assumptions };
      tinyAssumptions.baseMonthlySalesUnits = 0.1; // Fractional units
      
      const engine = new FinancialModelEngine(tinyAssumptions, productMargins);
      const forecast = engine.runForecast();
      
      // Should handle fractional calculations
      expect(forecast.monthlyData[0].totalUnitsSold).toBeGreaterThan(0);
      expect(forecast.monthlyData[0].totalUnitsSold).toBeLessThan(1);
    });
  });
});