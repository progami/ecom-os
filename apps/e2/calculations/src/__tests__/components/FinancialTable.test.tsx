// @ts-nocheck
// src/__tests__/components/FinancialTable.test.tsx
import React from 'react';
import FinancialTable from '@/components/FinancialTable';
import { customRender, screen, within } from '@/test/testHelpers';

describe('FinancialTable', () => {
  const defaultColumns = [
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', align: 'right' as const },
    { key: 'status', label: 'Status', align: 'center' as const }
  ];

  const defaultData = [
    {
      date: '2024-01-15',
      description: 'Office Supplies',
      amount: 125.50,
      status: 'Paid'
    },
    {
      date: '2024-01-16',
      description: 'Software License',
      amount: 299.99,
      status: 'Pending'
    },
    {
      date: '2024-01-17',
      description: 'Consulting Fee',
      amount: 1500.00,
      status: 'Paid'
    }
  ];

  describe('Rendering', () => {
    it('renders table with headers and data', () => {
      customRender(
        <FinancialTable data={defaultData} columns={defaultColumns} />
      );

      // Check headers
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();

      // Check data
      expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      expect(screen.getByText('Software License')).toBeInTheDocument();
      expect(screen.getByText('Consulting Fee')).toBeInTheDocument();
    });

    it('displays empty state when no data', () => {
      customRender(
        <FinancialTable data={[]} columns={defaultColumns} />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('handles null or undefined data gracefully', () => {
      customRender(
        <FinancialTable data={null as any} columns={defaultColumns} />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = customRender(
        <FinancialTable 
          data={defaultData} 
          columns={defaultColumns} 
          className="custom-table-class" 
        />
      );

      const wrapper = container.querySelector('.custom-table-class');
      expect(wrapper).toBeInTheDocument();
    });

    it('renders with alternating row colors', () => {
      customRender(
        <FinancialTable data={defaultData} columns={defaultColumns} />
      );

      const rows = screen.getAllByRole('row').slice(1); // Skip header row
      expect(rows[0]).toHaveClass('bg-white');
      expect(rows[1]).toHaveClass('bg-gray-50');
      expect(rows[2]).toHaveClass('bg-white');
    });
  });

  describe('Column Formatting', () => {
    it('applies custom formatting function', () => {
      const columnsWithFormat = [
        ...defaultColumns.slice(0, 2),
        {
          key: 'amount',
          label: 'Amount',
          align: 'right' as const,
          format: (value: number) => `$${value.toFixed(2)}`
        },
        defaultColumns[3]
      ];

      customRender(
        <FinancialTable data={defaultData} columns={columnsWithFormat} />
      );

      expect(screen.getByText('$125.50')).toBeInTheDocument();
      expect(screen.getByText('$299.99')).toBeInTheDocument();
      expect(screen.getByText('$1500.00')).toBeInTheDocument();
    });

    it('handles missing values in data', () => {
      const dataWithMissing = [
        {
          date: '2024-01-15',
          description: 'Item without amount',
          status: 'Pending'
          // amount is missing
        }
      ];

      customRender(
        <FinancialTable data={dataWithMissing} columns={defaultColumns} />
      );

      // Should render without crashing
      expect(screen.getByText('Item without amount')).toBeInTheDocument();
    });

    it('formats dates with custom formatter', () => {
      const dateColumn = {
        key: 'date',
        label: 'Date',
        format: (value: string) => {
          const date = new Date(value);
          return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        }
      };

      const columns = [dateColumn, ...defaultColumns.slice(1)];

      customRender(
        <FinancialTable data={defaultData} columns={columns} />
      );

      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    });
  });

  describe('Column Alignment', () => {
    it('aligns columns based on align property', () => {
      customRender(
        <FinancialTable data={defaultData} columns={defaultColumns} />
      );

      // Check header alignment
      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveClass('text-left'); // Date
      expect(headers[1]).toHaveClass('text-left'); // Description (default)
      expect(headers[2]).toHaveClass('text-right'); // Amount
      expect(headers[3]).toHaveClass('text-center'); // Status

      // Check cell alignment
      const firstRow = screen.getAllByRole('row')[1];
      const cells = within(firstRow).getAllByRole('cell');
      expect(cells[0]).toHaveClass('text-left');
      expect(cells[1]).toHaveClass('text-left');
      expect(cells[2]).toHaveClass('text-right');
      expect(cells[3]).toHaveClass('text-center');
    });

    it('defaults to left alignment when not specified', () => {
      const columnsNoAlign = [
        { key: 'col1', label: 'Column 1' },
        { key: 'col2', label: 'Column 2' }
      ];

      const data = [{ col1: 'Value 1', col2: 'Value 2' }];

      customRender(
        <FinancialTable data={data} columns={columnsNoAlign} />
      );

      const headers = screen.getAllByRole('columnheader');
      headers.forEach(header => {
        expect(header).toHaveClass('text-left');
      });
    });
  });

  describe('Large Data Sets', () => {
    it('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        description: `Transaction ${i + 1}`,
        amount: Math.random() * 1000,
        status: i % 2 === 0 ? 'Paid' : 'Pending'
      }));

      customRender(
        <FinancialTable data={largeData} columns={defaultColumns} />
      );

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(101); // 100 data rows + 1 header row
    });

    it('maintains performance with wide tables', () => {
      const manyColumns = Array.from({ length: 20 }, (_, i) => ({
        key: `col${i}`,
        label: `Column ${i}`
      }));

      const wideData = Array.from({ length: 10 }, (_, rowIndex) => {
        const row: any = {};
        manyColumns.forEach((col, colIndex) => {
          row[col.key] = `R${rowIndex}C${colIndex}`;
        });
        return row;
      });

      const { container } = customRender(
        <FinancialTable data={wideData} columns={manyColumns} />
      );

      // Check that horizontal scroll is enabled
      const wrapper = container.querySelector('.overflow-x-auto');
      expect(wrapper).toBeInTheDocument();

      // Verify all columns are rendered
      expect(screen.getByText('Column 0')).toBeInTheDocument();
      expect(screen.getByText('Column 19')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in data', () => {
      const specialData = [
        {
          date: '2024-01-15',
          description: 'Item with & ampersand',
          amount: 100,
          status: 'Paid'
        },
        {
          date: '2024-01-16',
          description: '"Quoted" description',
          amount: 200,
          status: '<Tagged>'
        }
      ];

      customRender(
        <FinancialTable data={specialData} columns={defaultColumns} />
      );

      expect(screen.getByText('Item with & ampersand')).toBeInTheDocument();
      expect(screen.getByText('"Quoted" description')).toBeInTheDocument();
      expect(screen.getByText('<Tagged>')).toBeInTheDocument();
    });

    it('handles numeric strings correctly', () => {
      const numericStringData = [
        {
          date: '2024-01-15',
          description: 'Item 123',
          amount: '999.99', // String instead of number
          status: '1'
        }
      ];

      customRender(
        <FinancialTable data={numericStringData} columns={defaultColumns} />
      );

      expect(screen.getByText('999.99')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles boolean values', () => {
      const booleanData = [
        {
          date: '2024-01-15',
          description: 'Boolean test',
          amount: 100,
          status: true
        }
      ];

      const columnsWithBooleanFormat = [
        ...defaultColumns.slice(0, 3),
        {
          key: 'status',
          label: 'Status',
          format: (value: boolean) => value ? 'Active' : 'Inactive'
        }
      ];

      customRender(
        <FinancialTable data={booleanData} columns={columnsWithBooleanFormat} />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('handles nested object data with custom format', () => {
      const nestedData = [
        {
          date: '2024-01-15',
          description: 'Nested description',
          amount: 150,
          status: 'Paid'
        }
      ];

      const nestedColumns = [
        { key: 'date', label: 'Date' },
        { 
          key: 'description', 
          label: 'Description'
        },
        { 
          key: 'amount', 
          label: 'Amount',
          format: (value: any) => `$${value || 0}`
        },
        { key: 'status', label: 'Status' }
      ];

      customRender(
        <FinancialTable data={nestedData} columns={nestedColumns} />
      );

      expect(screen.getByText('Nested description')).toBeInTheDocument();
      expect(screen.getByText('$150')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses semantic table markup', () => {
      customRender(
        <FinancialTable data={defaultData} columns={defaultColumns} />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(4);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 3 data
    });

    it('provides proper table structure', () => {
      const { container } = customRender(
        <FinancialTable data={defaultData} columns={defaultColumns} />
      );

      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tbody')).toBeInTheDocument();
    });
  });
});