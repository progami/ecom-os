import React from 'react'
import { render as rtlRender } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'

// Mock session data for different user roles
export const mockSessions = {
  admin: {
    user: {
      id: 'admin-id',
      name: 'Admin User',
      email: 'admin@warehouse.com',
      role: 'admin' as const,
      warehouseId: null,
    },
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
  },
  warehouseStaff: {
    user: {
      id: 'staff-id',
      name: 'Warehouse Staff',
      email: 'staff@warehouse.com',
      role: 'warehouse_staff' as const,
      warehouseId: 'warehouse-1',
    },
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
  },
  financeAdmin: {
    user: {
      id: 'finance-id',
      name: 'Finance Admin',
      email: 'finance@warehouse.com',
      role: 'finance_admin' as const,
      warehouseId: null,
    },
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
  },
  manager: {
    user: {
      id: 'manager-id',
      name: 'Manager User',
      email: 'manager@warehouse.com',
      role: 'manager' as const,
      warehouseId: null,
    },
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
  },
  viewer: {
    user: {
      id: 'viewer-id',
      name: 'Viewer User',
      email: 'viewer@warehouse.com',
      role: 'viewer' as const,
      warehouseId: null,
    },
    expires: new Date(Date.now() + 2 * 86400).toISOString(),
  },
}

// Custom render function that includes providers
export function render(
  ui: React.ReactElement,
  {
    session = mockSessions.admin,
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider session={session}>
        {children}
      </SessionProvider>
    )
  }
  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock data generators
export const mockData = {
  warehouse: (overrides = {}) => ({
    id: 'warehouse-1',
    code: 'FMC',
    name: 'FMC',
    address: '123 Warehouse St',
    contactEmail: 'fmc@warehouse.com',
    contactPhone: '+1234567890',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  sku: (overrides = {}) => ({
    id: 'sku-1',
    skuCode: 'CS-001',
    asin: 'B001234567',
    description: 'Test Product',
    packSize: 1,
    material: 'Plastic',
    unitDimensionsCm: '10x10x10',
    unitWeightKg: 0.5,
    unitsPerCarton: 12,
    cartonDimensionsCm: '40x40x40',
    cartonWeightKg: 6.5,
    packagingType: 'Box',
    notes: 'Test notes',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  inventoryBalance: (overrides = {}) => ({
    id: 'balance-1',
    warehouseId: 'warehouse-1',
    skuId: 'sku-1',
    batchLot: 'BATCH001',
    currentCartons: 100,
    currentPallets: 5,
    currentUnits: 1200,
    lastTransactionDate: new Date(),
    warehouse: mockData.warehouse(),
    sku: mockData.sku(),
    ...overrides,
  }),
  
  inventoryTransaction: (overrides = {}) => ({
    id: 'transaction-1',
    transactionId: 'TRX-001',
    warehouseId: 'warehouse-1',
    skuId: 'sku-1',
    batchLot: 'BATCH001',
    transactionType: 'RECEIVE',
    referenceId: 'PO-001',
    cartonsIn: 50,
    cartonsOut: 0,
    storagePalletsIn: 2,
    shippingPalletsOut: 0,
    notes: 'Test transaction',
    transactionDate: new Date(),
    createdAt: new Date(),
    createdById: 'user-1',
    warehouse: mockData.warehouse(),
    sku: mockData.sku(),
    createdBy: mockData.user(),
    ...overrides,
  }),
  
  user: (overrides = {}) => ({
    id: 'user-1',
    email: 'test@warehouse.com',
    fullName: 'Test User',
    role: 'admin',
    warehouseId: null,
    passwordHash: 'hashed-password',
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  
  costRate: (overrides = {}) => ({
    id: 'rate-1',
    warehouseId: 'warehouse-1',
    costCategory: 'Storage',
    costName: 'Weekly Storage',
    costValue: 3.9,
    unitOfMeasure: 'pallet/week',
    effectiveDate: new Date('2024-01-01'),
    endDate: null,
    notes: 'Standard storage rate',
    createdAt: new Date(),
    createdById: 'user-1',
    warehouse: mockData.warehouse(),
    createdBy: mockData.user(),
    ...overrides,
  }),
  
  storageLedger: (overrides = {}) => ({
    id: 'storage-1',
    slId: 'SL-2024-01-01-FMC-CS001-BATCH001',
    weekEndingDate: new Date('2024-01-07'),
    warehouseId: 'warehouse-1',
    skuId: 'sku-1',
    batchLot: 'BATCH001',
    cartonsEndOfMonday: 100,
    storagePalletsCharged: 5,
    applicableWeeklyRate: 3.9,
    calculatedWeeklyCost: 19.5,
    billingPeriodStart: new Date('2023-12-16'),
    billingPeriodEnd: new Date('2024-01-15'),
    createdAt: new Date(),
    warehouse: mockData.warehouse(),
    sku: mockData.sku(),
    ...overrides,
  }),
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'