// @ts-nocheck
// src/__tests__/app/api/gl/entries/route.test.ts
import { NextRequest } from '@/test/__mocks__/next-server';

// Create mock before imports
const mockGLEntryService = {
  getEntries: jest.fn(),
  getEntriesByDateRange: jest.fn(),
  setEntries: jest.fn(),
  addEntry: jest.fn(),
};

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('@/test/__mocks__/next-server').NextRequest,
  NextResponse: jest.requireActual('@/test/__mocks__/next-server').NextResponse,
}));

// Mock dependencies
jest.mock('@/utils/database');
jest.mock('@/services/database/GLEntryService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockGLEntryService,
  },
}));

import { GET, POST, PUT } from '@/app/api/gl/entries/route';

describe('/api/gl/entries API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return all GL entries when no date range is provided', async () => {
      const mockEntries = [
        {
          id: '1',
          date: '2025-01-15',
          accountCode: '4000',
          accountName: 'Revenue',
          debit: 0,
          credit: 1000,
          description: 'Sales revenue',
        },
        {
          id: '2',
          date: '2025-01-16',
          accountCode: '1000',
          accountName: 'Cash',
          debit: 1000,
          credit: 0,
          description: 'Cash receipt',
        },
      ];

      mockGLEntryService.getEntries.mockResolvedValue(mockEntries);

      const request = new NextRequest('http://localhost/api/gl/entries');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.entries).toEqual(mockEntries);
      expect(mockGLEntryService.getEntries).toHaveBeenCalled();
      expect(mockGLEntryService.getEntriesByDateRange).not.toHaveBeenCalled();
    });

    it('should return GL entries within date range when dates are provided', async () => {
      const mockEntries = [
        {
          id: '1',
          date: '2025-01-15',
          accountCode: '4000',
          accountName: 'Revenue',
          debit: 0,
          credit: 1000,
          description: 'Sales revenue',
        },
      ];

      mockGLEntryService.getEntriesByDateRange.mockResolvedValue(mockEntries);

      const request = new NextRequest(
        'http://localhost/api/gl/entries?startDate=2025-01-01&endDate=2025-01-31'
      );
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.entries).toEqual(mockEntries);
      expect(mockGLEntryService.getEntriesByDateRange).toHaveBeenCalledWith(
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      expect(mockGLEntryService.getEntries).not.toHaveBeenCalled();
    });

    it('should handle partial date parameters by fetching all entries', async () => {
      const mockEntries = [
        {
          id: '1',
          date: '2025-01-15',
          accountCode: '4000',
          accountName: 'Revenue',
          debit: 0,
          credit: 1000,
        },
      ];

      mockGLEntryService.getEntries.mockResolvedValue(mockEntries);

      const request = new NextRequest('http://localhost/api/gl/entries?startDate=2025-01-01');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.entries).toEqual(mockEntries);
      expect(mockGLEntryService.getEntries).toHaveBeenCalled();
      expect(mockGLEntryService.getEntriesByDateRange).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockGLEntryService.getEntries.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/gl/entries');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch GL entries');
    });
  });

  describe('POST', () => {
    it('should save multiple GL entries successfully', async () => {
      const mockEntries = [
        {
          date: '2025-01-15',
          accountCode: '4000',
          accountName: 'Revenue',
          debit: 0,
          credit: 1000,
          description: 'Sales revenue',
        },
        {
          date: '2025-01-15',
          accountCode: '1000',
          accountName: 'Cash',
          debit: 1000,
          credit: 0,
          description: 'Cash receipt',
        },
      ];

      mockGLEntryService.setEntries.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: JSON.stringify({ entries: mockEntries }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Saved 2 GL entries');
      expect(mockGLEntryService.setEntries).toHaveBeenCalledWith(mockEntries);
    });

    it('should return 400 when entries is not provided', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid entries data');
      expect(mockGLEntryService.setEntries).not.toHaveBeenCalled();
    });

    it('should return 400 when entries is not an array', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: JSON.stringify({ entries: 'not an array' }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid entries data');
      expect(mockGLEntryService.setEntries).not.toHaveBeenCalled();
    });

    it('should handle empty entries array', async () => {
      mockGLEntryService.setEntries.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: JSON.stringify({ entries: [] }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Saved 0 GL entries');
      expect(mockGLEntryService.setEntries).toHaveBeenCalledWith([]);
    });

    it('should handle service errors gracefully', async () => {
      mockGLEntryService.setEntries.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: JSON.stringify({ entries: [{ date: '2025-01-15' }] }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to save GL entries');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to save GL entries');
    });
  });

  describe('PUT', () => {
    it('should add a single GL entry successfully', async () => {
      const mockEntry = {
        date: '2025-01-15',
        accountCode: '4000',
        accountName: 'Revenue',
        debit: 0,
        credit: 1000,
        description: 'Sales revenue',
      };

      mockGLEntryService.addEntry.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'PUT',
        body: JSON.stringify({ entry: mockEntry }),
      });

      const response = await PUT(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Added GL entry');
      expect(mockGLEntryService.addEntry).toHaveBeenCalledWith(mockEntry);
    });

    it('should return 400 when entry is not provided', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid entry data');
      expect(mockGLEntryService.addEntry).not.toHaveBeenCalled();
    });

    it('should handle null entry', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'PUT',
        body: JSON.stringify({ entry: null }),
      });

      const response = await PUT(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid entry data');
      expect(mockGLEntryService.addEntry).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockGLEntryService.addEntry.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'PUT',
        body: JSON.stringify({ entry: { date: '2025-01-15' } }),
      });

      const response = await PUT(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to add GL entry');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/gl/entries', {
        method: 'PUT',
        body: 'invalid json',
      });

      const response = await PUT(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to add GL entry');
    });
  });
});