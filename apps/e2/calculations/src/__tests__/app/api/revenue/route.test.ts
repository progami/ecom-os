// @ts-nocheck
// src/__tests__/app/api/revenue/route.test.ts
import { NextRequest } from '@/test/__mocks__/next-server';

// Create mocks before imports
const mockSharedDataService = {
  getRevenue: jest.fn(),
  updateRevenue: jest.fn(),
  addRevenue: jest.fn(),
};

const mockProjectionService = {
  getProjections: jest.fn(),
  updateActuals: jest.fn(),
};

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('@/test/__mocks__/next-server').NextRequest,
  NextResponse: jest.requireActual('@/test/__mocks__/next-server').NextResponse,
}));

// Mock services to return the mock instances
jest.mock('@/services/database/SharedFinancialDataService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockSharedDataService,
  },
}));

jest.mock('@/services/database/RevenueProjectionService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockProjectionService,
  },
}));

jest.mock('@/lib/utils/weekHelpers');

import { GET, POST } from '@/app/api/revenue/route';
import { getWeekDateRange } from '@/lib/utils/weekHelpers';

describe('/api/revenue API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getWeekDateRange
    (getWeekDateRange as jest.Mock).mockReturnValue({
      start: new Date('2025-01-05'),
      end: new Date('2025-01-11')
    });
  });

  describe('GET', () => {
    it('should return revenue data for current year when no parameters provided', async () => {
      const mockRevenue = [
        {
          id: '1',
          weekStarting: '2025-01-05',
          weekEnding: '2025-01-11',
          category: 'Amazon Sales',
          subcategory: 'TS-007',
          amount: 1000,
          units: 50,
          orderCount: 10,
        },
        {
          id: '2',
          weekStarting: '2025-01-12',
          weekEnding: '2025-01-18',
          category: 'Amazon Sales',
          subcategory: 'HM-003',
          amount: 2000,
          units: 100,
          orderCount: 20,
        },
      ];

      const mockProjections = [
        {
          year: 2025,
          week: 1,
          sku: 'TS-007',
          projectedUnits: 60,
          projectedAmount: 1200,
        },
      ];

      mockSharedDataService.getRevenue.mockResolvedValue(mockRevenue);
      mockProjectionService.getProjections.mockResolvedValue(mockProjections);

      const request = new NextRequest('http://localhost/api/revenue');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('actualRevenue');
      expect(body).toHaveProperty('projections');
      expect(body.actualRevenue).toHaveLength(2);
      expect(body.projections).toEqual(mockProjections);
      expect(mockProjectionService.getProjections).toHaveBeenCalledWith(2025);
    });

    it('should filter revenue by year and quarter', async () => {
      const mockRevenue = [
        {
          id: '1',
          weekStarting: '2025-01-05',
          weekEnding: '2025-01-11',
          category: 'Amazon Sales',
          subcategory: 'TS-007',
          amount: 1000,
          units: 50,
        },
        {
          id: '2',
          weekStarting: '2025-04-06',
          weekEnding: '2025-04-12',
          category: 'Amazon Sales',
          subcategory: 'HM-003',
          amount: 2000,
          units: 100,
        },
      ];

      mockSharedDataService.getRevenue.mockResolvedValue(mockRevenue);
      mockProjectionService.getProjections.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/revenue?year=2025&quarter=1');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.actualRevenue).toHaveLength(1);
      expect(body.actualRevenue[0].subcategory).toBe('TS-007');
    });

    it('should handle service errors gracefully', async () => {
      mockSharedDataService.getRevenue.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/revenue');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch revenue');
    });
  });

  describe('POST', () => {
    describe('updateActual action', () => {
      it('should update existing revenue entry', async () => {
        const mockExistingRevenue = [
          {
            id: '1',
            weekStarting: '2025-01-05',
            subcategory: 'TS-007',
            amount: 1000,
            units: 50,
            metadata: { isActual: false },
          },
        ];

        mockSharedDataService.getRevenue.mockResolvedValue(mockExistingRevenue);
        mockSharedDataService.updateRevenue.mockResolvedValue(undefined);
        mockProjectionService.updateActuals.mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost/api/revenue', {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateActual',
            data: {
              year: 2025,
              week: 1,
              sku: 'TS-007',
              units: 60,
              amount: 1200,
            },
          }),
        });

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSharedDataService.updateRevenue).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            units: 60,
            amount: 1200,
            metadata: expect.objectContaining({
              isActual: true,
            }),
          })
        );
        expect(mockProjectionService.updateActuals).toHaveBeenCalledWith(2025, 1, 'TS-007', 60, 1200);
      });

      it('should create new revenue entry when none exists', async () => {
        mockSharedDataService.getRevenue.mockResolvedValue([]);
        mockSharedDataService.addRevenue.mockResolvedValue(undefined);
        mockProjectionService.updateActuals.mockResolvedValue(undefined);

        const request = new NextRequest('http://localhost/api/revenue', {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateActual',
            data: {
              year: 2025,
              week: 1,
              sku: 'TS-007',
              units: 60,
              amount: 1200,
            },
          }),
        });

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSharedDataService.addRevenue).toHaveBeenCalledWith(
          expect.objectContaining({
            weekStarting: '2025-01-05T00:00:00.000Z',
            weekEnding: '2025-01-11T00:00:00.000Z',
            category: 'Amazon Sales',
            subcategory: 'TS-007',
            amount: 1200,
            units: 60,
            orderCount: 12, // Math.round(60 / 5)
            metadata: expect.objectContaining({
              isActual: true,
              source: 'revenue-page-edit',
            }),
          })
        );
      });
    });

    describe('syncProjections action', () => {
      it('should sync projections successfully', async () => {
        const request = new NextRequest('http://localhost/api/revenue', {
          method: 'POST',
          body: JSON.stringify({
            action: 'syncProjections',
            data: {
              year: 2025,
              startWeek: 1,
              endWeek: 4,
            },
          }),
        });

        const response = await POST(request as any);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
      });
    });

    it('should return 400 for invalid action', async () => {
      const request = new NextRequest('http://localhost/api/revenue', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalidAction',
          data: {},
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid action');
    });

    it('should handle service errors gracefully', async () => {
      mockSharedDataService.getRevenue.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/revenue', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateActual',
          data: {
            year: 2025,
            week: 1,
            sku: 'TS-007',
            units: 60,
            amount: 1200,
          },
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update revenue');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/revenue', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update revenue');
    });
  });
});