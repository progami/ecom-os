import { 
 UserRole, 
 TransactionType, 
 CostCategory
} from '@ecom-os/prisma-wms'

// Re-export Prisma enums for convenience
export { 
 UserRole, 
 TransactionType, 
 CostCategory
}

// Legacy enums for backward compatibility (removed in v0.5.0)
// Dashboard Statistics
export interface DashboardStats {
 totalInventoryValue: number
 activeSkus: number
 monthlyStorageCost: number
 inventoryTurnover: number
 warehouseUtilization: number
}

// Inventory Types
export interface InventoryMovement {
 date: Date
 type: TransactionType
 quantity: number
 reference: string
 user: string
}

export interface InventoryLevel {
 warehouse: string
 sku: string
 batch: string
 cartons: number
 pallets: number
 units: number
 lastUpdated: Date
}

// Cost Types
export interface CostSummary {
 category: CostCategory
 amount: number
 quantity: number
 percentage: number
}

// Report Types
export interface StorageReport {
 weekEnding: Date
 warehouse: string
 totalPallets: number
 totalCost: number
 utilizationRate: number
}

export interface ActivityReport {
 date: Date
 inboundCartons: number
 outboundCartons: number
 adjustments: number
 netChange: number
}

// Form Types
export interface InventoryTransactionForm {
 warehouseId: string
 skuId: string
 batchLot: string
 transactionType: TransactionType
 quantity: number
 referenceId?: string
}

// Filter Types
export interface DateRange {
 from: Date
 to: Date
}

export interface InventoryFilters {
 warehouseId?: string
 skuId?: string
 batchLot?: string
 dateRange?: DateRange
 transactionType?: TransactionType
}

// API Response Types
export interface ApiResponse<T> {
 data?: T
 error?: string
 success: boolean
}

export interface PaginatedResponse<T> {
 items: T[]
 total: number
 page: number
 pageSize: number
 totalPages: number
}

// Auth Types
export interface LoginCredentials {
 email: string
 password: string
}

export interface UserCreateInput {
 email: string
 password: string
 fullName: string
 role: UserRole
 warehouseId?: string
}

// Export/Import Types
export interface ExportOptions {
 format: 'csv' | 'excel' | 'pdf'
 dateRange?: DateRange
 columns?: string[]
}

export interface ImportResult {
 success: number
 failed: number
 errors: Array<{
 row: number
 field: string
 message: string
 }>
}
