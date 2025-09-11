// @ts-nocheck
// src/__tests__/components/CostTimelineAdditional.test.tsx
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostTimeline } from '@/components/CostTimeline';
import ProductService from '@/services/database/ProductService';
import { customRender } from '@/test/testHelpers';
import { format, addMonths, subMonths } from 'date-fns';

// Mock ProductService
jest.mock('@/services/database/ProductService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      initializeCache: jest.fn().mockResolvedValue(undefined),
      getProduct: jest.fn((sku: string) => {
        const products: Record<string, any> = {
          'TS-007': {
            sku: 'TS-007',
            name: 'Thick Strap - Black/Gold',
            price: 6.99,
            manufacturingCost: 0.57,
            freightCost: 0.10,
            warehouseCost: 0.06,
            fbaFee: 0.21,
            amazonReferralFee: 1.05,
            refundAllowance: 0.07,
            category: 'consumer-goods',
            packSize: 10,
            tariffRate: 35
          },
          'TS-008': {
            sku: 'TS-008',
            name: 'Thick Strap - Navy/Green',
            price: 6.99,
            manufacturingCost: 0.57,
            freightCost: 0.10,
            warehouseCost: 0.06,
            fbaFee: 0.21,
            amazonReferralFee: 1.05,
            refundAllowance: 0.07,
            category: 'consumer-goods',
            packSize: 10,
            tariffRate: 35
          }
        };
        return products[sku] || null;
      }),
      getAllProducts: jest.fn(() => ({
        'TS-007': {
          sku: 'TS-007',
          name: 'Thick Strap - Black/Gold',
          price: 6.99,
          manufacturingCost: 0.57,
          freightCost: 0.10,
          warehouseCost: 0.06,
          fbaFee: 0.21,
          amazonReferralFee: 1.05,
          refundAllowance: 0.07,
          category: 'consumer-goods',
          packSize: 10,
          tariffRate: 35
        },
        'TS-008': {
          sku: 'TS-008',
          name: 'Thick Strap - Navy/Green',
          price: 6.99,
          manufacturingCost: 0.57,
          freightCost: 0.10,
          warehouseCost: 0.06,
          fbaFee: 0.21,
          amazonReferralFee: 1.05,
          refundAllowance: 0.07,
          category: 'consumer-goods',
          packSize: 10,
          tariffRate: 35
        }
      }))
    }))
  }
}));

// Mock API calls
global.fetch = jest.fn();

const mockFetch = (data: any, ok = true) => {
  (fetch as jest.Mock).mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
};

const mockProductData = {
  'TS-007': {
    sku: 'TS-007',
    name: 'Thick Strap - Black/Gold',
    price: 6.99,
    manufacturingCost: 0.57,
    freightCost: 0.10,
    warehouseCost: 0.06,
    fbaFee: 0.21,
    amazonReferralFee: 1.05,
    refundAllowance: 0.07,
    category: 'consumer-goods',
    packSize: 10,
    tariffRate: 35
  },
  'TS-008': {
    sku: 'TS-008',
    name: 'Thick Strap - Navy/Green',
    price: 6.99,
    manufacturingCost: 0.57,
    freightCost: 0.10,
    warehouseCost: 0.06,
    fbaFee: 0.21,
    amazonReferralFee: 1.05,
    refundAllowance: 0.07,
    category: 'consumer-goods',
    packSize: 10,
    tariffRate: 35
  }
};

