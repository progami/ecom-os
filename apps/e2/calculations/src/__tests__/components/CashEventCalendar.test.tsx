// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CashEventCalendar from '@/components/CashEventCalendar';
import { CashEvent } from '@/types/financial';

describe('CashEventCalendar', () => {
  const mockEvents: CashEvent[] = [
    {
      id: '1',
      date: '2025-01-15',
      type: 'inflow',
      category: 'revenue',
      description: 'Amazon Settlement',
      amount: 15000,
      status: 'scheduled',
    },
    {
      id: '2',
      date: '2025-01-20',
      type: 'outflow',
      category: 'payroll',
      description: 'Monthly Payroll',
      amount: 8000,
      status: 'scheduled',
    },
    {
      id: '3',
      date: '2025-01-25',
      type: 'outflow',
      category: 'inventory',
      description: 'Inventory Purchase',
      amount: 12000,
      status: 'completed',
      relatedPO: 'PO-001',
    },
    {
      id: '4',
      date: '2025-02-10',
      type: 'inflow',
      category: 'revenue',
      description: 'Customer Payment',
      amount: 5000,
      status: 'scheduled',
    },
  ];

  beforeEach(() => {
    // Mock current date to January 2025
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-10'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render the calendar with header', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    expect(screen.getByText('Cash Event Calendar')).toBeInTheDocument();
    expect(screen.getByText('Track scheduled payments and receipts')).toBeInTheDocument();
  });

  it('should display month selector with 12 months', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    // Get the first select element which is the month selector
    const monthSelector = screen.getAllByRole('combobox')[0];
    const options = within(monthSelector).getAllByRole('option');
    
    expect(options).toHaveLength(12);
    expect(options[0]).toHaveTextContent('January 2025');
    expect(options[11]).toHaveTextContent('December 2025');
  });

  it('should display type and category filters', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3); // month, type, category
    
    // Check type filter options
    const typeFilter = selects[1];
    expect(within(typeFilter).getByText('All Types')).toBeInTheDocument();
    expect(within(typeFilter).getByText('Inflows')).toBeInTheDocument();
    expect(within(typeFilter).getByText('Outflows')).toBeInTheDocument();
  });

  it('should calculate and display monthly summary', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    // January has 1 inflow (15000) and 2 outflows (8000 + 12000)
    expect(screen.getByText('Monthly Inflows')).toBeInTheDocument();
    expect(screen.getAllByText('$15,000')[0]).toBeInTheDocument();
    
    expect(screen.getByText('Monthly Outflows')).toBeInTheDocument();
    expect(screen.getByText('$20,000')).toBeInTheDocument();
    
    expect(screen.getByText('Net Cash Flow')).toBeInTheDocument();
    // Net cash flow shows negative value
    expect(screen.getByText(/\$-5,000/)).toBeInTheDocument();
  });

  it('should render calendar grid with correct days', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    // Check day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
    
    // January 2025 starts on Wednesday, so check for day 1
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('should display events on calendar days', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    // Find day 15 which has an event
    const day15Container = screen.getByText('15').parentElement;
    // The text is split across multiple elements, check for both
    expect(within(day15Container!).getByText(/\$15k/)).toBeInTheDocument();
    expect(within(day15Container!).getByText(/Amazon Settleme/)).toBeInTheDocument();
  });

  it('should filter events by type', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    const typeFilter = screen.getAllByRole('combobox')[1]; // Second select is type filter
    
    // Filter to show only inflows
    fireEvent.change(typeFilter, { target: { value: 'inflow' } });
    
    // Should only show the Amazon Settlement in January
    expect(screen.getByText('2025-01 Events (1)')).toBeInTheDocument();
    expect(screen.getByText('Amazon Settlement')).toBeInTheDocument();
    expect(screen.queryByText('Monthly Payroll')).not.toBeInTheDocument();
  });

  it('should filter events by category', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    const categoryFilter = screen.getAllByRole('combobox')[2]; // Third select is category
    
    // Filter to show only payroll
    fireEvent.change(categoryFilter, { target: { value: 'payroll' } });
    
    expect(screen.getByText('2025-01 Events (1)')).toBeInTheDocument();
    expect(screen.getByText('Monthly Payroll')).toBeInTheDocument();
    expect(screen.queryByText('Amazon Settlement')).not.toBeInTheDocument();
  });

  it('should change month and update events', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    const monthSelector = screen.getAllByRole('combobox')[0]; // First select is month
    
    // Change to February
    fireEvent.change(monthSelector, { target: { value: '2025-02' } });
    
    // Should show February event
    expect(screen.getByText('2025-02 Events (1)')).toBeInTheDocument();
    expect(screen.getByText('Customer Payment')).toBeInTheDocument();
    expect(screen.queryByText('Amazon Settlement')).not.toBeInTheDocument();
  });

  it('should display event details in list', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    const inventoryEvent = screen.getByText('Inventory Purchase').closest('.flex');
    
    expect(within(inventoryEvent!).getByText(/↑ outflow/)).toBeInTheDocument();
    expect(within(inventoryEvent!).getByText('Inventory')).toBeInTheDocument();
    expect(within(inventoryEvent!).getByText('✓ Completed')).toBeInTheDocument();
    expect(within(inventoryEvent!).getByText(/PO: PO-001/)).toBeInTheDocument();
    expect(within(inventoryEvent!).getByText('$12,000')).toBeInTheDocument();
  });

  it('should show empty state when no events', () => {
    render(<CashEventCalendar events={[]} />);
    
    expect(screen.getByText('No events scheduled for this period')).toBeInTheDocument();
    expect(screen.getByText(/2025-01 Events \(0\)/)).toBeInTheDocument();
  });

  it('should handle multiple events on same day', () => {
    const sameDayEvents: CashEvent[] = [
      ...mockEvents,
      {
        id: '5',
        date: '2025-01-15',
        type: 'outflow',
        category: 'operations',
        description: 'Office Rent',
        amount: 3000,
        status: 'scheduled',
      },
      {
        id: '6',
        date: '2025-01-15',
        type: 'outflow',
        category: 'operations',
        description: 'Utilities',
        amount: 500,
        status: 'scheduled',
      },
      {
        id: '7',
        date: '2025-01-15',
        type: 'outflow',
        category: 'operations',
        description: 'Insurance',
        amount: 1000,
        status: 'scheduled',
      },
      {
        id: '8',
        date: '2025-01-15',
        type: 'outflow',
        category: 'operations',
        description: 'Software Subscriptions',
        amount: 800,
        status: 'scheduled',
      },
    ];
    
    render(<CashEventCalendar events={sameDayEvents} />);
    
    // Find day 15
    const day15Container = screen.getByText('15').parentElement;
    
    // Should show first 3 events and "+2 more"
    expect(within(day15Container!).getByText('+2 more')).toBeInTheDocument();
  });

  it('should format large amounts correctly', () => {
    const largeAmountEvent: CashEvent = {
      id: '9',
      date: '2025-01-10',
      type: 'inflow',
      category: 'investment',
      description: 'Series A Funding',
      amount: 1500000,
      status: 'completed',
    };
    
    render(<CashEventCalendar events={[largeAmountEvent]} />);
    
    // In calendar: shows as $1500k with truncated description
    const day10Container = screen.getByText('10').parentElement;
    expect(within(day10Container!).getByText(/\$1500k/)).toBeInTheDocument();
    
    // In list: shows full amount
    expect(screen.getAllByText('$1,500,000')[0]).toBeInTheDocument();
  });

  it('should apply correct styling for inflows and outflows', () => {
    render(<CashEventCalendar events={mockEvents} />);
    
    // Check for the inflow/outflow badges in the event list
    const inflowBadges = screen.getAllByText(/↓ inflow/);
    const outflowBadges = screen.getAllByText(/↑ outflow/);
    
    expect(inflowBadges.length).toBeGreaterThan(0);
    expect(outflowBadges.length).toBeGreaterThan(0);
    
    // Check styling on badges - they are the span elements themselves
    expect(inflowBadges[0]).toHaveClass('bg-green-100', 'text-green-800');
    expect(outflowBadges[0]).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should update net cash flow styling based on positive/negative', () => {
    // Test with positive net flow
    const positiveEvents: CashEvent[] = [
      {
        id: '1',
        date: '2025-01-15',
        type: 'inflow',
        category: 'revenue',
        description: 'Large Payment',
        amount: 50000,
        status: 'scheduled',
      },
    ];
    
    const { rerender } = render(<CashEventCalendar events={positiveEvents} />);
    
    let netFlowElement = screen.getByText('Net Cash Flow').closest('div');
    expect(netFlowElement).toHaveClass('bg-blue-50');
    
    // Test with negative net flow
    const negativeEvents: CashEvent[] = [
      {
        id: '2',
        date: '2025-01-15',
        type: 'outflow',
        category: 'expense',
        description: 'Large Expense',
        amount: 50000,
        status: 'scheduled',
      },
    ];
    
    rerender(<CashEventCalendar events={negativeEvents} />);
    
    netFlowElement = screen.getByText('Net Cash Flow').closest('div');
    expect(netFlowElement).toHaveClass('bg-yellow-50');
  });
});