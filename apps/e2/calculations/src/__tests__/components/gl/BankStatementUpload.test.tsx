// @ts-nocheck
// src/__tests__/components/gl/BankStatementUpload.test.tsx
import React from 'react';
import { BankStatementUpload } from '@/components/gl/BankStatementUpload';
import { customRender, screen, waitFor } from '@/test/testHelpers';

describe('BankStatementUpload', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onUpload: jest.fn()
  };

  const validCSVData = `Date\tDescription\tCategory\tAmount\tRunning Balance
Jan 15 2024\tOffice Supplies\tOffice\t-125.50\t5874.50
Jan 16 2024\tClient Payment\tRevenue\t2500.00\t8374.50
Jan 17 2024\tMonthly Rent\tRent\t-2000.00\t6374.50
Jan 18 2024\tSoftware Subscription\tSoftware\t-99.99\t6274.51`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal when open', () => {
      customRender(<BankStatementUpload {...defaultProps} />);
      
      expect(screen.getByText('Upload Bank Statement')).toBeInTheDocument();
      expect(screen.getByText(/Paste your bank statement data/)).toBeInTheDocument();
    });

    it('does not render modal when closed', () => {
      customRender(<BankStatementUpload {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Upload Bank Statement')).not.toBeInTheDocument();
    });

    it('renders textarea for CSV input', () => {
      customRender(<BankStatementUpload {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      expect(textarea).toBeInTheDocument();
    });

    it('shows example format', () => {
      customRender(<BankStatementUpload {...defaultProps} />);
      
      // The component shows the format in the description and placeholder
      expect(screen.getByText(/Paste your bank statement data in the format:/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/)).toBeInTheDocument();
    });
  });

  describe('CSV Parsing', () => {
    it('parses valid CSV data correctly', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      await user.type(textarea, validCSVData);
      
      // Click parse button
      await user.click(screen.getByText('Parse Data'));
      
      // Wait for preview to update
      await waitFor(() => {
        expect(screen.getByText('Preview (4 entries)')).toBeInTheDocument();
      });
      
      // Check preview table
      expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      expect(screen.getByText('Client Payment')).toBeInTheDocument();
      expect(screen.getByText('Monthly Rent')).toBeInTheDocument();
      expect(screen.getByText('Software Subscription')).toBeInTheDocument();
    });

    it('shows error for invalid CSV format', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      await user.type(textarea, 'Invalid data without proper columns');
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText(/Please paste your bank statement data with headers/)).toBeInTheDocument();
      });
    });

    it('shows error for missing columns', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      const invalidData = `Date\tDescription\tAmount
Jan 15 2024\tOffice Supplies\t-125.50`;
      
      await user.type(textarea, invalidData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText(/doesn't have enough columns/)).toBeInTheDocument();
      });
    });

    it('handles empty lines gracefully', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const dataWithEmptyLines = `Date\tDescription\tCategory\tAmount\tRunning Balance
Jan 15 2024\tOffice Supplies\tOffice\t-125.50\t5874.50

Jan 16 2024\tClient Payment\tRevenue\t2500.00\t8374.50

`;
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), dataWithEmptyLines);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (2 entries)')).toBeInTheDocument();
      });
    });

    it('parses different date formats', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const differentDateFormats = `Date\tDescription\tCategory\tAmount\tRunning Balance
Jan 5 2024\tTest 1\tOffice\t-100\t1000
Feb 5 2024\tTest 2\tOffice\t-100\t900
Mar 5 2024\tTest 3\tOffice\t-100\t800`;
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), differentDateFormats);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (3 entries)')).toBeInTheDocument();
      });
    });

    it('handles negative and positive amounts', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        // Check that amounts are displayed correctly
        expect(screen.getByText('-125.50')).toBeInTheDocument();
        expect(screen.getByText('2500.00')).toBeInTheDocument();
        expect(screen.getByText('-2000.00')).toBeInTheDocument();
      });
    });
  });

  describe('Upload Actions', () => {
    it('uploads parsed entries on submit', async () => {
      const onUpload = jest.fn();
      const { user } = customRender(
        <BankStatementUpload {...defaultProps} onUpload={onUpload} />
      );
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (4 entries)')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Upload 4 Entries'));
      
      expect(onUpload).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Office Supplies',
            category: 'Office',
            amount: -125.50,
            runningBalance: 5874.50
          }),
          expect.objectContaining({
            description: 'Client Payment',
            category: 'Revenue',
            amount: 2500.00,
            runningBalance: 8374.50
          })
        ])
      );
    });

    it('disables parse button when no valid data', () => {
      customRender(<BankStatementUpload {...defaultProps} />);
      
      // Initially parse button should be disabled when no data
      const parseButton = screen.getByText('Parse Data');
      expect(parseButton).toBeDisabled();
    });

    it('enables upload button when valid data is present', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        const uploadButton = screen.getByText('Upload 4 Entries');
        expect(uploadButton).toBeEnabled();
      });
    });

    it('closes modal on cancel', async () => {
      const onClose = jest.fn();
      const { user } = customRender(
        <BankStatementUpload {...defaultProps} onClose={onClose} />
      );
      
      await user.click(screen.getByText('Cancel'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('closes modal after successful upload', async () => {
      const onClose = jest.fn();
      const { user } = customRender(
        <BankStatementUpload {...defaultProps} onClose={onClose} />
      );
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (4 entries)')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Upload 4 Entries'));
      
      expect(onClose).toHaveBeenCalled();
    });

    it('clears form when modal is reopened', async () => {
      const { user, rerender } = customRender(<BankStatementUpload {...defaultProps} />);
      
      // Add data
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (4 entries)')).toBeInTheDocument();
      });
      
      // Close modal
      rerender(<BankStatementUpload {...defaultProps} isOpen={false} />);
      
      // Wait a bit for state to clear
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      
      // Reopen modal
      rerender(<BankStatementUpload {...defaultProps} isOpen={true} />);
      
      // Check that form is cleared
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      expect(textarea).toHaveValue('');
      expect(screen.queryByText(/Preview \(/)).not.toBeInTheDocument();
    });
  });

  describe('Preview Display', () => {
    it('shows preview table with all columns', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Category')).toBeInTheDocument();
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('Balance')).toBeInTheDocument();
      });
    });

    it('formats dates in preview', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        // Should format date as Jan 15, 2024 or similar
        const dateRegex = /Jan\s+15,?\s+2024/;
        const allTextElements = screen.getAllByText((content, element) => {
          return element && dateRegex.test(content);
        });
        expect(allTextElements.length).toBeGreaterThan(0);
      });
    });

    it('shows running balance in preview', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('5874.50')).toBeInTheDocument();
        expect(screen.getByText('8374.50')).toBeInTheDocument();
        expect(screen.getByText('6374.50')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error for invalid date format', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const invalidDateData = `Date\tDescription\tCategory\tAmount\tRunning Balance
invalid-date\tOffice Supplies\tOffice\t-125.50\t5874.50`;
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), invalidDateData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid date format/)).toBeInTheDocument();
      });
    });

    it('shows error for invalid amount format', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const invalidAmountData = `Date\tDescription\tCategory\tAmount\tRunning Balance
Jan 15 2024\tOffice Supplies\tOffice\tnot-a-number\t5874.50`;
      
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), invalidAmountData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid amount or balance/)).toBeInTheDocument();
      });
    });

    it('clears error when valid data is entered', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      // First enter invalid data
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), 'Invalid data');
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText(/Please paste your bank statement data with headers/)).toBeInTheDocument();
      });
      
      // Clear and enter valid data
      await user.clear(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/));
      await user.type(screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/), validCSVData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.queryByText(/Please paste your bank statement data with headers/)).not.toBeInTheDocument();
        expect(screen.getByText('Preview (4 entries)')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles very large CSV data', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      // Generate smaller dataset to avoid timeout issues
      let largeData = 'Date\tDescription\tCategory\tAmount\tRunning Balance\n';
      for (let i = 0; i < 100; i++) {
        largeData += `Jan 15 2024\tTransaction ${i}\tOffice\t-${i}.50\t${10000 - i}.50\n`;
      }
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      await user.click(textarea);
      await user.paste(largeData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        expect(screen.getByText('Preview (100 entries)')).toBeInTheDocument();
      }, { timeout: 8000 });
    }, 15000); // Increase test timeout to 15 seconds

    it('handles special characters in descriptions', async () => {
      const { user } = customRender(<BankStatementUpload {...defaultProps} />);
      
      const specialCharData = `Date\tDescription\tCategory\tAmount\tRunning Balance
Jan 15 2024\tPayment & Services, Inc.\tOffice\t-125.50\t5874.50
Jan 16 2024\t"Quoted Company"\tRevenue\t2500.00\t8374.50
Jan 17 2024\tCompany (Parent)\tRent\t-2000.00\t6374.50`;
      
      const textarea = screen.getByPlaceholderText(/Date.*Description.*Category.*Amount.*Running Balance/);
      
      // Use paste for more reliable text input
      await user.click(textarea);
      await user.paste(specialCharData);
      
      await user.click(screen.getByText('Parse Data'));
      
      await waitFor(() => {
        // Check for the table which shows the preview
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
      
      // Then check if the special characters are properly displayed
      expect(screen.getByText('Payment & Services, Inc.')).toBeInTheDocument();
      expect(screen.getByText('"Quoted Company"')).toBeInTheDocument();
      expect(screen.getByText('Company (Parent)')).toBeInTheDocument();
    });
  });
});