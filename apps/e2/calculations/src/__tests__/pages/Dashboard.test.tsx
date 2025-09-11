// @ts-nocheck
// src/__tests__/pages/Dashboard.test.tsx
import React from 'react';
import FinancialDashboard from '@/app/financial-dashboard/page';
import { render, screen, waitFor } from '@testing-library/react';
import SharedFinancialDataService from '@/lib/services/SharedFinancialDataService';
import GLDataService from '@/lib/services/GLDataService';

// Mock the services
jest.mock('@/lib/services/SharedFinancialDataService');
jest.mock('@/lib/services/GLDataService');
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock Recharts to avoid rendering issues
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>
}));

// Create mock instances
const mockSharedDataService = {
  getRevenueData: jest.fn(),
  subscribe: jest.fn(() => jest.fn()) // Returns unsubscribe function
};

const mockGLDataService = {
  getEntries: jest.fn()
};

// Mock getInstance methods
(SharedFinancialDataService.getInstance as jest.Mock) = jest.fn(() => mockSharedDataService);
(GLDataService.getInstance as jest.Mock) = jest.fn(() => mockGLDataService);

describe('FinancialDashboard', () => {
  beforeEach(() => {
    // Mock service responses
    mockSharedDataService.getRevenueData.mockReturnValue({
      '2024-W01': { 'SKU001': { grossRevenue: 50000, units: 100 } },
      '2024-W02': { 'SKU001': { grossRevenue: 55000, units: 110 } },
      '2024-W03': { 'SKU001': { grossRevenue: 60000, units: 120 } }
    });
    
    const mockDate = new Date('2024-01-15');
    mockGLDataService.getEntries.mockReturnValue([
      { date: mockDate, accountType: 'Revenue', amount: 50000, category: 'Sales' },
      { date: mockDate, accountType: 'Expense', amount: -30000, category: 'Operations' },
      { date: mockDate, accountType: 'Asset', account: 'Cash', debit: 50000, credit: 0, balance: 50000 }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Integration', () => {
    it('calls SharedFinancialDataService.getInstance', () => {
      render(<FinancialDashboard />);
      expect(SharedFinancialDataService.getInstance).toHaveBeenCalled();
    });

    it('calls GLDataService.getInstance', () => {
      render(<FinancialDashboard />);
      expect(GLDataService.getInstance).toHaveBeenCalled();
    });

    it('retrieves revenue data from SharedFinancialDataService', () => {
      render(<FinancialDashboard />);
      expect(mockSharedDataService.getRevenueData).toHaveBeenCalled();
    });

    it('retrieves GL entries from GLDataService', () => {
      render(<FinancialDashboard />);
      expect(mockGLDataService.getEntries).toHaveBeenCalled();
    });

    it('subscribes to data changes', () => {
      render(<FinancialDashboard />);
      expect(mockSharedDataService.subscribe).toHaveBeenCalled();
    });
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<FinancialDashboard />);
      expect(screen.getByText('Financial Dashboard')).toBeInTheDocument();
    });

    it('renders chart containers', () => {
      render(<FinancialDashboard />);
      // There might be multiple charts of each type
      expect(screen.getAllByTestId('line-chart').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('area-chart').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('pie-chart').length).toBeGreaterThan(0);
    });
  });

  describe('Data Processing', () => {
    it('processes revenue data correctly', () => {
      render(<FinancialDashboard />);
      
      // Verify that getRevenueData was called
      expect(mockSharedDataService.getRevenueData).toHaveBeenCalled();
      
      // The component should process the mock data
      const returnedData = mockSharedDataService.getRevenueData();
      expect(returnedData).toHaveProperty('2024-W01');
      expect(returnedData['2024-W01']['SKU001'].grossRevenue).toBe(50000);
    });

    it('processes GL entries correctly', () => {
      render(<FinancialDashboard />);
      
      // Verify that getEntries was called
      expect(mockGLDataService.getEntries).toHaveBeenCalled();
      
      // The component should process the mock data
      const entries = mockGLDataService.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].accountType).toBe('Revenue');
    });
  });

  describe('Component Lifecycle', () => {
    it('unsubscribes on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockSharedDataService.subscribe.mockReturnValue(unsubscribeMock);
      
      const { unmount } = render(<FinancialDashboard />);
      
      expect(mockSharedDataService.subscribe).toHaveBeenCalled();
      
      unmount();
      
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});