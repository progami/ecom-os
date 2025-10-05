'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Search, Building, Package, ArrowUpDown, ArrowUp, ArrowDown, Filter, BookOpen } from '@/lib/lucide-icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { StatsCard, StatsCardGrid } from '@/components/ui/stats-card'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface InventoryBalance {
  id: string
  warehouseId: string | null
  warehouse: {
    code: string
    name: string
  }
  skuId: string | null
  sku: {
    skuCode: string
    description: string
    unitsPerCarton: number
  }
  batchLot: string
  currentCartons: number
  currentPallets: number
  currentUnits: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
  lastTransactionDate: string | null
  lastTransactionId?: string
  lastTransactionType?: string
  lastTransactionReference?: string | null
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  receiveTransaction?: {
    createdBy?: {
      fullName: string
    }
    transactionDate: string
  }
}

type MovementType = 'positive' | 'negative' | 'netZero'

const LEDGER_TIME_FORMAT = 'PPP p'

function formatLedgerTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return format(date, LEDGER_TIME_FORMAT)
}

const NEGATIVE_MOVEMENT_TYPES = new Set([
  'SHIP',
  'TRANSFER_OUT',
  'ADJUST_OUT',
  'ADJUSTMENT_OUT',
  'WRITE_OFF',
])

const POSITIVE_MOVEMENT_TYPES = new Set([
  'RECEIVE',
  'TRANSFER_IN',
  'ADJUST_IN',
  'ADJUSTMENT_IN',
  'RETURN',
  'RETURN_IN',
])

function getMovementTypeFromTransaction(type?: string | null): MovementType {
  if (!type) {
    return 'netZero'
  }
  const normalized = type.toUpperCase()
  if (NEGATIVE_MOVEMENT_TYPES.has(normalized)) {
    return 'negative'
  }
  if (POSITIVE_MOVEMENT_TYPES.has(normalized)) {
    return 'positive'
  }
  return 'netZero'
}

function getMovementMultiplier(type?: string | null) {
  const movement = getMovementTypeFromTransaction(type)
  if (movement === 'negative') return -1
  if (movement === 'positive') return 1
  return 0
}

interface InventorySummary {
  totalSkuCount: number
  totalBatchCount: number
  batchesWithInventory: number
  batchesOutOfStock: number
}

interface InventoryResponse {
  data: InventoryBalance[]
  pagination?: {
    totalCount: number
  }
  summary?: InventorySummary
}

type SortKey = 'warehouse' | 'sku' | 'batch' | 'cartons' | 'pallets' | 'units' | 'lastTransaction'

interface ColumnFiltersState {
  warehouse: string[]
  sku: string[]
  skuDescription: string
  batch: string[]
  lastTransaction: string
  movement: MovementType[]
  cartonsMin: string
  cartonsMax: string
  palletsMin: string
  palletsMax: string
  unitsMin: string
  unitsMax: string
}

const createColumnFilterDefaults = (): ColumnFiltersState => ({
  warehouse: [],
  sku: [],
  skuDescription: '',
  batch: [],
  lastTransaction: '',
  movement: [],
  cartonsMin: '',
  cartonsMax: '',
  palletsMin: '',
  palletsMax: '',
  unitsMin: '',
  unitsMax: '',
})

type ColumnFilterKey = keyof ColumnFiltersState