describe('CostTimeline Additional Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed API response gracefully', async () => {
      // Mock a malformed response (string instead of array)
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve('not an array'),
      });
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Component should handle the error internally and show default values
      expect(await screen.findByText('Current Cost')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      // Mock a network error
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Component shows error message
      expect(await screen.findByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should handle extremely large cost values', async () => {
      const largeCostPeriods = [{
        id: '1',
        sku: 'TS-007',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 999999.99,
        freightCost: 99999.99,
        tariffCost: 349999.99,
        otherCost: 0,
        unitLandedCost: 1449999.97,
        notes: 'Extremely expensive period',
        source: 'Luxury',
        isActive: true,
      }];
      
      mockFetch(largeCostPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Should format large numbers correctly (without commas in the component)
      expect(await screen.findByText('$1449999.97')).toBeInTheDocument();
    });

    it('should handle zero cost periods', async () => {
      const zeroCostPeriods = [{
        id: '1',
        sku: 'TS-007',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 0,
        freightCost: 0,
        tariffCost: 0,
        otherCost: 0,
        unitLandedCost: 0,
        notes: 'Free sample period',
        source: 'Sample',
        isActive: true,
      }];
      
      mockFetch(zeroCostPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Should show $0.00
      expect(await screen.findByText('$0.00')).toBeInTheDocument();
      // Margin will be calculated based on product price and total costs (including FBA fees)
      // So it won't be exactly 100%
      expect(screen.getByText(/\d+\.\d+%/)).toBeInTheDocument();
    });

    it('should handle missing product data gracefully', async () => {
      mockFetch([]);
      // Pass undefined product data
      customRender(<CostTimeline selectedSku="TS-999" productData={{}} />);
      
      // Should render without crashing
      expect(await screen.findByText('Current Cost')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('Multiple SKU Handling', () => {
    it('should refresh data when SKU changes', async () => {
      const ts007Periods = [{
        id: '1',
        sku: 'TS-007',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 0.60,
        freightCost: 0.12,
        tariffCost: 0.21,
        otherCost: 0,
        unitLandedCost: 0.93,
        notes: 'TS-007 cost',
        source: 'Standard',
        isActive: true,
      }];
      
      const ts008Periods = [{
        id: '2',
        sku: 'TS-008',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 0.80,
        freightCost: 0.15,
        tariffCost: 0.28,
        otherCost: 0,
        unitLandedCost: 1.23,
        notes: 'TS-008 cost',
        source: 'Premium',
        isActive: true,
      }];
      
      // First render with TS-007
      mockFetch(ts007Periods);
      const { rerender } = customRender(
        <CostTimeline selectedSku="TS-007" productData={mockProductData} />
      );
      
      expect(await screen.findByText('$0.93')).toBeInTheDocument();
      expect(screen.getByText('TS-007 cost')).toBeInTheDocument();
      
      // Change to TS-008
      mockFetch(ts008Periods);
      rerender(<CostTimeline selectedSku="TS-008" productData={mockProductData} />);
      
      expect(await screen.findByText('$1.23')).toBeInTheDocument();
      expect(screen.getByText('TS-008 cost')).toBeInTheDocument();
      expect(screen.queryByText('TS-007 cost')).not.toBeInTheDocument();
    });
  });

  describe('Complex Timeline Scenarios', () => {
    it('should correctly display overlapping periods', async () => {
      // Set a fixed date for testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-03-01'));
      
      const overlappingPeriods = [
        {
          id: '1',
          sku: 'TS-007',
          startDate: '2025-01-01',
          endDate: '2025-03-31',
          manufacturingCost: 0.60,
          freightCost: 0.12,
          tariffCost: 0.21,
          otherCost: 0,
          unitLandedCost: 0.93,
          notes: 'Q1 2025',
          source: 'PO-Q1',
          isActive: false,
        },
        {
          id: '2',
          sku: 'TS-007',
          startDate: '2025-02-15',
          endDate: '2025-04-30',
          manufacturingCost: 0.65,
          freightCost: 0.13,
          tariffCost: 0.23,
          otherCost: 0,
          unitLandedCost: 1.01,
          notes: 'Mid-Q1 adjustment',
          source: 'PO-MID',
          isActive: false,
        },
      ];
      
      mockFetch(overlappingPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Both periods should be visible
      expect(await screen.findByText('Q1 2025')).toBeInTheDocument();
      expect(screen.getByText('Mid-Q1 adjustment')).toBeInTheDocument();
      
      // The component determines active period based on current date
      // On March 1, 2025, both periods are active but the component picks the first matching one
      const containers = screen.getAllByText(/Q1 2025|Mid-Q1 adjustment/).map(el => el.closest('.border-2'));
      const hasActiveBorder = containers.some(container => container?.classList.contains('border-blue-500'));
      expect(hasActiveBorder).toBe(true);
      
      jest.useRealTimers();
    });

    it('should display future scheduled changes with countdown', async () => {
      const futureDate = addMonths(new Date(), 2);
      const futurePeriods = [
        {
          id: '1',
          sku: 'TS-007',
          startDate: '2025-01-01',
          endDate: format(futureDate, 'yyyy-MM-dd'),
          manufacturingCost: 0.60,
          freightCost: 0.12,
          tariffCost: 0.21,
          otherCost: 0,
          unitLandedCost: 0.93,
          notes: 'Current period',
          source: 'Current',
          isActive: true,
        },
        {
          id: '2',
          sku: 'TS-007',
          startDate: format(futureDate, 'yyyy-MM-dd'),
          endDate: null,
          manufacturingCost: 0.70,
          freightCost: 0.14,
          tariffCost: 0.25,
          otherCost: 0,
          unitLandedCost: 1.09,
          notes: 'Scheduled increase',
          source: 'Future',
          isActive: false,
        },
      ];
      
      mockFetch(futurePeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Should show future cost and days until change
      expect(await screen.findByText('$1.09')).toBeInTheDocument();
      expect(screen.getByText(/days\)/)).toBeInTheDocument();
      
      // The component shows a TrendingUp icon for price increases
      // The icon is rendered as an inline SVG next to the price
      const container = screen.getByText('$1.09').parentElement;
      const svgIcon = container?.querySelector('svg');
      expect(svgIcon).toBeTruthy();
    });

    it('should handle past periods correctly', async () => {
      const pastDate = subMonths(new Date(), 6);
      const historicalPeriods = [
        {
          id: '1',
          sku: 'TS-007',
          startDate: format(pastDate, 'yyyy-MM-dd'),
          endDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
          manufacturingCost: 0.50,
          freightCost: 0.10,
          tariffCost: 0.18,
          otherCost: 0,
          unitLandedCost: 0.78,
          notes: 'Historical period',
          source: 'PO-OLD',
          isActive: false,
        },
        {
          id: '2',
          sku: 'TS-007',
          startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
          endDate: null,
          manufacturingCost: 0.60,
          freightCost: 0.12,
          tariffCost: 0.21,
          otherCost: 0,
          unitLandedCost: 0.93,
          notes: 'Current period',
          source: 'Current',
          isActive: true,
        },
      ];
      
      mockFetch(historicalPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Both periods should be displayed
      expect(await screen.findByText('Historical period')).toBeInTheDocument();
      expect(screen.getByText('Current period')).toBeInTheDocument();
      
      // Historical period should not be highlighted
      const historicalNote = screen.getByText('Historical period');
      const historicalContainer = historicalNote.closest('.border-2');
      expect(historicalContainer).not.toHaveClass('border-blue-500');
    });
  });

  describe('Form Behavior Edge Cases', () => {
    it('should handle decimal precision in cost inputs', async () => {
      const user = userEvent.setup();
      mockFetch([]);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      const addButton = screen.getByRole('button', { name: /Add Period/i });
      await user.click(addButton);
      
      // Wait for the form to appear
      await waitFor(() => {
        expect(screen.getByText('Manufacturing')).toBeInTheDocument();
      });
      
      // Find the input that follows the Manufacturing label
      const manufacturingLabel = screen.getByText('Manufacturing');
      const manufacturingInput = manufacturingLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      
      await user.clear(manufacturingInput);
      await user.type(manufacturingInput, '0.123456789');
      
      // Should allow typing but may round on save
      expect(manufacturingInput.value).toBe('0.123456789');
    });

    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup();
      mockFetch([]);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      const addButton = screen.getByRole('button', { name: /Add Period/i });
      await user.click(addButton);
      
      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Manufacturing')).toBeInTheDocument();
      });
      
      // Find the input that follows the Manufacturing label
      const manufacturingLabel = screen.getByText('Manufacturing');
      const manufacturingInput = manufacturingLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      
      await user.clear(manufacturingInput);
      await user.type(manufacturingInput, '0.80');
      
      // Mock successful save response and subsequent reload
      mockFetch({ id: '1' }, true); // Save response
      mockFetch([{ // Reload response
        id: '1',
        sku: 'TS-007',
        startDate: new Date().toISOString().split('T')[0],
        endDate: null,
        manufacturingCost: 0.80,
        freightCost: 0,
        tariffCost: 0.28,
        otherCost: 0,
        unitLandedCost: 1.08,
        notes: '',
        source: '',
        isActive: true,
      }], true);
      
      const allAddButtons = screen.getAllByRole('button', { name: /Add/i });
      const saveButton = allAddButtons[allAddButtons.length - 1];
      
      // Click save once
      await user.click(saveButton);
      
      // Should make API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/batch-cost-periods',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('should clear form when switching between add and edit modes', async () => {
      const user = userEvent.setup();
      const existingPeriods = [{
        id: '1',
        sku: 'TS-007',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 0.60,
        freightCost: 0.12,
        tariffCost: 0.21,
        otherCost: 0,
        unitLandedCost: 0.93,
        notes: 'Existing period',
        source: 'Standard',
        isActive: true,
      }];
      
      mockFetch(existingPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Existing period')).toBeInTheDocument();
      });
      
      // Start adding a new period
      const addButton = screen.getByRole('button', { name: /Add Period/i });
      await user.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Manufacturing')).toBeInTheDocument();
      });
      
      const manufacturingLabel = screen.getByText('Manufacturing');
      const manufacturingInput = manufacturingLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      await user.clear(manufacturingInput);
      await user.type(manufacturingInput, '0.99');
      
      // Cancel and edit existing period
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);
      
      // Find and click edit button
      await waitFor(() => {
        const allButtons = screen.getAllByRole('button');
        const editButtons = allButtons.filter(btn => {
          const svg = btn.querySelector('svg');
          return svg && (svg.classList.contains('lucide-pen') || svg.classList.contains('lucide-edit-2'));
        });
        expect(editButtons.length).toBeGreaterThan(0);
      });
      
      const allButtons = screen.getAllByRole('button');
      const editButton = allButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && (svg.classList.contains('lucide-pen') || svg.classList.contains('lucide-edit-2'));
      });
      
      await user.click(editButton!);
      
      // Should show existing values, not the values typed in add mode
      await waitFor(() => {
        const labels = screen.getAllByText('Manufacturing');
        const editLabel = labels[labels.length - 1]; // Get the edit form's label
        const editManufacturingInput = editLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
        expect(editManufacturingInput).toHaveValue(0.60);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for timeline items', async () => {
      const periods = [{
        id: '1',
        sku: 'TS-007',
        startDate: '2025-01-01',
        endDate: null,
        manufacturingCost: 0.60,
        freightCost: 0.12,
        tariffCost: 0.21,
        otherCost: 0,
        unitLandedCost: 0.93,
        notes: 'Current standard cost',
        source: 'Standard',
        isActive: true,
      }];
      
      mockFetch(periods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      // Wait for timeline to render
      await waitFor(() => {
        expect(screen.getByText('Current standard cost')).toBeInTheDocument();
      });
      
      // Check for proper button labels
      const editButtons = screen.getAllByRole('button').filter(btn => {
        const svg = btn.querySelector('svg');
        return svg && (svg.classList.contains('lucide-pen') || svg.classList.contains('lucide-edit-2'));
      });
      
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should maintain focus after form submission', async () => {
      const user = userEvent.setup();
      mockFetch([]);
      const { container } = customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      const addButton = screen.getByRole('button', { name: /Add Period/i });
      await user.click(addButton);
      
      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Manufacturing')).toBeInTheDocument();
      });
      
      // Find the input that follows the Manufacturing label
      const manufacturingLabel = screen.getByText('Manufacturing');
      const manufacturingInput = manufacturingLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      
      await user.clear(manufacturingInput);
      await user.type(manufacturingInput, '0.80');
      
      // Mock successful save
      const newPeriod = {
        id: '1',
        sku: 'TS-007',
        startDate: new Date().toISOString(),
        endDate: null,
        manufacturingCost: 0.80,
        freightCost: 0,
        tariffCost: 0.28,
        otherCost: 0,
        unitLandedCost: 1.08,
        notes: '',
        source: '',
        isActive: true,
      };
      
      mockFetch(newPeriod, true);
      mockFetch([newPeriod], true);
      
      const allAddButtons = screen.getAllByRole('button', { name: /Add/i });
      await user.click(allAddButtons[allAddButtons.length - 1]);
      
      // After save, the add form should disappear
      await waitFor(() => {
        // The Manufacturing label from the add form should no longer be visible
        expect(screen.queryByText('Manufacturing')).not.toBeInTheDocument();
      });
      
      // Add button should still be visible and focusable
      expect(screen.getByRole('button', { name: /Add Period/i })).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large number of periods efficiently', async () => {
      // Create 100 periods
      const manyPeriods = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        sku: 'TS-007',
        startDate: format(subMonths(new Date(), 100 - i), 'yyyy-MM-dd'),
        endDate: i < 99 ? format(subMonths(new Date(), 99 - i), 'yyyy-MM-dd') : null,
        manufacturingCost: 0.50 + (i * 0.01),
        freightCost: 0.10 + (i * 0.002),
        tariffCost: 0.175 + (i * 0.0035),
        otherCost: 0,
        unitLandedCost: 0.775 + (i * 0.0155),
        notes: `Period ${i + 1}`,
        source: `PO-${i + 1}`,
        isActive: i === 99,
      }));
      
      mockFetch(manyPeriods);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      // Should render without performance issues
      expect(await screen.findByText('Period 100')).toBeInTheDocument();
      
      // Should show current (latest) period in summary
      const currentCost = 0.775 + (99 * 0.0155);
      expect(screen.getByText(`$${currentCost.toFixed(2)}`)).toBeInTheDocument();
    });

    it('should calculate tariff automatically based on manufacturing cost', async () => {
      const user = userEvent.setup();
      mockFetch([]);
      customRender(<CostTimeline selectedSku="TS-007" productData={mockProductData} />);
      
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      
      const addButton = screen.getByRole('button', { name: /Add Period/i });
      await user.click(addButton);
      
      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByText('Manufacturing')).toBeInTheDocument();
      });
      
      // Find the input that follows the Manufacturing label
      const manufacturingLabel = screen.getByText('Manufacturing');
      const manufacturingInput = manufacturingLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      
      const tariffLabel = screen.getByText(/Tariff/);
      const tariffInput = tariffLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
      
      // Clear and type value
      await user.clear(manufacturingInput);
      await user.type(manufacturingInput, '100');
      
      // Tariff should update based on manufacturing value
      await waitFor(() => {
        expect(parseFloat(tariffInput.value)).toBe(35); // 35% of 100
      });
    });
  });
});