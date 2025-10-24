'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Filter, X } from '@/lib/lucide-icons'
import { cn } from '@/lib/utils'

export type PurchaseOrderTypeOption = 'PURCHASE' | 'FULFILLMENT' | 'ADJUSTMENT'
export type PurchaseOrderStatusOption = 'DRAFT' | 'SHIPPED' | 'WAREHOUSE' | 'CANCELLED' | 'CLOSED'
export type PurchaseOrderLineStatusOption = 'PENDING' | 'POSTED' | 'CANCELLED'

export interface PurchaseOrderLineSummary {
  id: string
  skuCode: string
  skuDescription: string | null
  batchLot: string | null
  quantity: number
  unitCost: number | null
  status: PurchaseOrderLineStatusOption
  postedQuantity: number
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderSummary {
  id: string
  orderNumber: string
  type: PurchaseOrderTypeOption
  status: PurchaseOrderStatusOption
  warehouseCode: string
  warehouseName: string
  counterpartyName: string | null
  expectedDate: string | null
  postedAt: string | null
  createdAt: string
  updatedAt: string
  lines: PurchaseOrderLineSummary[]
}

export type PurchaseOrderFilter = PurchaseOrderStatusOption

interface PurchaseOrdersPanelProps {
  onPosted: () => void
  statusFilter?: PurchaseOrderFilter
  typeFilter?: PurchaseOrderTypeOption | 'ALL'
}

function formatStatusLabel(status: PurchaseOrderStatusOption) {
  switch (status) {
    case 'DRAFT':
      return 'Draft'
    case 'SHIPPED':
      return 'In Transit'
    case 'WAREHOUSE':
      return 'At Warehouse'
    case 'CANCELLED':
      return 'Cancelled'
    case 'CLOSED':
      return 'Closed'
    default:
      return status
  }
}

function statusBadgeClasses(status: PurchaseOrderStatusOption) {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'SHIPPED':
      return 'bg-sky-50 text-sky-700 border border-sky-200'
    case 'WAREHOUSE':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'CANCELLED':
      return 'bg-red-50 text-red-700 border border-red-200'
    case 'CLOSED':
      return 'bg-muted text-muted-foreground border border-border'
    default:
      return 'bg-muted text-muted-foreground border border-muted'
  }
}

function typeBadgeClasses(type: PurchaseOrderTypeOption) {
  switch (type) {
    case 'PURCHASE':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'FULFILLMENT':
      return 'bg-red-50 text-red-700 border border-red-200'
    default:
      return 'bg-muted text-muted-foreground border border-muted'
  }
}

function formatDateDisplay(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return format(parsed, 'PP')
}