const balanceDateToTime = (value: string | null) => {
  if (!value) {
    return 0
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [_loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => createColumnFilterDefaults())
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', `${window.location.origin}/operations/inventory`)
      window.location.href = url.toString()
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        showZeroStock: 'false',
      })

      const response = await fetch(`/api/inventory/balances?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(`Failed to load inventory balances: ${errorData.error || response.statusText}`)
        return
      }

      const payload: InventoryResponse | InventoryBalance[] = await response.json()

      if (Array.isArray(payload)) {
        setBalances(payload)
        setSummary(null)
      } else {
        setBalances(payload.data || [])
        setSummary(payload.summary ?? null)
      }
    } catch (_error) {
      toast.error('Failed to load inventory balances')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchBalances()
    }
  }, [fetchBalances, status])

  const headerActions = useMemo(() => null, [])

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        }
        return null
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const updateColumnFilter = useCallback(<K extends ColumnFilterKey>(key: K, value: ColumnFiltersState[K]) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const toggleMultiValueFilter = useCallback(
    (key: 'warehouse' | 'sku' | 'batch', value: string) => {
      setColumnFilters(prev => {
        const current = prev[key] as string[]
        const nextValues = current.includes(value)
          ? current.filter(item => item !== value)
          : [...current, value]
        return {
          ...prev,
          [key]: nextValues as ColumnFiltersState[typeof key],
        }
      })
    },
    []
  )

  const clearColumnFilter = useCallback((keys: ColumnFilterKey[]) => {
    setColumnFilters(prev => {
      const defaults = createColumnFilterDefaults()
      const next = { ...prev }
      for (const key of keys) {
        switch (key) {
          case 'warehouse':
            next.warehouse = defaults.warehouse
            break
          case 'sku':
            next.sku = defaults.sku
            break
          case 'skuDescription':
            next.skuDescription = defaults.skuDescription
            break
          case 'batch':
            next.batch = defaults.batch
            break
          case 'lastTransaction':
            next.lastTransaction = defaults.lastTransaction
            break
          case 'cartonsMin':
            next.cartonsMin = defaults.cartonsMin
            break
          case 'cartonsMax':
            next.cartonsMax = defaults.cartonsMax
            break
          case 'palletsMin':
            next.palletsMin = defaults.palletsMin
            break
          case 'palletsMax':
            next.palletsMax = defaults.palletsMax
            break
          case 'unitsMin':
            next.unitsMin = defaults.unitsMin
            break
          case 'unitsMax':
            next.unitsMax = defaults.unitsMax
            break
          default:
            break
        }
      }
      return next
    })
  }, [])

  const isFilterActive = useCallback(
    (keys: ColumnFilterKey[]) =>
      keys.some(key => {
        const value = columnFilters[key]
        return Array.isArray(value) ? value.length > 0 : value.trim().length > 0
      }),
    [columnFilters]
  )

  const uniqueWarehouseOptions = useMemo(() => {
    const map = new Map<string, { name: string; code?: string | null }>()
    balances.forEach(balance => {
      const value = (balance.warehouseId || balance.warehouse.code || balance.warehouse.name)?.toString().trim()
      if (!value) return
      if (!map.has(value)) {
        const name = balance.warehouse.name?.trim() || 'Unnamed Warehouse'
        const code = balance.warehouse.code?.trim()
        map.set(value, { name, code })
      }
    })
    return Array.from(map.entries())
      .map(([value, info]) => ({
        value,
        label: info.code ? `${info.name} (${info.code})` : info.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [balances])

  const uniqueSkuOptions = useMemo(() => {
    const map = new Map<string, string>()
    balances.forEach(balance => {
      const code = balance.sku.skuCode?.trim()
      if (!code) return
      if (!map.has(code)) {
        const description = balance.sku.description?.trim()
        map.set(code, description ? `${code} — ${description}` : code)
      }
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [balances])

  const uniqueBatchOptions = useMemo(() => {
    const set = new Set<string>()
    balances.forEach(balance => {
      const batch = balance.batchLot?.trim()
      if (batch) {
        set.add(batch)
      }
    })
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).map(value => ({
      value,
      label: value,
    }))
  }, [balances])

  const processedBalances = useMemo(() => {
    const parseNumber = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return null
      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? null : parsed
    }

    const filtered = balances.filter(balance => {
      const movementType = getMovementTypeFromTransaction(balance.lastTransactionType)

      if (columnFilters.warehouse.length > 0) {
        const warehouseIdentifier = (balance.warehouseId || balance.warehouse.code || balance.warehouse.name)?.toString().trim()
        if (!warehouseIdentifier || !columnFilters.warehouse.includes(warehouseIdentifier)) {
          return false
        }
      }

      if (columnFilters.sku.length > 0) {
        const skuCode = balance.sku.skuCode?.trim()
        if (!skuCode || !columnFilters.sku.includes(skuCode)) {
          return false
        }
      }

      if (columnFilters.skuDescription) {
        const description = balance.sku.description?.trim().toLowerCase() ?? ''
        if (!description.includes(columnFilters.skuDescription.toLowerCase())) {
          return false
        }
      }

      if (columnFilters.batch.length > 0) {
        const batchLot = balance.batchLot?.trim()
        if (!batchLot || !columnFilters.batch.includes(batchLot)) {
          return false
        }
      }

      if (columnFilters.movement.length > 0 && !columnFilters.movement.includes(movementType)) {
        return false
      }

      if (columnFilters.lastTransaction) {
        const lastTransactionDisplay = formatLedgerTimestamp(balance.lastTransactionDate) ?? 'N/A'
        const filterValue = columnFilters.lastTransaction.toLowerCase()
        const typeMatch = balance.lastTransactionType
          ? balance.lastTransactionType.toLowerCase().includes(filterValue)
          : false
        if (
          !lastTransactionDisplay.toLowerCase().includes(filterValue) &&
          !typeMatch
        ) {
          return false
        }
      }

      const cartonsMin = parseNumber(columnFilters.cartonsMin)
      const cartonsMax = parseNumber(columnFilters.cartonsMax)
      if (cartonsMin !== null && balance.currentCartons < cartonsMin) {
        return false
      }
      if (cartonsMax !== null && balance.currentCartons > cartonsMax) {
        return false
      }

      const palletsMin = parseNumber(columnFilters.palletsMin)
      const palletsMax = parseNumber(columnFilters.palletsMax)
      if (palletsMin !== null && balance.currentPallets < palletsMin) {
        return false
      }
      if (palletsMax !== null && balance.currentPallets > palletsMax) {
        return false
      }

      const unitsMin = parseNumber(columnFilters.unitsMin)
      const unitsMax = parseNumber(columnFilters.unitsMax)
      if (unitsMin !== null && balance.currentUnits < unitsMin) {
        return false
      }
      if (unitsMax !== null && balance.currentUnits > unitsMax) {
        return false
      }

      return true
    })

    if (!sortConfig) {
      return filtered
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortConfig.key) {
        case 'warehouse':
          comparison = `${a.warehouse.name} ${a.warehouse.code}`.localeCompare(
            `${b.warehouse.name} ${b.warehouse.code}`,
            undefined,
            { sensitivity: 'base' }
          )
          break
        case 'sku':
          comparison = `${a.sku.skuCode} ${a.sku.description}`.localeCompare(
            `${b.sku.skuCode} ${b.sku.description}`,
            undefined,
            { sensitivity: 'base' }
          )
          break
        case 'batch':
          comparison = a.batchLot.localeCompare(b.batchLot, undefined, { sensitivity: 'base' })
          break
        case 'cartons':
          comparison = a.currentCartons - b.currentCartons
          break
        case 'pallets':
          comparison = a.currentPallets - b.currentPallets
          break
        case 'units':
          comparison = a.currentUnits - b.currentUnits
          break
        case 'lastTransaction': {
          const timeA = balanceDateToTime(a.lastTransactionDate)
          const timeB = balanceDateToTime(b.lastTransactionDate)
          comparison = timeA - timeB
          break
        }
        default:
          comparison = 0
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [balances, columnFilters, sortConfig])

  const tableTotals = useMemo(() => {
    return processedBalances.reduce(
      (acc, balance) => {
        const multiplier = getMovementMultiplier(balance.lastTransactionType)
        const baseCartons = Math.abs(balance.currentCartons)
        const basePallets = Math.abs(balance.currentPallets)
        const baseUnits = Math.abs(balance.currentUnits)

        acc.cartons += multiplier === 0 ? balance.currentCartons : multiplier * baseCartons
        acc.pallets += multiplier === 0 ? balance.currentPallets : multiplier * basePallets
        acc.units += multiplier === 0 ? balance.currentUnits : multiplier * baseUnits
        return acc
      },
      { cartons: 0, pallets: 0, units: 0 }
    )
  }, [processedBalances])

  const getSortIcon = useCallback((key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    }

    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="h-4 w-4 text-primary" />
    )
  }, [sortConfig])

  const metrics = useMemo(() => {
    const totalCartons = balances.reduce((sum, balance) => sum + balance.currentCartons, 0)
    const totalPallets = balances.reduce((sum, balance) => sum + balance.currentPallets, 0)
    const uniqueWarehouses = new Set(balances.map(balance => balance.warehouse.code)).size
    const uniqueSkusFallback = new Set(balances.map(balance => balance.sku.skuCode)).size
    const batchesWithInventoryFallback = balances.filter(balance => balance.currentCartons > 0).length
    const totalBatchCountFallback = balances.length
    const batchesOutOfStockFallback = Math.max(totalBatchCountFallback - batchesWithInventoryFallback, 0)

    return {
      totalCartons,
      totalPallets,
      uniqueWarehouses,
      summary: {
        totalSkuCount: summary?.totalSkuCount ?? uniqueSkusFallback,
        totalBatchCount: summary?.totalBatchCount ?? totalBatchCountFallback,
        batchesWithInventory: summary?.batchesWithInventory ?? batchesWithInventoryFallback,
        batchesOutOfStock: summary?.batchesOutOfStock ?? batchesOutOfStockFallback,
      }
    }
  }, [balances, summary])

  const baseFilterInputClass = 'w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary'

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Inventory Ledger"
          description="Operations"
          icon={BookOpen}
          actions={headerActions}
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            <StatsCardGrid cols={3}>
              <StatsCard
                title="Total Cartons"
                value={metrics.totalCartons}
                subtitle={`${metrics.uniqueWarehouses} ${metrics.uniqueWarehouses === 1 ? 'warehouse' : 'warehouses'}`}
                icon={Package}
                variant="info"
              />
              <StatsCard
                title="Total Pallets"
                value={metrics.totalPallets}
                subtitle="Calculated from cartons"
                icon={Building}
                variant="default"
              />
              <StatsCard
                title="Active SKUs"
                value={metrics.summary.totalSkuCount}
                subtitle="Reporting inventory"
                icon={Search}
                variant="default"
              />
            </StatsCardGrid>

            <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          {/* Reserve space for filters/stats before the table scroll area */}
          <div
            className="relative min-h-0 overflow-x-auto overflow-y-auto"
            style={{
              maxHeight: 'calc(100vh - 320px)',
              height: 'calc(100vh - 320px)',
              minHeight: 320
            }}
          >
            <table className="w-full min-w-[1200px] table-auto text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold w-48">
                  <span>PO Number</span>
                </th>
                <th className="px-3 py-2 text-left font-semibold w-56">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 text-left hover:text-primary focus:outline-none"
                      onClick={() => handleSort('warehouse')}
                    >
                      Warehouse
                      {getSortIcon('warehouse')}
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter warehouses"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['warehouse'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Warehouse filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['warehouse'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                          {uniqueWarehouseOptions.map(option => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 text-sm text-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={columnFilters.warehouse.includes(option.value)}
                                onChange={() => toggleMultiValueFilter('warehouse', option.value)}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="flex-1 text-sm">{option.label}</span>
                            </label>
                          ))}
                          {uniqueWarehouseOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">No warehouse options available.</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold w-40">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 text-left hover:text-primary focus:outline-none"
                      onClick={() => handleSort('sku')}
                    >
                      SKU
                      {getSortIcon('sku')}
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter SKUs"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['sku'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">SKU filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['sku'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                          {uniqueSkuOptions.map(option => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 text-sm text-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={columnFilters.sku.includes(option.value)}
                                onChange={() => toggleMultiValueFilter('sku', option.value)}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="flex-1 text-sm">{option.label}</span>
                            </label>
                          ))}
                          {uniqueSkuOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">No SKU options available.</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold w-64">
                  <div className="flex items-center gap-1">
                    <span>SKU Description</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter SKU descriptions"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['skuDescription'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">SKU description filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['skuDescription'])}
                          >
                            Clear
                          </button>
                        </div>
                        <input
                          type="text"
                          value={columnFilters.skuDescription}
                          onChange={(event) => updateColumnFilter('skuDescription', event.target.value)}
                          placeholder="Search SKU description"
                          className={baseFilterInputClass}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold w-40">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 text-left hover:text-primary focus:outline-none"
                      onClick={() => handleSort('batch')}
                    >
                      Batch / Lot
                      {getSortIcon('batch')}
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter batch / lot values"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['batch'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Batch / lot filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['batch'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                          {uniqueBatchOptions.map(option => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2 text-sm text-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={columnFilters.batch.includes(option.value)}
                                onChange={() => toggleMultiValueFilter('batch', option.value)}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="flex-1 text-sm">{option.label}</span>
                            </label>
                          ))}
                          {uniqueBatchOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">No batch options available.</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold w-40">
                  <span>Reference ID</span>
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  <button
                    type="button"
                    className="flex w-full items-center justify-end gap-1 hover:text-primary focus:outline-none"
                    onClick={() => handleSort('cartons')}
                  >
                    Cartons
                    {getSortIcon('cartons')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  <button
                    type="button"
                    className="flex w-full items-center justify-end gap-1 hover:text-primary focus:outline-none"
                    onClick={() => handleSort('pallets')}
                  >
                    Pallets
                    {getSortIcon('pallets')}
                  </button>
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  <button
                    type="button"
                    className="flex w-full items-center justify-end gap-1 hover:text-primary focus:outline-none"
                    onClick={() => handleSort('units')}
                  >
                    Units
                    {getSortIcon('units')}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold">Movement Type</th>
                <th className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1 text-left hover:text-primary focus:outline-none"
                      onClick={() => handleSort('lastTransaction')}
                    >
                      Transaction Date
                      {getSortIcon('lastTransaction')}
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter latest transactions"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['lastTransaction'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Transaction filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['lastTransaction'])}
                          >
                            Clear
                          </button>
                        </div>
                        <input
                          type="text"
                          value={columnFilters.lastTransaction}
                          onChange={(event) => updateColumnFilter('lastTransaction', event.target.value)}
                          placeholder="Search type or date"
                          className={baseFilterInputClass}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {processedBalances.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">
                    No inventory balances match the current filters.
                  </td>
                </tr>
              )}

              {processedBalances.map(balance => {
                const lastTransactionDisplay = formatLedgerTimestamp(balance.lastTransactionDate)
                const movementType = getMovementTypeFromTransaction(balance.lastTransactionType)
                const movementMultiplier = getMovementMultiplier(balance.lastTransactionType)
                const signedCartons = movementMultiplier === 0
                  ? balance.currentCartons
                  : movementMultiplier * Math.abs(balance.currentCartons)
                const signedPallets = movementMultiplier === 0
                  ? balance.currentPallets
                  : movementMultiplier * Math.abs(balance.currentPallets)
                const signedUnits = movementMultiplier === 0
                  ? balance.currentUnits
                  : movementMultiplier * Math.abs(balance.currentUnits)
                const movementLabel = movementType === 'positive'
                  ? 'Receive'
                  : movementType === 'negative'
                    ? 'Ship'
                    : 'Flat'
                const movementBadgeClasses = movementType === 'positive'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : movementType === 'negative'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-muted bg-muted/20 text-muted-foreground'

                const purchaseOrderLabel = balance.purchaseOrderNumber ?? '—'

                return (
                  <tr key={balance.id} className="odd:bg-muted/20">
                    <td
                      className="px-3 py-2 text-sm font-semibold text-foreground whitespace-nowrap"
                      title={balance.purchaseOrderNumber || undefined}
                    >
                      {purchaseOrderLabel}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                      {balance.warehouse.name}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-foreground whitespace-nowrap">
                      {balance.sku.skuCode}
                    </td>
                    <td
                      className="px-3 py-2 text-sm text-muted-foreground max-w-[16rem] truncate"
                      title={balance.sku.description || undefined}
                    >
                      {balance.sku.description || '—'}
                    </td>
                    <td
                      className="px-3 py-2 text-xs text-muted-foreground uppercase whitespace-nowrap max-w-[10rem] truncate"
                      title={balance.batchLot}
                    >
                      {balance.batchLot}
                    </td>
                    <td
                      className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap max-w-[10rem] truncate"
                      title={balance.lastTransactionReference || undefined}
                    >
                      {balance.lastTransactionReference ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-cyan-700 whitespace-nowrap">
                      {signedCartons.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm whitespace-nowrap">
                      {signedPallets.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm whitespace-nowrap">
                      {signedUnits.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium uppercase',
                          movementBadgeClasses
                        )}
                      >
                        {movementLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                      {lastTransactionDisplay ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="sticky bottom-0 left-0 right-0 border-t bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] md:grid-cols-[repeat(11,minmax(0,1fr))] text-xs uppercase tracking-wide text-muted-foreground">
              <div className="col-span-6 md:col-span-6 px-3 py-2 font-semibold text-left">
                Totals
              </div>
              <div className="col-span-1 px-3 py-2 text-right font-semibold text-cyan-700 whitespace-nowrap">
                {tableTotals.cartons.toLocaleString()}
              </div>
              <div className="col-span-1 px-3 py-2 text-right font-semibold whitespace-nowrap">
                {tableTotals.pallets.toLocaleString()}
              </div>
              <div className="col-span-1 px-3 py-2 text-right font-semibold whitespace-nowrap">
                {tableTotals.units.toLocaleString()}
              </div>
              <div className="hidden md:block col-span-2" />
            </div>
          </div>
        </div>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  </DashboardLayout>
  )
}

export default InventoryPage
