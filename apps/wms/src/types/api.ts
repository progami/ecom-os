/**
 * Clean API Types - V2
 * No backward compatibility, no duplicate fields
 */

// Transaction Types
export interface TransactionItem {
 skuCode: string
 batchLot: string
 quantity: number
 unit: 'CARTON' | 'PALLET' | 'UNIT'
 unitsPerCarton?: number
 cartonsPerPallet?: number
}

export interface CreateTransactionRequest {
 type: 'receive' | 'ship' | 'adjustment'
 warehouseCode: string
 referenceNumber: string
 items: TransactionItem[]
 supplierId?: string
 notes?: string
 shipmentDetails?: {
 shipName?: string
 trackingNumber?: string
 pickupDate?: string
 }
}

export interface Transaction {
 id: string
 type: string
 warehouseCode: string
 warehouseName: string
 skuCode: string
 skuDescription: string
 quantity: number
 unit: string
 batchLot: string
 referenceNumber: string
 notes?: string
 createdAt: Date
 createdBy: string
}

// SKU Types
export interface SKU {
 id: string
 skuCode: string
 description: string
 warehouseId: string
 unit?: string
 reorderPoint?: number
 reorderQuantity?: number
 unitsPerCarton?: number
 cartonsPerPallet?: number
 currentInventory: number
 availableInventory: number
 lastActivityDate?: Date
}

// Dashboard Types
export interface DashboardStats {
 inventory: {
 totalSkus: number
 totalQuantity: number
 lowStockItems: number
 outOfStockItems: number
 }
 transactions: {
 todayReceived: number
 todayShipped: number
 weekReceived: number
 weekShipped: number
 }
 finance: {
 pendingInvoices: number
 monthlyRevenue: number
 monthlyExpenses: number
 }
 warehouses: {
 activeCount: number
 utilizationRate: number
 }
}

// Inventory Types
export interface InventoryBalance {
 skuCode: string
 description: string
 warehouseCode: string
 batchLot: string
 currentBalance: number
 lastActivity: Date
 status: 'in-stock' | 'low-stock' | 'out-of-stock'
}

// Cost Ledger Types
export interface CostEntry {
 id: string
 transactionId: string
 costType: string
 amount: number
 description: string
 createdAt: Date
}

// API Response Types
export interface PaginatedResponse<T> {
 data: T[]
 pagination: {
 page: number
 limit: number
 total: number
 totalPages: number
 }
}

export interface ApiResponse<T> {
 data: T
 message?: string
}

export interface ApiError {
 error: string
 details?: Record<string, unknown>
}

// Filter Types
export interface TransactionFilters {
 warehouseCode?: string
 skuCode?: string
 type?: 'receive' | 'ship' | 'adjustment'
 startDate?: string
 endDate?: string
 page?: number
 limit?: number
}

export interface InventoryFilters {
 warehouseCode?: string
 skuCode?: string
 batchLot?: string
 status?: 'in-stock' | 'low-stock' | 'out-of-stock'
 page?: number
 limit?: number
}

// Warehouse Types
export interface Warehouse {
 id: string
 code: string
 name: string
 address?: string
 isActive: boolean
 skuCount: number
 transactionCount: number
 lastActivity?: Date
}

// Invoice Types (minimal, as functionality removed)
export interface Invoice {
 id: string
 status: 'PENDING' | 'ACCEPTED' | 'DISPUTED'
 amount: number
 createdAt: Date
}