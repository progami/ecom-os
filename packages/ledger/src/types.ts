export type LedgerGroupBy = 'week' | 'month'

export interface InventoryTransactionRecord {
  id?: string
  transactionId?: string
  transactionDate: Date
  transactionType: string
  warehouseCode: string
  warehouseName: string
  skuCode: string
  skuDescription: string
  batchLot: string
  cartonsIn: number
  cartonsOut: number
  unitsPerCarton?: number | null
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
  createdByName?: string | null
  createdById?: string | null
  referenceId?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
}

export interface InventoryReceiveMetadata {
  transactionDate: Date
  createdByName?: string | null
  createdById?: string | null
}

export interface InventoryBalanceSnapshot {
  id: string
  warehouseCode: string
  warehouseName: string
  skuCode: string
  skuDescription: string
  batchLot: string
  currentCartons: number
  currentUnits: number
  currentPallets: number
  unitsPerCarton: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  lastTransactionDate: Date | null
  lastTransactionId?: string | null
  lastTransactionType?: string | null
  lastTransactionReference?: string | null
  purchaseOrderId?: string | null
  purchaseOrderNumber?: string | null
  firstReceive?: InventoryReceiveMetadata
}

export interface InventoryAggregationSummary {
  totalSkuCount: number
  totalBatchCount: number
  batchesWithInventory: number
  batchesOutOfStock: number
}

export interface InventoryAggregationResult {
  balances: InventoryBalanceSnapshot[]
  summary: InventoryAggregationSummary
}

export interface CostLedgerTransactionContext {
  transactionType?: string | null
  warehouseCode?: string | null
  warehouseName?: string | null
  skuCode?: string | null
  skuDescription?: string | null
  batchLot?: string | null
}

export interface CostLedgerEntryRecord {
  id?: string
  transactionId: string
  costCategory: string
  costName: string
  quantity?: number | string | null
  unitRate?: number | string | null
  totalCost?: number | string | null
  createdAt: Date
  warehouseCode?: string | null
  context?: CostLedgerTransactionContext | null
}

export interface CostLedgerDetail {
  transactionId: string
  transactionDate: Date
  transactionType: string
  warehouse: string
  sku: string
  batchLot: string
  costCategory: string
  costName: string
  quantity: number
  unitRate: number
  totalCost: number
}

export interface CostLedgerBucketTotals {
  storage: number
  container: number
  pallet: number
  carton: number
  unit: number
  transportation: number
  accessorial: number
  other: number
  total: number
}

export interface CostLedgerGroupResult {
  period: string
  rangeStart: string
  rangeEnd: string
  costs: CostLedgerBucketTotals
  transactions: string[]
  details: CostLedgerDetail[]
}

export interface CostLedgerAggregationResult {
  groups: CostLedgerGroupResult[]
  totals: CostLedgerBucketTotals
}
