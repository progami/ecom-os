import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GL_ACCOUNT_CODES } from '@/config/account-codes';
import { Decimal } from '@prisma/client/runtime/library';

// Mock providers wrapper
export const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Custom render function that includes common providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const user = userEvent.setup();
  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options })
  };
}

// Alias for backward compatibility
export const customRender = renderWithProviders;

// Mock data generators
export const mockData = {
  expense: (overrides = {}) => ({
    id: 'exp-1',
    date: new Date('2025-01-15'),
    weekStarting: new Date('2025-01-13'),
    category: 'Payroll',
    subcategory: null,
    description: 'Monthly payroll',
    amount: 5000,
    type: 'manual',
    vendor: 'Internal',
    invoiceNumber: null,
    paymentMethod: 'credit_card',
    notes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  revenue: (overrides = {}) => ({
    id: 'rev-1',
    weekStarting: new Date('2025-01-06'),
    weekEnding: new Date('2025-01-12'),
    category: 'Amazon Sales',
    subcategory: 'TS-007',
    amount: new Decimal(10000),
    units: new Decimal(200),
    orderCount: new Decimal(50),
    product: 'Test Product',
    pricePerUnit: new Decimal(50),
    totalRevenue: new Decimal(10000),
    month: 'jan',
    quarter: 'Q1',
    year: 2025,
    productId: 'prod-1',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  product: (overrides = {}) => ({
    id: 'prod-1',
    sku: 'TS-007',
    name: 'Travel Set',
    description: 'Premium travel set',
    category: 'Sets',
    status: 'active',
    unitCost: new Decimal(20),
    packagingCost: new Decimal(2),
    laborCost: new Decimal(3),
    overheadCost: new Decimal(5),
    totalCost: new Decimal(30),
    retailPrice: new Decimal(50),
    wholesalePrice: new Decimal(40),
    amazonPrice: new Decimal(45),
    currentStock: 100,
    reorderPoint: 20,
    reorderQuantity: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  glEntry: (overrides = {}) => ({
    id: 'gl-1',
    date: new Date('2025-01-15'),
    account: 'Revenue - Amazon Sales',
    accountCategory: 'Revenue',
    accountCode: GL_ACCOUNT_CODES.CASH.code,
    accountName: 'Cash',
    description: 'Amazon sales for week',
    debit: 0,
    credit: 10000,
    source: 'automated',
    reference: 'REF-001',
    metadata: {},
    periodId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  inventoryBatch: (overrides = {}) => ({
    id: 'batch-1',
    batchNumber: 'BATCH-2025-001',
    productId: 'prod-1',
    sku: 'TEST-SKU',
    quantity: 500,
    remainingQty: 450,
    remainingQuantity: 450,
    unitCost: 20,
    totalCost: 10000,
    manufactureDate: new Date('2025-01-01'),
    expiryDate: new Date('2026-12-31'),
    receivedDate: new Date('2025-01-05'),
    status: 'active',
    location: 'Warehouse A',
    supplier: 'Supplier Inc',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  recurringExpense: (overrides = {}) => ({
    id: 'recurring-1',
    description: 'Monthly Subscription',
    amount: 99.99,
    category: 'software',
    frequency: 'monthly',
    dayOfMonth: 1,
    monthOfYear: null,
    active: true,
    startDate: new Date('2025-01-01'),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
};

// Table test helpers
export const getCellValue = (container: HTMLElement, row: number, col: number): string => {
  const rows = container.querySelectorAll('tbody tr');
  if (rows[row]) {
    const cells = rows[row].querySelectorAll('td');
    if (cells[col]) {
      return cells[col].textContent || '';
    }
  }
  return '';
};

// Helper to wait for loading states
export const waitForLoadingToFinish = async () => {
  const rtl = await import('@testing-library/react');
  await (rtl as any).waitFor(() => {
    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });
};

// Helper to fill form fields
export const fillForm = async (user: any, formData: Record<string, string | number>) => {
  for (const [field, value] of Object.entries(formData)) {
    const input = document.querySelector(`[name="${field}"]`) as HTMLElement;
    if (input) {
      await user.clear(input);
      await user.type(input, value.toString());
    }
  }
};

// Helper to select from dropdown
export const selectOption = async (user: any, label: string, optionText: string) => {
  const rtl = await import('@testing-library/react');
  const select = (rtl as any).screen.getByLabelText(label);
  await user.click(select);
  const option = (rtl as any).screen.getByText(optionText);
  await user.click(option);
};

// Date helpers
export const formatTestDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  const localStorageMock = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  return { store, mock: localStorageMock };
};

// Mock fetch for API calls
export const mockFetch = (responses: any) => {
  // Handle both single response and array of responses
  if (!Array.isArray(responses)) {
    responses = [{ url: /.+/, response: responses }];
  }
  
  global.fetch = jest.fn((url: string) => {
    const match = responses.find((r: any) => 
      typeof r.url === 'string' ? url.includes(r.url) : r.url.test(url)
    );
    
    if (match) {
      return Promise.resolve({
        ok: true,
        json: async () => match.response,
        text: async () => JSON.stringify(match.response),
        status: 200,
      } as Response);
    }
    
    return Promise.reject(new Error(`No mock for ${url}`));
  }) as jest.Mock;
};

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Re-export common testing utilities
export * from '@testing-library/react';
export { userEvent };