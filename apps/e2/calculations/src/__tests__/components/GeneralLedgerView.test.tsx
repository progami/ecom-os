// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeneralLedgerView from '@/components/GeneralLedgerView';
import { GeneralLedgerData } from '@/types/financial';

// Mock formatDateShort
jest.mock('@/lib/utils/dateFormatters', () => ({
  formatDateShort: (date: string) => date,
}));

// Mock window.URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/test-blob');
global.URL.revokeObjectURL = jest.fn();

describe('GeneralLedgerView', () => {
  const mockLedgerData: GeneralLedgerData = {
    trialBalance: [
      {
        accountCode: '1000',
        accountName: 'Cash',
        accountType: 'asset',
        debit: 50000,
        credit: 0,
        balance: 50000,
      },
      {
        accountCode: '2000',
        accountName: 'Accounts Payable',
        accountType: 'liability',
        debit: 0,
        credit: 15000,
        balance: -15000,
      },
      {
        accountCode: '3000',
        accountName: 'Retained Earnings',
        accountType: 'equity',
        debit: 0,
        credit: 20000,
        balance: -20000,
      },
      {
        accountCode: '4000',
        accountName: 'Sales Revenue',
        accountType: 'revenue',
        debit: 0,
        credit: 30000,
        balance: -30000,
      },
      {
        accountCode: '5000',
        accountName: 'Operating Expenses',
        accountType: 'expense',
        debit: 15000,
        credit: 0,
        balance: 15000,
      },
    ],
    journalEntries: [
      {
        entryId: 'JE001',
        date: '2025-01-15',
        description: 'Sales transaction',
        lines: [
          {
            accountCode: '1000',
            accountName: 'Cash',
            debit: 5000,
            credit: 0,
            memo: 'Customer payment',
          },
          {
            accountCode: '4000',
            accountName: 'Sales Revenue',
            debit: 0,
            credit: 5000,
            memo: 'Product sale',
          },
        ],
        totalDebits: 5000,
        totalCredits: 5000,
      },
      {
        entryId: 'JE002',
        date: '2025-01-20',
        description: 'Expense payment',
        lines: [
          {
            accountCode: '5000',
            accountName: 'Operating Expenses',
            debit: 1500,
            credit: 0,
            memo: 'Office supplies',
          },
          {
            accountCode: '1000',
            accountName: 'Cash',
            debit: 0,
            credit: 1500,
            memo: 'Cash payment',
          },
        ],
        totalDebits: 1500,
        totalCredits: 1500,
      },
    ],
    accountBalances: [
      {
        accountCode: '1000',
        accountName: 'Cash',
        balance: 50000,
        monthlyChange: 5000,
        ytdChange: 25000,
      },
      {
        accountCode: '2000',
        accountName: 'Accounts Payable',
        balance: -15000,
        monthlyChange: -2000,
        ytdChange: -10000,
      },
      {
        accountCode: '3000',
        accountName: 'Retained Earnings',
        balance: -20000,
        monthlyChange: 0,
        ytdChange: -5000,
      },
    ],
  };

  const mockEmptyLedgerData: GeneralLedgerData = {
    trialBalance: [],
    journalEntries: [],
    accountBalances: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display no data message when ledgerData is null', () => {
    render(<GeneralLedgerView ledgerData={null as any} />);
    expect(screen.getByText('No ledger data available.')).toBeInTheDocument();
  });

  it('should render header and export button', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    expect(screen.getByText('General Ledger')).toBeInTheDocument();
    expect(screen.getByText('Double-entry bookkeeping records and account balances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export to csv/i })).toBeInTheDocument();
  });

  it('should render view tabs', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    expect(screen.getByRole('button', { name: /trial balance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /journal entries/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account balances/i })).toBeInTheDocument();
  });

  it('should display trial balance view by default', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    // Check table headers
    expect(screen.getByText('Account Code')).toBeInTheDocument();
    expect(screen.getByText('Account Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /debit/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /credit/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /balance/i })).toBeInTheDocument();

    // Check data
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getAllByText(/\$50,000/)[0]).toBeInTheDocument();
  });

  it('should calculate and display trial balance totals', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    // Total debits: 50000 + 15000 = 65000
    // Total credits: 15000 + 20000 + 30000 = 65000
    const totalsRow = screen.getByText('Totals').closest('tr');
    expect(within(totalsRow!).getAllByText('$65,000')).toHaveLength(2);
    expect(within(totalsRow!).getByText('✓ Balanced')).toBeInTheDocument();
  });

  it('should display unbalanced message when debits and credits do not match', () => {
    const unbalancedData = {
      ...mockLedgerData,
      trialBalance: [
        ...mockLedgerData.trialBalance!,
        {
          accountCode: '6000',
          accountName: 'Error Account',
          accountType: 'expense',
          debit: 1000,
          credit: 0,
          balance: 1000,
        },
      ],
    };

    render(<GeneralLedgerView ledgerData={unbalancedData} />);

    const totalsRow = screen.getByText('Totals').closest('tr');
    expect(within(totalsRow!).getByText(/difference: \$1,000/i)).toBeInTheDocument();
  });

  it('should filter trial balance by account type', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const typeFilter = screen.getByDisplayValue('All Account Types');
    fireEvent.change(typeFilter, { target: { value: 'asset' } });

    // Should only show asset accounts
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('2000')).not.toBeInTheDocument();
    expect(screen.queryByText('3000')).not.toBeInTheDocument();
  });

  it('should search accounts by name or code', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const searchInput = screen.getByPlaceholderText(/search accounts/i);
    fireEvent.change(searchInput, { target: { value: 'cash' } });

    // Should only show accounts with "cash" in the name
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('2000')).not.toBeInTheDocument();
  });

  it('should apply correct styling to account types', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const assetBadge = screen.getByText('asset');
    const liabilityBadge = screen.getByText('liability');
    const equityBadge = screen.getByText('equity');
    const revenueBadge = screen.getByText('revenue');
    const expenseBadge = screen.getByText('expense');

    expect(assetBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(liabilityBadge).toHaveClass('bg-red-100', 'text-red-800');
    expect(equityBadge).toHaveClass('bg-purple-100', 'text-purple-800');
    expect(revenueBadge).toHaveClass('bg-green-100', 'text-green-800');
    expect(expenseBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should switch to journal entries view', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const journalTab = screen.getByRole('button', { name: /journal entries/i });
    fireEvent.click(journalTab);

    // Check journal entries are displayed
    expect(screen.getByText('Entry #JE001')).toBeInTheDocument();
    expect(screen.getByText('Sales transaction')).toBeInTheDocument();
    expect(screen.getByText('Entry #JE002')).toBeInTheDocument();
    expect(screen.getByText('Expense payment')).toBeInTheDocument();
  });

  it('should display journal entry details correctly', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    fireEvent.click(screen.getByRole('button', { name: /journal entries/i }));

    const firstEntry = screen.getByText('Entry #JE001').closest('.bg-white');
    
    // Check entry details
    expect(within(firstEntry!).getByText('2025-01-15')).toBeInTheDocument();
    expect(within(firstEntry!).getByText('Customer payment')).toBeInTheDocument();
    expect(within(firstEntry!).getByText('Product sale')).toBeInTheDocument();
    
    // Check totals are displayed
    const totalsRow = within(firstEntry!).getByText('Totals').closest('tr');
    expect(within(totalsRow!).getAllByText('$5,000')).toHaveLength(2);
    expect(within(totalsRow!).getByText('✓')).toBeInTheDocument();
  });

  it('should filter journal entries by month', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    fireEvent.click(screen.getByRole('button', { name: /journal entries/i }));

    // Get all inputs with type="month" - there should only be one in journal entries view
    const monthInputs = screen.getAllByDisplayValue('');
    const monthFilter = monthInputs.find(input => input.getAttribute('type') === 'month');
    
    fireEvent.change(monthFilter!, { target: { value: '2025-01' } });

    // Both entries are in January, so both should be visible
    expect(screen.getByText('Entry #JE001')).toBeInTheDocument();
    expect(screen.getByText('Entry #JE002')).toBeInTheDocument();

    // Filter to a different month
    fireEvent.change(monthFilter!, { target: { value: '2025-02' } });

    // No entries should be visible
    expect(screen.queryByText('Entry #JE001')).not.toBeInTheDocument();
    expect(screen.queryByText('Entry #JE002')).not.toBeInTheDocument();
  });

  it('should switch to account balances view', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const balancesTab = screen.getByRole('button', { name: /account balances/i });
    fireEvent.click(balancesTab);

    // Check summary cards
    expect(screen.getByText('Account Balance Summary')).toBeInTheDocument();
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
  });

  it('should calculate account type totals correctly', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    fireEvent.click(screen.getByRole('button', { name: /account balances/i }));

    // Total assets: 50000 (only account starting with '1')
    const assetsCard = screen.getByText('Total Assets').parentElement;
    expect(within(assetsCard!).getByText('$50,000')).toBeInTheDocument();

    // Total liabilities: 15000 (only account starting with '2')
    const liabilitiesCard = screen.getByText('Total Liabilities').parentElement;
    expect(within(liabilitiesCard!).getByText('$15,000')).toBeInTheDocument();

    // Total equity: 20000 (only account starting with '3')
    const equityCard = screen.getByText('Total Equity').parentElement;
    expect(within(equityCard!).getByText('$20,000')).toBeInTheDocument();
  });

  it('should display account balance changes with correct styling', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    fireEvent.click(screen.getByRole('button', { name: /account balances/i }));

    // Find the Cash row by looking for the account code in the first column
    const cashRow = screen.getByRole('table').querySelector('tbody tr:first-child');
    const monthlyChange = within(cashRow!).getByText('+$5,000');
    expect(monthlyChange).toHaveClass('text-green-600');

    // Find the AP row - the text might be split, use regex
    const apRow = screen.getByRole('table').querySelector('tbody tr:nth-child(2)');
    const apMonthlyChange = within(apRow!).getByText(/\$-2,000/);
    expect(apMonthlyChange).toHaveClass('text-red-600');
  });

  it('should export trial balance to CSV', () => {
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = jest.fn((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const exportButton = screen.getByRole('button', { name: /export to csv/i });
    fireEvent.click(exportButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    document.createElement = originalCreateElement;
  });

  it('should export journal entries to CSV when in journal view', () => {
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = jest.fn((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    // Switch to journal entries view
    fireEvent.click(screen.getByRole('button', { name: /journal entries/i }));

    const exportButton = screen.getByRole('button', { name: /export to csv/i });
    fireEvent.click(exportButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();

    document.createElement = originalCreateElement;
  });

  it('should handle empty data gracefully', () => {
    render(<GeneralLedgerView ledgerData={mockEmptyLedgerData} />);

    // Should not crash and display empty state
    expect(screen.getByText('General Ledger')).toBeInTheDocument();
    
    // Check totals show as $0
    const totalsRow = screen.getByText('Totals').closest('tr');
    const zeroAmounts = within(totalsRow!).getAllByText('$0');
    expect(zeroAmounts.length).toBeGreaterThanOrEqual(2);
  });

  it('should display credit balances with (CR) notation', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    // Find the Accounts Payable row
    const apRow = screen.getByText('Accounts Payable').closest('tr');
    expect(within(apRow!).getByText(/\$15,000.*\(CR\)/)).toBeInTheDocument();
  });

  it('should handle missing memo in journal entries', () => {
    const dataWithNoMemo = {
      ...mockLedgerData,
      journalEntries: [
        {
          ...mockLedgerData.journalEntries![0],
          lines: [
            {
              ...mockLedgerData.journalEntries![0].lines[0],
              memo: undefined,
            },
            mockLedgerData.journalEntries![0].lines[1],
          ],
        },
      ],
    };

    render(<GeneralLedgerView ledgerData={dataWithNoMemo} />);
    fireEvent.click(screen.getByRole('button', { name: /journal entries/i }));

    // Should display dash for missing memo
    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it('should maintain active tab styling', () => {
    render(<GeneralLedgerView ledgerData={mockLedgerData} />);

    const trialBalanceTab = screen.getByRole('button', { name: /trial balance/i });
    const journalEntriesTab = screen.getByRole('button', { name: /journal entries/i });

    // Initially trial balance should be active
    expect(trialBalanceTab.className).toMatch(/border-blue-500.*text-blue-600/);
    expect(journalEntriesTab.className).not.toMatch(/border-blue-500/);

    // Click journal entries
    fireEvent.click(journalEntriesTab);

    // Journal entries should now be active
    expect(journalEntriesTab.className).toMatch(/border-blue-500.*text-blue-600/);
    expect(trialBalanceTab.className).not.toMatch(/border-blue-500/);
  });
});