function sumLineQuantities(lines: PurchaseOrderLineSummary[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

type ColumnFilterKey = 'warehouse' | 'type' | 'counterparty'

interface ColumnFiltersState {
  warehouse: string[]
  type: string[]
  counterparty: string
}

const createColumnFilterDefaults = (): ColumnFiltersState => ({
  warehouse: [],
  type: [],
  counterparty: '',
})

export function PurchaseOrdersPanel({ onPosted, statusFilter = 'DRAFT', typeFilter = 'ALL' }: PurchaseOrdersPanelProps) {
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(createColumnFilterDefaults())

  const panelTitle = useMemo(() => {
    switch (typeFilter) {
      case 'FULFILLMENT':
        return 'Ship Orders'
      case 'ADJUSTMENT':
        return 'Adjustment Orders'
      default:
        return 'Purchase Orders'
    }
  }, [typeFilter])

  const panelDescription = useMemo(() => {
    switch (typeFilter) {
      case 'FULFILLMENT':
        return ''
      case 'ADJUSTMENT':
        return ''
      default:
        return ''
    }
  }, [typeFilter])

  const isFilterActive = useCallback(
    (keys: ColumnFilterKey[]) =>
      keys.some(key => {
        const value = columnFilters[key]
        if (Array.isArray(value)) {
          return value.length > 0
        }
        return typeof value === 'string' && value.trim().length > 0
      }),
    [columnFilters]
  )

  const clearColumnFilter = useCallback((keys: ColumnFilterKey[]) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      for (const key of keys) {
        if (key === 'warehouse') {
          next.warehouse = []
        } else if (key === 'type') {
          next.type = []
        } else if (key === 'counterparty') {
          next.counterparty = ''
        }
      }
      return next
    })
  }, [])

  const toggleWarehouseFilter = useCallback((warehouse: string) => {
    setColumnFilters(prev => ({
      ...prev,
      warehouse: prev.warehouse.includes(warehouse)
        ? prev.warehouse.filter(w => w !== warehouse)
        : [...prev.warehouse, warehouse]
    }))
  }, [])

  const toggleTypeFilter = useCallback((type: string) => {
    setColumnFilters(prev => ({
      ...prev,
      type: prev.type.includes(type)
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type]
    }))
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/purchase-orders')
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Failed to load purchase orders')
        return
      }

      const payload = await response.json().catch(() => null)
      const data = Array.isArray(payload?.data) ? (payload.data as PurchaseOrderSummary[]) : []
      setOrders(data)
    } catch (_error) {
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleVoid = useCallback(async (orderId: string) => {
    try {
      setVoidingId(orderId)
      const response = await fetch(`/api/purchase-orders/${orderId}/void`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        toast.error(errorPayload?.error ?? 'Failed to void purchase order')
        return
      }

      toast.success('Purchase order voided')
      await fetchOrders()
      onPosted()
    } catch (_error) {
      toast.error('Failed to void purchase order')
    } finally {
      setVoidingId(null)
    }
  }, [fetchOrders, onPosted])

  const { draftCount, shippedCount, warehouseCount, closedCount, cancelledCount } = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (typeFilter !== 'ALL' && order.type !== typeFilter) {
          return acc
        }
        if (order.status === 'DRAFT') acc.draftCount += 1
        if (order.status === 'SHIPPED') acc.shippedCount += 1
        if (order.status === 'WAREHOUSE') acc.warehouseCount += 1
        if (order.status === 'CLOSED') acc.closedCount += 1
        if (order.status === 'CANCELLED') acc.cancelledCount += 1
        return acc
      },
      { draftCount: 0, shippedCount: 0, warehouseCount: 0, closedCount: 0, cancelledCount: 0 }
    )
  }, [orders, typeFilter])

  const uniqueWarehouses = useMemo(() => {
    const warehouses = new Set<string>()
    orders.forEach(order => warehouses.add(`${order.warehouseName} (${order.warehouseCode})`))
    return Array.from(warehouses).sort()
  }, [orders])

  const visibleOrders = useMemo(
    () => orders.filter(order => {
      // Status filter
      if (order.status !== statusFilter) return false

      if (typeFilter !== 'ALL' && order.type !== typeFilter) return false

      // Warehouse filter
      if (columnFilters.warehouse.length > 0) {
        const warehouseKey = `${order.warehouseName} (${order.warehouseCode})`
        if (!columnFilters.warehouse.includes(warehouseKey)) return false
      }

      // Type filter
      if (columnFilters.type.length > 0) {
        if (!columnFilters.type.includes(order.type)) return false
      }

      // Counterparty filter
      if (columnFilters.counterparty) {
        const searchLower = columnFilters.counterparty.toLowerCase()
        const counterpartyMatch = order.counterpartyName?.toLowerCase().includes(searchLower)
        if (!counterpartyMatch) return false
      }

      return true
    }),
    [orders, statusFilter, typeFilter, columnFilters]
  )

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{panelTitle}</h2>
            {panelDescription ? (
              <p className="text-sm text-muted-foreground">
                {panelDescription}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{draftCount}</span> draft
            </span>
            <span>
              <span className="font-semibold text-foreground">{shippedCount}</span> in transit
            </span>
            <span>
              <span className="font-semibold text-foreground">{warehouseCount}</span> at warehouse
            </span>
            <span>
              <span className="font-semibold text-foreground">{closedCount}</span> closed
            </span>
            <span>
              <span className="font-semibold text-foreground">{cancelledCount}</span> cancelled
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-auto text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Order #</th>
                <th className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-2">
                    Type
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter order type"
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors',
                            isFilterActive(['type'])
                              ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'hover:bg-muted hover:text-primary'
                          )}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Type filter</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => clearColumnFilter(['type'])}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-2">
                          {['PURCHASE', 'FULFILLMENT', 'ADJUSTMENT'].map(type => (
                            <label key={type} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={columnFilters.type.includes(type)}
                                onChange={() => toggleTypeFilter(type)}
                                className="rounded border-border"
                              />
                              <span className="text-foreground">{type === 'FULFILLMENT' ? 'Fulfillment' : type === 'PURCHASE' ? 'Purchase' : 'Adjustment'}</span>
                            </label>
                          ))}
                        </div>
                        {columnFilters.type.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {columnFilters.type.map(t => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {t === 'FULFILLMENT' ? 'Fulfillment' : t === 'PURCHASE' ? 'Purchase' : 'Adjustment'}
                                <button
                                  type="button"
                                  onClick={() => toggleTypeFilter(t)}
                                  className="hover:text-primary/70"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  <div className="flex items-center gap-2">
                    Warehouse
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Filter warehouse"
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
                      <PopoverContent align="start" className="w-64 space-y-3">
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
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {uniqueWarehouses.map(warehouse => (
                            <label key={warehouse} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={columnFilters.warehouse.includes(warehouse)}
                                onChange={() => toggleWarehouseFilter(warehouse)}
                                className="rounded border-border"
                              />
                              <span className="text-foreground">{warehouse}</span>
                            </label>
                          ))}
                        </div>
                        {columnFilters.warehouse.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {columnFilters.warehouse.map(w => (
                              <span
                                key={w}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {w}
                                <button
                                  type="button"
                                  onClick={() => toggleWarehouseFilter(w)}
                                  className="hover:text-primary/70"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </th>
                <th className="px-3 py-2 text-left font-semibold">Counterparty</th>
                <th className="px-3 py-2 text-right font-semibold">Lines</th>
                <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Expected</th>
                <th className="px-3 py-2 text-left font-semibold">Posted</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                    Loading purchase orders…
                  </td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                    No purchase orders yet. Use the Inventory Actions menu to create one.
                  </td>
                </tr>
              ) : (
                visibleOrders.map(order => {
                  const totalQuantity = sumLineQuantities(order.lines)
                  return (
                    <tr key={order.id} className="odd:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                        <Link
                          href={`/operations/purchase-orders/${order.id}`}
                          className="text-primary hover:underline"
                          prefetch={false}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge className={typeBadgeClasses(order.type)}>
                          {order.type === 'FULFILLMENT' ? 'Fulfillment' : order.type === 'PURCHASE' ? 'Purchase' : 'Adjustment'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {order.warehouseName} ({order.warehouseCode})
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {order.counterpartyName || '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{order.lines.length}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{totalQuantity.toLocaleString()}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge className={statusBadgeClasses(order.status)}>{formatStatusLabel(order.status)}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateDisplay(order.expectedDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateDisplay(order.postedAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={`/operations/purchase-orders/${order.id}`} prefetch={false}>
                              {order.status === 'CLOSED' ? 'View' : 'Open'}
                            </Link>
                          </Button>
                          {order.status !== 'CLOSED' && order.status !== 'CANCELLED' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleVoid(order.id)}
                              disabled={voidingId === order.id}
                            >
                              {voidingId === order.id ? 'Voiding…' : 'Void'}
                            </Button>
                          )}
                          {order.status === 'CANCELLED' && (
                            <span className="text-xs font-medium text-muted-foreground">Voided</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
