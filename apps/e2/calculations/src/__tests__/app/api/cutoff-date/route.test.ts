// @ts-nocheck
// src/__tests__/app/api/cutoff-date/route.test.ts
import { NextRequest } from '@/test/__mocks__/next-server';

// Create mock before imports
const mockCutoffDateService = {
  getActiveCutoffDate: jest.fn(),
  updateCutoffDate: jest.fn(),
};

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('@/test/__mocks__/next-server').NextRequest,
  NextResponse: jest.requireActual('@/test/__mocks__/next-server').NextResponse,
}));

// Mock service
jest.mock('@/lib/services/CutoffDateService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockCutoffDateService,
  },
}));

import { GET, POST } from '@/app/api/cutoff-date/route';

describe('/api/cutoff-date API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return the active cutoff date', async () => {
      const mockDate = new Date('2025-01-15');
      mockCutoffDateService.getActiveCutoffDate.mockResolvedValue(mockDate);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.cutoffDate).toBe(mockDate.toISOString());
      expect(mockCutoffDateService.getActiveCutoffDate).toHaveBeenCalled();
    });

    it('should handle default cutoff date', async () => {
      const mockDate = new Date('2024-01-01');
      mockCutoffDateService.getActiveCutoffDate.mockResolvedValue(mockDate);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.cutoffDate).toBe(mockDate.toISOString());
    });

    it('should handle service errors gracefully', async () => {
      mockCutoffDateService.getActiveCutoffDate.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch cutoff date');
    });

    it('should handle null cutoff date', async () => {
      mockCutoffDateService.getActiveCutoffDate.mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch cutoff date');
    });
  });

  describe('POST', () => {
    it('should update cutoff date with all required fields', async () => {
      mockCutoffDateService.updateCutoffDate.mockResolvedValue(undefined);

      const requestData = {
        date: '2025-01-31',
        fileName: 'bank-statement-jan-2025.csv',
        transactionCount: 150,
        totalAmount: 25000.50,
      };

      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCutoffDateService.updateCutoffDate).toHaveBeenCalledWith(
        new Date('2025-01-31'),
        'bank-statement-jan-2025.csv',
        150,
        25000.50
      );
    });

    it('should return 400 when date is missing', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          fileName: 'bank-statement.csv',
          transactionCount: 100,
          totalAmount: 10000,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required fields');
      expect(mockCutoffDateService.updateCutoffDate).not.toHaveBeenCalled();
    });

    it('should return 400 when fileName is missing', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-31',
          transactionCount: 100,
          totalAmount: 10000,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required fields');
    });

    it('should return 400 when transactionCount is missing', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-31',
          fileName: 'bank-statement.csv',
          totalAmount: 10000,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required fields');
    });

    it('should return 400 when totalAmount is missing', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-31',
          fileName: 'bank-statement.csv',
          transactionCount: 100,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Missing required fields');
    });

    it('should handle zero values for transactionCount and totalAmount', async () => {
      mockCutoffDateService.updateCutoffDate.mockResolvedValue(undefined);

      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-31',
          fileName: 'empty-statement.csv',
          transactionCount: 0,
          totalAmount: 0,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCutoffDateService.updateCutoffDate).toHaveBeenCalledWith(
        new Date('2025-01-31'),
        'empty-statement.csv',
        0,
        0
      );
    });

    it('should handle invalid date format', async () => {
      mockCutoffDateService.updateCutoffDate.mockImplementation(() => {
        throw new Error('Invalid date');
      });

      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: 'invalid-date',
          fileName: 'bank-statement.csv',
          transactionCount: 100,
          totalAmount: 10000,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update cutoff date');
    });

    it('should handle service errors gracefully', async () => {
      mockCutoffDateService.updateCutoffDate.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-31',
          fileName: 'bank-statement.csv',
          transactionCount: 100,
          totalAmount: 10000,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update cutoff date');
    });

    it('should handle invalid JSON body', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update cutoff date');
    });

    it('should handle empty body', async () => {
      const request = new Request('http://localhost/api/cutoff-date', {
        method: 'POST',
        body: '',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to update cutoff date');
    });
  });
});