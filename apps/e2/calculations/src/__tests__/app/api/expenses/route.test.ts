// @ts-nocheck
// src/__tests__/app/api/expenses/route.test.ts
import { NextRequest } from '@/test/__mocks__/next-server';
import { mockDecimal, createMockExpense } from '@/test/testUtils';
import { startOfWeek } from 'date-fns';

// Mock Next.js server module
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('@/test/__mocks__/next-server').NextRequest,
  NextResponse: jest.requireActual('@/test/__mocks__/next-server').NextResponse,
}));

// Mock dependencies
jest.mock('@/utils/database', () => ({
  prisma: {
    expense: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('@/lib/utils/weekHelpers');

import { GET, POST } from '@/app/api/expenses/route';
import { prisma } from '@/utils/database';
import { getWeekNumber, getWeekDateRange } from '@/lib/utils/weekHelpers';

describe('/api/expenses API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock week helpers
    (getWeekNumber as jest.Mock).mockReturnValue(1);
    (getWeekDateRange as jest.Mock).mockReturnValue({
      start: new Date('2025-01-05'),
      end: new Date('2025-01-11'),
    });
  });

  describe('GET', () => {
    it('should return expenses for current year when no parameters provided', async () => {
      const mockExpenses = [
        createMockExpense({
          id: '1',
          date: new Date('2025-01-15'),
          weekStarting: startOfWeek(new Date('2025-01-15')),
          category: 'Operating Expenses',
          subcategory: 'Marketing',
          description: 'Google Ads',
          amount: mockDecimal(500),
          type: 'variable',
          vendor: 'Google',
          isRecurring: false,
          metadata: {},
        }),
        createMockExpense({
          id: '2',
          date: new Date('2025-01-20'),
          weekStarting: startOfWeek(new Date('2025-01-20')),
          category: 'Operating Expenses',
          subcategory: 'Office',
          description: 'Office supplies',
          amount: mockDecimal(200),
          type: 'fixed',
          vendor: 'Staples',
          isRecurring: false,
          metadata: {},
        }),
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const request = new NextRequest('http://localhost/api/expenses');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expenses).toHaveLength(2);
      expect(body.expenses[0]).toHaveProperty('weekStarting');
      expect(body.expenses[0].vendor).toBe('Google');
      
      // Verify date range calculation for full year
      const expectedStartDate = new Date(2025, 0, 1);
      expectedStartDate.setDate(expectedStartDate.getDate() - expectedStartDate.getDay());
      expectedStartDate.setHours(0, 0, 0, 0);
      
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: { date: 'asc' },
      });
    });

    it('should return expenses for specific quarter', async () => {
      const mockExpenses = [
        {
          id: '1',
          date: new Date('2025-01-15'),
          category: 'Operating Expenses',
          subcategory: 'Marketing',
          description: 'Q1 Marketing',
          amount: 1000,
          type: 'variable',
          vendor: null,
          isRecurring: false,
          metadata: {},
        },
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const request = new NextRequest('http://localhost/api/expenses?year=2025&quarter=1');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expenses).toHaveLength(1);
      expect(body.expenses[0].vendor).toBe('Various'); // Default when vendor is null
      
      // Verify Q1 date range
      const callArgs = (prisma.expense.findMany as jest.Mock).mock.calls[0][0];
      const startDate = callArgs.where.date.gte;
      const endDate = callArgs.where.date.lte;
      
      // Q1 should include complete weeks that overlap with Jan-Mar
      // Note: In some years, the week containing January 1 might start in December
      expect(startDate.getMonth() === 11 || startDate.getMonth() === 0).toBe(true); // December or January
      expect(endDate.getMonth()).toBeGreaterThanOrEqual(2); // Should end on or after March
    });

    it('should handle Q4 edge case spanning into next year', async () => {
      const mockExpenses = [
        {
          id: '1',
          date: new Date('2025-12-31'),
          category: 'Operating Expenses',
          subcategory: 'Year-end',
          description: 'Year-end expense',
          amount: 5000,
          type: 'fixed',
          vendor: 'Various',
          isRecurring: false,
          metadata: {},
        },
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const request = new NextRequest('http://localhost/api/expenses?year=2025&quarter=4');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expenses).toHaveLength(1);
      
      // Verify Q4 date range can extend into next year
      const callArgs = (prisma.expense.findMany as jest.Mock).mock.calls[0][0];
      const endDate = callArgs.where.date.lte;
      
      // Q4 might extend into early January of next year
      expect(endDate.getFullYear()).toBeGreaterThanOrEqual(2025);
    });

    it('should calculate correct week starting dates', async () => {
      const mockExpenses = [
        {
          id: '1',
          date: new Date('2025-01-15'), // Wednesday
          category: 'Operating Expenses',
          subcategory: 'Marketing',
          description: 'Mid-week expense',
          amount: 300,
          type: 'variable',
          vendor: 'Vendor',
          isRecurring: false,
          metadata: {},
        },
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const request = new NextRequest('http://localhost/api/expenses');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expenses).toHaveLength(1);
      
      // Week starting should be Sunday (Jan 12, 2025)
      const weekStarting = new Date(body.expenses[0].weekStarting);
      expect(weekStarting.getDay()).toBe(0); // Sunday
      expect(weekStarting.getDate()).toBe(12); // Jan 12
    });

    it('should handle empty expense list', async () => {
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/expenses?year=2025&quarter=2');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expenses).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.expense.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost/api/expenses');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch expenses');
    });

    it('should handle invalid year parameter', async () => {
      (prisma.expense.findMany as jest.Mock).mockRejectedValue(
        new Error('Invalid year parameter')
      );

      const request = new NextRequest('http://localhost/api/expenses?year=invalid');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch expenses');
    });

    it('should handle invalid quarter parameter', async () => {
      (prisma.expense.findMany as jest.Mock).mockRejectedValue(
        new Error('Invalid quarter parameter')
      );

      const request = new NextRequest('http://localhost/api/expenses?year=2025&quarter=5');
      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch expenses');
    });
  });

  describe('POST', () => {
    it('should return 400 with appropriate message', async () => {
      const request = new NextRequest('http://localhost/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          date: '2025-01-15',
          category: 'Operating Expenses',
          amount: 500,
        }),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Expenses should be added through the GL page');
    });

    it('should return 400 regardless of request body', async () => {
      const request = new NextRequest('http://localhost/api/expenses', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Expenses should be added through the GL page');
    });

    it('should return 400 even with invalid body', async () => {
      const request = new NextRequest('http://localhost/api/expenses', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Expenses should be added through the GL page');
    });
  });
});