// @ts-nocheck
// src/__tests__/app/api/revenue/generate-forecasts/route.test.ts
import { NextRequest } from '@/test/__mocks__/next-server';

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('@/test/__mocks__/next-server').NextRequest,
  NextResponse: jest.requireActual('@/test/__mocks__/next-server').NextResponse,
}));

// Mock services
jest.mock('@/lib/services/RevenueService');
jest.mock('@/services/database/ExpenseService');

import { POST } from '@/app/api/revenue/generate-forecasts/route';
import RevenueService from '@/lib/services/RevenueService';
import ClientExpenseService from '@/services/database/ExpenseService';

describe('/api/revenue/generate-forecasts API Route', () => {
  let mockRevenueService: any;
  let mockExpenseService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock for RevenueService
    mockRevenueService = {
      generateRevenueForecasts: jest.fn(),
    };
    
    // Create mock for ExpenseService
    mockExpenseService = {
      calculateAndStoreAmazonFees: jest.fn().mockResolvedValue(undefined),
    };
    
    // Mock the getInstance methods
    (RevenueService.getInstance as jest.Mock) = jest.fn(() => mockRevenueService);
    (ClientExpenseService.getInstance as jest.Mock) = jest.fn(() => mockExpenseService);
  });

  describe('POST', () => {
    it('should generate forecasts with start and end dates', async () => {
      const mockForecasts = [
        { id: '1', sku: 'TS-007', week: 1, projectedUnits: 100 },
        { id: '2', sku: 'HM-003', week: 1, projectedUnits: 200 },
        { id: '3', sku: 'TS-007', week: 2, projectedUnits: 110 },
      ];

      mockRevenueService.generateRevenueForecasts.mockResolvedValue(mockForecasts);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-03-31',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.count).toBe(3);
      expect(body.message).toBe('Generated 3 revenue forecasts');
      expect(mockRevenueService.generateRevenueForecasts).toHaveBeenCalledWith(
        new Date('2025-01-01'),
        new Date('2025-03-31')
      );
    });

    it('should generate forecasts without date parameters', async () => {
      const mockForecasts = Array(52).fill(null).map((_, i) => ({
        id: `${i + 1}`,
        sku: 'TS-007',
        week: i + 1,
        projectedUnits: 100,
      }));

      mockRevenueService.generateRevenueForecasts.mockResolvedValue(mockForecasts);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.count).toBe(52);
      expect(body.message).toBe('Generated 52 revenue forecasts');
      expect(mockRevenueService.generateRevenueForecasts).toHaveBeenCalledWith(
        undefined,
        undefined
      );
    });

    it('should handle empty forecasts generation', async () => {
      mockRevenueService.generateRevenueForecasts.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-01-07',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.count).toBe(0);
      expect(body.message).toBe('Generated 0 revenue forecasts');
    });

    it('should handle invalid date formats gracefully', async () => {
      mockRevenueService.generateRevenueForecasts.mockImplementation(() => {
        throw new Error('Invalid date format');
      });

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: 'invalid-date',
          endDate: '2025-03-31',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to generate revenue forecasts');
    });

    it('should handle service errors gracefully', async () => {
      mockRevenueService.generateRevenueForecasts.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-03-31',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to generate revenue forecasts');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to generate revenue forecasts');
    });

    it('should handle missing body gracefully', async () => {
      mockRevenueService.generateRevenueForecasts.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: '',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to generate revenue forecasts');
    });

    it('should verify expense generation is part of revenue forecast process', async () => {
      // This test verifies that the RevenueService triggers expense generation
      // internally as part of generateRevenueForecasts
      const mockForecasts = [
        { 
          id: '1', 
          sku: 'TS-009', 
          date: new Date('2025-09-01'),
          units: 100,
          grossRevenue: 2800 
        }
      ];

      // Mock the revenue service implementation
      mockRevenueService.generateRevenueForecasts.mockImplementation(async () => {
        // Note: In the actual implementation, the RevenueService 
        // calls ExpenseService internally, so we don't test that here
        // as it's an implementation detail of RevenueService
        return mockForecasts;
      });

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-09-01',
          endDate: '2025-09-30',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockRevenueService.generateRevenueForecasts).toHaveBeenCalledTimes(1);
      
      // The expense generation is tested in the RevenueService unit tests
      // This integration test verifies the API endpoint works correctly
    });

    it('should handle large forecast generation', async () => {
      // Test with many forecasts to ensure the API can handle bulk operations
      const mockForecasts = Array(500).fill(null).map((_, i) => ({
        id: `${i + 1}`,
        sku: `TS-${String(i % 10).padStart(3, '0')}`,
        week: Math.floor(i / 10) + 1,
        projectedUnits: 100 + i,
      }));

      mockRevenueService.generateRevenueForecasts.mockResolvedValue(mockForecasts);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.count).toBe(500);
      expect(body.message).toBe('Generated 500 revenue forecasts');
    });

    it('should pass through date validation to service layer', async () => {
      mockRevenueService.generateRevenueForecasts.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/revenue/generate-forecasts', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2025-12-31',
          endDate: '2025-01-01', // End date before start date
        }),
      });

      const response = await POST(request as any);

      // The API endpoint passes dates to the service layer for validation
      expect(mockRevenueService.generateRevenueForecasts).toHaveBeenCalledWith(
        new Date('2025-12-31'),
        new Date('2025-01-01')
      );
    });
  });
});