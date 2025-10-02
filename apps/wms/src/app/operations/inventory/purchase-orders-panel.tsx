'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type PurchaseOrderTypeOption = 'PURCHASE' | 'FULFILLMENT' | 'ADJUSTMENT'
export type PurchaseOrderStatusOption = 'DRAFT' | 'AWAITING_PROOF' | 'REVIEW' | 'POSTED' | 'CANCELLED' | 'CLOSED'
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
}

function formatStatusLabel(status: PurchaseOrderStatusOption) {
  switch (status) {
    case 'DRAFT':
      return 'Draft'
    case 'AWAITING_PROOF':
      return 'Awaiting Proof'
    case 'REVIEW':
      return 'Review'
    case 'POSTED':
      return 'Posted'
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
    case 'AWAITING_PROOF':
      return 'bg-sky-50 text-sky-700 border border-sky-200'
    case 'REVIEW':
      return 'bg-brand-teal-50 text-brand-teal-700 border border-brand-teal-200'
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'CANCELLED':
      return 'bg-red-50 text-red-700 border border-red-200'
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600 border border-slate-200'
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

export function PurchaseOrdersPanel({ onPosted, statusFilter = 'DRAFT' }: PurchaseOrdersPanelProps) {
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [voidingId, setVoidingId] = useState<string | null>(null)

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

  const { draftCount, awaitingProofCount, reviewCount, postedCount, cancelledCount } = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status === 'DRAFT') acc.draftCount += 1
        if (order.status === 'AWAITING_PROOF') acc.awaitingProofCount += 1
        if (order.status === 'REVIEW') acc.reviewCount += 1
        if (order.status === 'POSTED') acc.postedCount += 1
        if (order.status === 'CANCELLED') acc.cancelledCount += 1
        return acc
      },
      { draftCount: 0, awaitingProofCount: 0, reviewCount: 0, postedCount: 0, cancelledCount: 0 }
    )
  }, [orders])

  const visibleOrders = useMemo(
    () => orders.filter(order => order.status === statusFilter),
    [orders, statusFilter]
  )

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Purchase Orders</h2>
            <p className="text-sm text-muted-foreground">
              Use movement notes to record receipts or shipments against these orders before they post to the ledger.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{draftCount}</span> draft
            </span>
            <span>
              <span className="font-semibold text-foreground">{awaitingProofCount}</span> awaiting proof
            </span>
            <span>
              <span className="font-semibold text-foreground">{reviewCount}</span> review
            </span>
            <span>
              <span className="font-semibold text-foreground">{postedCount}</span> posted
            </span>
            <span>
              <span className="font-semibold text-foreground">{cancelledCount}</span> cancelled
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-auto text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Order #</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Warehouse</th>
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
                              {order.status === 'POSTED' ? 'View' : 'Open'}
                            </Link>
                          </Button>
                          {order.status !== 'POSTED' && order.status !== 'CANCELLED' && (
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
