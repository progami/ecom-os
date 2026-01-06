'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import {
  PO_STATUS_BADGE_CLASSES,
  PO_STATUS_LABELS,
  PO_TYPE_BADGE_CLASSES,
  type POStatus,
  type POType,
} from '@/lib/constants/status-mappings'

export type PurchaseOrderTypeOption = 'PURCHASE' | 'ADJUSTMENT' | 'FULFILLMENT'
export type PurchaseOrderStatusOption =
  | 'DRAFT'
  | 'ISSUED'
  | 'MANUFACTURING'
  | 'OCEAN'
  | 'WAREHOUSE'
  | 'REJECTED'
  | 'CANCELLED'
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
  warehouseCode: string | null
  warehouseName: string | null
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
  typeFilter?: PurchaseOrderTypeOption
}

const DEFAULT_BADGE_CLASS = 'bg-muted text-muted-foreground border border-muted'

function formatStatusLabel(status: PurchaseOrderStatusOption) {
  return PO_STATUS_LABELS[status as POStatus] ?? status
}

function statusBadgeClasses(status: PurchaseOrderStatusOption) {
  return PO_STATUS_BADGE_CLASSES[status as POStatus] ?? DEFAULT_BADGE_CLASS
}

function typeBadgeClasses(type: PurchaseOrderTypeOption) {
  return PO_TYPE_BADGE_CLASSES[type as POType] ?? DEFAULT_BADGE_CLASS
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

export function PurchaseOrdersPanel({
  onPosted: _onPosted,
  statusFilter = 'DRAFT',
  typeFilter,
}: PurchaseOrdersPanelProps) {
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([])
  const [loading, setLoading] = useState(true)

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

  // Count orders by new 5-stage statuses
  const statusCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status === 'DRAFT') acc.draftCount += 1
        if (order.status === 'ISSUED') acc.issuedCount += 1
        if (order.status === 'MANUFACTURING') acc.manufacturingCount += 1
        if (order.status === 'OCEAN') acc.oceanCount += 1
        if (order.status === 'WAREHOUSE') acc.warehouseCount += 1
        if (order.status === 'REJECTED') acc.rejectedCount += 1
        if (order.status === 'CANCELLED') acc.cancelledCount += 1
        return acc
      },
      {
        draftCount: 0,
        issuedCount: 0,
        manufacturingCount: 0,
        oceanCount: 0,
        warehouseCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
      }
    )
  }, [orders])

  const visibleOrders = useMemo(
    () =>
      orders.filter(order => {
        const matchesStatus = order.status === statusFilter
        const matchesType = !typeFilter || order.type === typeFilter
        return matchesStatus && matchesType
      }),
    [orders, statusFilter, typeFilter]
  )

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Purchase Orders</h2>
            <p className="text-sm text-muted-foreground">
              Use movement notes to record receipts against these purchase orders before they post
              to the ledger.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{statusCounts.draftCount}</span> draft
            </span>
            <span>
              <span className="font-semibold text-foreground">{statusCounts.issuedCount}</span>{' '}
              issued
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {statusCounts.manufacturingCount}
              </span>{' '}
              manufacturing
            </span>
            <span>
              <span className="font-semibold text-foreground">{statusCounts.oceanCount}</span> in
              transit
            </span>
            <span>
              <span className="font-semibold text-foreground">{statusCounts.warehouseCount}</span>{' '}
              at warehouse
            </span>
            <span>
              <span className="font-semibold text-foreground">{statusCounts.rejectedCount}</span>{' '}
              rejected
            </span>
            <span>
              <span className="font-semibold text-foreground">{statusCounts.cancelledCount}</span>{' '}
              cancelled
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl border bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-auto text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">PO #</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Warehouse</th>
                <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2 text-right font-semibold">Lines</th>
                <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Expected</th>
                <th className="px-3 py-2 text-left font-semibold">Posted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                    Loading purchase orders…
                  </td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
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
                          {order.type === 'FULFILLMENT'
                            ? 'Fulfillment'
                            : order.type === 'PURCHASE'
                              ? 'Purchase'
                              : 'Adjustment'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {order.warehouseCode || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {order.counterpartyName || '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {order.lines.length}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {totalQuantity.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge className={statusBadgeClasses(order.status)}>
                          {formatStatusLabel(order.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateDisplay(order.expectedDate)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateDisplay(order.postedAt)}
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
