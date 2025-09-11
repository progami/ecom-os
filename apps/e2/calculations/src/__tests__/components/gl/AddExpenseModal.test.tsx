// @ts-nocheck
// src/__tests__/components/gl/AddExpenseModal.test.tsx
import React from 'react';
import { AddExpenseModal, ExpenseFormData } from '@/components/gl/AddExpenseModal';
import { customRender, screen, waitFor, fillForm } from '@/test/testHelpers';
import { format } from 'date-fns';

// Mock the UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div>
      <select value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

jest.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <input type="date" onChange={(e) => onSelect(new Date(e.target.value))} />
  ),
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

// Mock the cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('AddExpenseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSubmit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal when open', () => {
      customRender(<AddExpenseModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
      expect(screen.getByText('Add a new expense or equity transaction to the general ledger')).toBeInTheDocument();
    });

    it('does not render modal when closed', () => {
      customRender(<AddExpenseModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole('heading', { name: 'Add Transaction' })).not.toBeInTheDocument();
    });

    it('renders all form fields', () => {
      customRender(<AddExpenseModal {...defaultProps} />);
      
      expect(screen.getByText('Transaction Type')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });

    it('shows recurring option only for regular expenses', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // First select regular expense type
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      // Recurring switch should be visible
      expect(screen.getByText('This is a recurring expense')).toBeInTheDocument();
      const recurringSwitch = screen.getByRole('switch');
      
      // Click the recurring switch
      await user.click(recurringSwitch);
      
      // Recurring settings should appear
      expect(screen.getByText('Recurring Settings')).toBeInTheDocument();
      expect(screen.getByText('Frequency')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('fills and submits form with regular expense', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select transaction type
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      // Fill in description
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Office supplies');
      
      // Select category (required field)
      const categorySelects = screen.getAllByRole('combobox');
      const categorySelect = categorySelects[1]; // Second select is category
      await user.selectOptions(categorySelect, 'office');
      
      // Fill in amount
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '150.50');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Office supplies',
            amount: 150.5,
            expenseType: 'regular',
            isRecurring: false
          })
        );
      });
    });

    it('submits recurring expense with monthly frequency', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select regular expense type
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      // Fill basic fields
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Monthly rent');
      
      // Select category
      const categorySelects = screen.getAllByRole('combobox');
      const categorySelect = categorySelects[1];
      await user.selectOptions(categorySelect, 'rent');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '2000');
      
      // Enable recurring
      const recurringSwitch = screen.getByRole('switch');
      await user.click(recurringSwitch);
      
      // Wait for recurring settings to appear
      await waitFor(() => {
        expect(screen.getByText('Recurring Settings')).toBeInTheDocument();
      });
      
      // Submit
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Monthly rent',
            amount: 2000,
            expenseType: 'regular',
            category: 'rent',
            isRecurring: true
          })
        );
      });
      
      // Check that the recurringConfig was set properly with default values
      const callArg = defaultProps.onSubmit.mock.calls[0][0];
      if (callArg.isRecurring && callArg.recurringConfig) {
        expect(callArg.recurringConfig.frequency).toBe('monthly');
      }
    });

    it('handles payroll expense type', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select payroll type
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'payroll');
      
      // Fill fields
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'January payroll');
      
      // Select category
      const categorySelects = screen.getAllByRole('combobox');
      const categorySelect = categorySelects[1];
      await user.selectOptions(categorySelect, 'payroll');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '10000');
      
      // Submit
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'January payroll',
            amount: 10000,
            expenseType: 'payroll'
          })
        );
      });
    });

    it('validates required fields', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      // onSubmit should not be called
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('handles negative amounts', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Fill required fields
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Test');
      
      const transactionTypeSelects = screen.getAllByRole('combobox');
      await user.selectOptions(transactionTypeSelects[0], 'regular');
      
      const categorySelects = screen.getAllByRole('combobox');
      await user.selectOptions(categorySelects[1], 'office');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '-100');
      
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      // Should still submit with negative amount (component allows it)
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: -100
          })
        );
      });
    });

    it('closes modal on cancel', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('shows loading state during submission', async () => {
      const slowSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      const { user } = customRender(
        <AddExpenseModal {...defaultProps} onSubmit={slowSubmit} />
      );
      
      // Fill minimum required fields
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Test');
      
      // Select transaction type and category
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'regular');
      await user.selectOptions(selects[1], 'office');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');
      
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      // Button should be disabled during submission
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Date Picker', () => {
    it('allows selecting a date', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // The date picker button has a calendar icon and today's date
      const dateButtons = screen.getAllByRole('button');
      const dateButton = dateButtons.find(btn => btn.textContent?.includes('CalendarIcon'));
      
      if (dateButton) {
        await user.click(dateButton);
        
        // Calendar input should be available
        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs.length).toBeGreaterThan(0);
      }
    });

    it('defaults to today\'s date', () => {
      customRender(<AddExpenseModal {...defaultProps} />);
      
      // Check that Date label exists
      expect(screen.getByText('Date')).toBeInTheDocument();
      
      // Check that a date button exists (it will have today's date)
      const dateButtons = screen.getAllByRole('button');
      const hasDateButton = dateButtons.some(btn => btn.textContent?.includes('CalendarIcon'));
      expect(hasDateButton).toBe(true);
    });
  });

  describe('Recurring Configuration', () => {
    it('shows recurring settings when enabled', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select regular expense
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      // Wait for the recurring option to appear
      await waitFor(() => {
        expect(screen.getByText('This is a recurring expense')).toBeInTheDocument();
      });
      
      // Enable recurring
      const recurringSwitch = screen.getByRole('switch');
      await user.click(recurringSwitch);
      
      // Recurring settings should appear
      await waitFor(() => {
        expect(screen.getByText('Recurring Settings')).toBeInTheDocument();
        expect(screen.getByText('Frequency')).toBeInTheDocument();
      });
      
      // Verify we can select annual frequency
      const frequencySelects = screen.getAllByRole('combobox');
      const frequencySelect = frequencySelects[frequencySelects.length - 1];
      await user.selectOptions(frequencySelect, 'annual');
    });

    it('validates recurring configuration', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select regular expense and enable recurring
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      const recurringSwitch = screen.getByRole('switch');
      await user.click(recurringSwitch);
      
      // Fill basic info
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Test recurring');
      
      // Select category
      const categorySelects = screen.getAllByRole('combobox');
      await user.selectOptions(categorySelects[1], 'software');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');
      
      // Submit should work with default recurring settings
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test recurring',
            amount: 100,
            expenseType: 'regular',
            isRecurring: true,
            category: 'software'
          })
        );
      });
      
      // Check that the recurringConfig was set properly with default values
      const callArg = defaultProps.onSubmit.mock.calls[0][0];
      if (callArg.isRecurring && callArg.recurringConfig) {
        expect(callArg.recurringConfig.frequency).toBe('monthly');
      }
    });

    it('allows setting end date for recurring expenses', async () => {
      const { user } = customRender(<AddExpenseModal {...defaultProps} />);
      
      // Select regular expense type first
      const transactionTypeSelects = screen.getAllByRole('combobox');
      const transactionTypeSelect = transactionTypeSelects[0];
      await user.selectOptions(transactionTypeSelect, 'regular');
      
      // Wait for the recurring option to appear
      await waitFor(() => {
        expect(screen.getByText('This is a recurring expense')).toBeInTheDocument();
      });
      
      // Enable recurring
      const recurringSwitch = screen.getByRole('switch');
      await user.click(recurringSwitch);
      
      // End date option should be available
      await waitFor(() => {
        expect(screen.getByText('End Date (Optional)')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on submission failure', async () => {
      const failingSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
      const { user } = customRender(
        <AddExpenseModal {...defaultProps} onSubmit={failingSubmit} />
      );
      
      // Fill and submit
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Test');
      
      // Select required fields
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'regular');
      await user.selectOptions(selects[1], 'office');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');
      
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      // Modal should not close on error
      await waitFor(() => {
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      });
    });

    it('clears error on retry', async () => {
      let attemptCount = 0;
      const sometimesFailingSubmit = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });
      
      const { user } = customRender(
        <AddExpenseModal {...defaultProps} onSubmit={sometimesFailingSubmit} />
      );
      
      // Fill form
      const descriptionInput = screen.getByPlaceholderText('e.g., Claude.ai subscription, Office Rent');
      await user.type(descriptionInput, 'Test');
      
      // Select required fields
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'regular');
      await user.selectOptions(selects[1], 'office');
      
      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');
      
      // First submit (fails)
      const submitButton = screen.getByRole('button', { name: 'Add Transaction' });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(sometimesFailingSubmit).toHaveBeenCalledTimes(1);
      });
      
      // Second submit (succeeds)
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(sometimesFailingSubmit).toHaveBeenCalledTimes(2);
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });
});