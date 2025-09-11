// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryDashboard from '@/components/InventoryDashboard';
import { InventoryStatus } from '@/types/financial';

describe('InventoryDashboard', () => {
  const mockInventory: InventoryStatus[] = [
    {
      sku: 'TS-001',
      description: 'T-Shirt Black Small',
      unitsOnHand: 500,
      unitsInTransit: 200,
      unitCost: 15.50,
      totalValue: 7750,
      daysOfSupply: 45,
      reorderPoint: 300,
      needsReorder: false,
    },
    {
      sku: 'TS-002',
      description: 'T-Shirt Black Medium',
      unitsOnHand: 150,
      unitsInTransit: 0,
      unitCost: 15.50,
      totalValue: 2325,
      daysOfSupply: 12,
      reorderPoint: 400,
      needsReorder: true,
    },
    {
      sku: 'TS-003',
      description: 'T-Shirt Black Large',
      unitsOnHand: 800,
      unitsInTransit: 100,
      unitCost: 15.50,
      totalValue: 12400,
      daysOfSupply: 60,
      reorderPoint: 350,
      needsReorder: false,
    },
    {
      sku: 'TS-004',
      description: 'T-Shirt Black XL',
      unitsOnHand: 100,
      unitsInTransit: 0,
      unitCost: 15.50,
      totalValue: 1550,
      daysOfSupply: 8,
      reorderPoint: 200,
      needsReorder: true,
    },
  ];

  it('should render summary cards with correct totals', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Total inventory value: 7750 + 2325 + 12400 + 1550 = 24,025
    expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
    expect(screen.getAllByText('$24,025')[0]).toBeInTheDocument();

    // Total units on hand: 500 + 150 + 800 + 100 = 1,550
    expect(screen.getByText('Total Units on Hand')).toBeInTheDocument();
    expect(screen.getByText('1,550')).toBeInTheDocument();

    // Units in transit: 200 + 0 + 100 + 0 = 300
    expect(screen.getByText('Units in Transit')).toBeInTheDocument();
    expect(screen.getAllByText('300')[0]).toBeInTheDocument();

    // Items needing reorder: 2 (TS-002 and TS-004)
    expect(screen.getByText('Items Need Reorder')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render inventory turnover analysis', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Average days of supply: (45 + 12 + 60 + 8) / 4 = 31.25 ≈ 31
    expect(screen.getByText('Average Days of Supply')).toBeInTheDocument();
    expect(screen.getByText('31 days')).toBeInTheDocument();

    // Inventory turnover rate: 365 / 31.25 ≈ 11.7
    expect(screen.getByText('Inventory Turnover Rate')).toBeInTheDocument();
    expect(screen.getByText('11.7x / year')).toBeInTheDocument();

    // Working capital
    expect(screen.getByText('Working Capital in Inventory')).toBeInTheDocument();
  });

  it('should render inventory table with all items', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Check table headers
    expect(screen.getByText('SKU / Description')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // Table headers may have multiple "Total Value" text elements
    const tableHeaders = screen.getByRole('table').querySelector('thead');
    expect(within(tableHeaders!).getByText('On Hand')).toBeInTheDocument();
    expect(within(tableHeaders!).getByText('In Transit')).toBeInTheDocument();
    expect(within(tableHeaders!).getByText('Unit Cost')).toBeInTheDocument();
    expect(within(tableHeaders!).getByText('Total Value')).toBeInTheDocument();
    expect(within(tableHeaders!).getByText('Days Supply')).toBeInTheDocument();
    expect(within(tableHeaders!).getByText('Reorder Point')).toBeInTheDocument();

    // Check all items are displayed in the table
    const tableBody = screen.getByRole('table').querySelector('tbody');
    mockInventory.forEach(item => {
      expect(within(tableBody!).getByText(item.sku)).toBeInTheDocument();
      expect(within(tableBody!).getByText(item.description)).toBeInTheDocument();
    });
  });

  it('should display correct status for each item', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // TS-001: 45 days supply, no reorder needed - should be "In Stock" (green)
    const ts001Row = screen.getByText('TS-001').closest('tr');
    const ts001Status = within(ts001Row!).getByText('In Stock');
    expect(ts001Status).toBeInTheDocument();
    expect(ts001Status.className).toMatch(/bg-green-100.*text-green-800/);

    // TS-002: needs reorder - should be "Reorder Now" (red)
    const ts002Row = screen.getAllByText('TS-002')[0].closest('tr');
    const ts002Status = within(ts002Row!).getByText('Reorder Now');
    expect(ts002Status).toBeInTheDocument();
    expect(ts002Status.className).toMatch(/bg-red-100.*text-red-800/);

    // TS-003: 60 days supply - should be "In Stock" (green)
    const ts003Row = screen.getByText('TS-003').closest('tr');
    expect(within(ts003Row!).getByText('In Stock')).toBeInTheDocument();

    // TS-004: needs reorder - should be "Reorder Now" (red)
    const ts004Row = screen.getAllByText('TS-004')[0].closest('tr');
    expect(within(ts004Row!).getByText('Reorder Now')).toBeInTheDocument();
  });

  it('should display low stock warning for items with < 45 days supply', () => {
    const lowStockInventory: InventoryStatus[] = [
      {
        sku: 'TS-005',
        description: 'T-Shirt White Small',
        unitsOnHand: 400,
        unitsInTransit: 0,
        unitCost: 15.50,
        totalValue: 6200,
        daysOfSupply: 30, // Less than 45 days
        reorderPoint: 200,
        needsReorder: false,
      },
    ];

    render(<InventoryDashboard inventory={lowStockInventory} />);

    const row = screen.getByText('TS-005').closest('tr');
    expect(within(row!).getByText('Low Stock')).toBeInTheDocument();
    expect(within(row!).getByText('Low Stock')).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should filter items when "Show reorder items only" is checked', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Initially all 4 items should be visible in the table
    const table = screen.getByRole('table');
    const initialRows = within(table).getAllByRole('row');
    expect(initialRows).toHaveLength(5); // 1 header + 4 data rows

    // Check the filter checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Only reorder items should be visible
    const filteredRows = within(table).getAllByRole('row');
    expect(filteredRows).toHaveLength(3); // 1 header + 2 data rows
    expect(screen.queryByText('TS-001')).not.toBeInTheDocument();
    expect(screen.getAllByText('TS-002')[0]).toBeInTheDocument();
    expect(screen.queryByText('TS-003')).not.toBeInTheDocument();
    expect(screen.getAllByText('TS-004')[0]).toBeInTheDocument();
  });

  it('should sort items by value by default', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    const rows = screen.getAllByRole('row').slice(1); // Skip header row
    const skus = rows.map(row => within(row).getByText(/TS-\d+/).textContent);

    // Should be sorted by value descending: TS-003 (12400), TS-001 (7750), TS-002 (2325), TS-004 (1550)
    expect(skus).toEqual(['TS-003', 'TS-001', 'TS-002', 'TS-004']);
  });

  it('should sort items by SKU when selected', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    const sortSelect = screen.getByDisplayValue('Sort by Value');
    fireEvent.change(sortSelect, { target: { value: 'sku' } });

    const rows = screen.getAllByRole('row').slice(1);
    const skus = rows.map(row => within(row).getByText(/TS-\d+/).textContent);

    // Should be sorted alphabetically by SKU
    expect(skus).toEqual(['TS-001', 'TS-002', 'TS-003', 'TS-004']);
  });

  it('should sort items by days of supply when selected', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    const sortSelect = screen.getByDisplayValue('Sort by Value');
    fireEvent.change(sortSelect, { target: { value: 'daysOfSupply' } });

    const rows = screen.getAllByRole('row').slice(1);
    const skus = rows.map(row => within(row).getByText(/TS-\d+/).textContent);

    // Should be sorted by days of supply ascending: TS-004 (8), TS-002 (12), TS-001 (45), TS-003 (60)
    expect(skus).toEqual(['TS-004', 'TS-002', 'TS-001', 'TS-003']);
  });

  it('should display reorder alerts section when items need reordering', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Check reorder alerts section exists
    expect(screen.getByText('Reorder Required')).toBeInTheDocument();

    // Check both items that need reordering are listed
    const alertSection = screen.getByText('Reorder Required').parentElement;
    expect(within(alertSection!).getByText('TS-002')).toBeInTheDocument();
    expect(within(alertSection!).getByText('- T-Shirt Black Medium')).toBeInTheDocument();
    expect(within(alertSection!).getByText('150 units on hand (12 days supply)')).toBeInTheDocument();

    expect(within(alertSection!).getByText('TS-004')).toBeInTheDocument();
    expect(within(alertSection!).getByText('- T-Shirt Black XL')).toBeInTheDocument();
    expect(within(alertSection!).getByText('100 units on hand (8 days supply)')).toBeInTheDocument();
  });

  it('should not display reorder alerts when no items need reordering', () => {
    const noReorderInventory: InventoryStatus[] = [
      {
        sku: 'TS-001',
        description: 'T-Shirt Black Small',
        unitsOnHand: 500,
        unitsInTransit: 200,
        unitCost: 15.50,
        totalValue: 7750,
        daysOfSupply: 45,
        reorderPoint: 300,
        needsReorder: false,
      },
    ];

    render(<InventoryDashboard inventory={noReorderInventory} />);

    // Reorder alerts section should not exist
    expect(screen.queryByText('Reorder Required')).not.toBeInTheDocument();
  });

  it('should handle empty inventory', () => {
    render(<InventoryDashboard inventory={[]} />);

    // Should show zero values
    expect(screen.getAllByText('$0')[0]).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3); // units on hand, in transit, items need reorder

    // Should not crash on average calculations
    expect(screen.getByText('NaN days')).toBeInTheDocument(); // Division by zero
  });

  it('should format numbers correctly', () => {
    const largeInventory: InventoryStatus[] = [
      {
        sku: 'TS-100',
        description: 'Bulk Item',
        unitsOnHand: 10000,
        unitsInTransit: 5000,
        unitCost: 99.99,
        totalValue: 999900,
        daysOfSupply: 90,
        reorderPoint: 8000,
        needsReorder: false,
      },
    ];

    render(<InventoryDashboard inventory={largeInventory} />);

    // Check number formatting with commas
    expect(screen.getAllByText('$999,900')[0]).toBeInTheDocument(); // Total value
    expect(screen.getAllByText('10,000')[0]).toBeInTheDocument(); // Units on hand
    expect(screen.getAllByText('5,000')[0]).toBeInTheDocument(); // Units in transit
    expect(screen.getByText('$99.99')).toBeInTheDocument(); // Unit cost
    expect(screen.getAllByText('8,000')[0]).toBeInTheDocument(); // Reorder point
  });

  it('should update reorder alert icon color based on items needing reorder', () => {
    const { rerender } = render(<InventoryDashboard inventory={mockInventory} />);

    // With items needing reorder, icon should be red
    const cardWithReorderCount = screen.getByText('Items Need Reorder').parentElement?.parentElement;
    const iconContainers = cardWithReorderCount?.querySelectorAll('.rounded-full');
    expect(iconContainers?.[0]).toHaveClass('bg-red-100');

    // Without items needing reorder
    const noReorderInventory = mockInventory.map(item => ({ ...item, needsReorder: false }));
    rerender(<InventoryDashboard inventory={noReorderInventory} />);

    const updatedCard = screen.getByText('Items Need Reorder').parentElement?.parentElement;
    const updatedIconContainers = updatedCard?.querySelectorAll('.rounded-full');
    expect(updatedIconContainers?.[0]).toHaveClass('bg-gray-100');
  });

  it('should maintain filter state when sorting changes', () => {
    render(<InventoryDashboard inventory={mockInventory} />);

    // Apply filter
    const checkbox = screen.getByLabelText(/show reorder items only/i);
    fireEvent.click(checkbox);

    // Change sort
    const sortSelect = screen.getByDisplayValue('Sort by Value');
    fireEvent.change(sortSelect, { target: { value: 'sku' } });

    // Filter should still be applied
    expect(screen.queryByText('TS-001')).not.toBeInTheDocument();
    expect(screen.getAllByText('TS-002')[0]).toBeInTheDocument();
    expect(screen.queryByText('TS-003')).not.toBeInTheDocument();
    expect(screen.getAllByText('TS-004')[0]).toBeInTheDocument();
  });
});