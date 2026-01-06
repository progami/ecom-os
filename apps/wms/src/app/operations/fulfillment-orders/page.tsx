'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { PageTabs } from '@/components/ui/page-tabs'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { redirectToPortal } from '@/lib/portal'
import { FileText, Plus, Truck, XCircle, FileEdit } from '@/lib/lucide-icons'
import type { LucideIcon } from 'lucide-react'

type FulfillmentOrderStatus = 'DRAFT' | 'SHIPPED' | 'CANCELLED'

type StatusConfig = {
  value: FulfillmentOrderStatus
  label: string
  description: string
  icon: LucideIcon
}

const STATUS_CONFIGS: StatusConfig[] = [
  {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Orders being prepared',
    icon: FileEdit,
  },
  {
    value: 'SHIPPED',
    label: 'Shipped',
    description: 'Outbound orders shipped',
    icon: Truck,
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Orders cancelled',
    icon: XCircle,
  },
]

type FulfillmentOrderLine = {
  id: string
  skuCode: string
  batchLot: string
  quantity: number
}

type FulfillmentOrder = {
  id: string
  foNumber: string
  status: FulfillmentOrderStatus
  warehouseCode: string
  warehouseName: string
  destinationType: string
  destinationName: string | null
  trackingNumber: string | null
  createdAt: string
  shippedDate: string | null
  lines: FulfillmentOrderLine[]
}

const STATUS_BADGE_CLASSES: Record<FulfillmentOrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  SHIPPED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
}

function FulfillmentOrdersPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<FulfillmentOrder[]>([])
  const [loading, setLoading] = useState(true)

  const statusFromUrl = searchParams.get('status') as FulfillmentOrderStatus | null
  const currentStatus: FulfillmentOrderStatus =
    statusFromUrl && STATUS_CONFIGS.some(s => s.value === statusFromUrl) ? statusFromUrl : 'DRAFT'

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/fulfillment-orders`)
      return
    }

    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fulfillment-orders')
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Failed to load fulfillment orders')
        return
      }
      const payload = await response.json().catch(() => null)
      const data = Array.isArray(payload?.data) ? (payload.data as FulfillmentOrder[]) : []
      setOrders(data)
    } catch (_error) {
      toast.error('Failed to load fulfillment orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('status', newStatus)
    router.push(`/operations/fulfillment-orders?${params.toString()}`)
  }

  const statusTabs = useMemo(
    () =>
      STATUS_CONFIGS.map(config => ({
        value: config.value,
        label: config.label,
        icon: config.icon,
      })),
    []
  )

  const visibleOrders = useMemo(
    () => orders.filter(order => order.status === currentStatus),
    [orders, currentStatus]
  )

  // Count orders by status
  const statusCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status === 'DRAFT') acc.draftCount += 1
        if (order.status === 'SHIPPED') acc.shippedCount += 1
        if (order.status === 'CANCELLED') acc.cancelledCount += 1
        return acc
      },
      { draftCount: 0, shippedCount: 0, cancelledCount: 0 }
    )
  }, [orders])

  const formatDateDisplay = (value: string | null) => {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return format(parsed, 'PP')
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <PageContainer>
          <PageLoading />
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Fulfillment Orders"
          description="Operations"
          icon={FileText}
          actions={
            <Button asChild className="gap-2">
              <Link href="/operations/fulfillment-orders/new">
                <Plus className="h-4 w-4" />
                New Fulfillment Order
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            <PageTabs
              tabs={statusTabs}
              value={currentStatus}
              onChange={handleStatusChange}
              variant="underline"
            />

            {/* Wrapper with gap-4 to match PurchaseOrdersPanel layout */}
            <div className="flex min-h-0 flex-col gap-4">
              {/* Header with status counts - consistent with Purchase Orders */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Fulfillment Orders</h2>
                    <p className="text-sm text-muted-foreground">
                      Track outbound shipments to customers, Amazon FBA, and warehouse transfers.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">{statusCounts.draftCount}</span> draft
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{statusCounts.shippedCount}</span> shipped
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{statusCounts.cancelledCount}</span> cancelled
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border bg-white shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] table-auto text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">FO #</th>
                      <th className="px-3 py-2 text-left font-semibold">Warehouse</th>
                      <th className="px-3 py-2 text-left font-semibold">Destination</th>
                      <th className="px-3 py-2 text-right font-semibold">Lines</th>
                      <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Created</th>
                      <th className="px-3 py-2 text-left font-semibold">Shipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                          Loading fulfillment orders…
                        </td>
                      </tr>
                    ) : visibleOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                          No fulfillment orders in this status yet.
                        </td>
                      </tr>
                    ) : (
                      visibleOrders.map(order => {
                        const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0)
                        const destinationLabel =
                          order.destinationName ||
                          (order.destinationType === 'AMAZON_FBA'
                            ? 'Amazon FBA'
                            : order.destinationType === 'TRANSFER'
                              ? 'Transfer'
                              : 'Customer')

                        return (
                          <tr key={order.id} className="odd:bg-muted/20">
                            <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                              <Link
                                href={`/operations/fulfillment-orders/${order.id}`}
                                className="text-primary hover:underline"
                                prefetch={false}
                              >
                                {order.foNumber}
                              </Link>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {order.warehouseCode || '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {destinationLabel}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {order.lines.length}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                              {totalQuantity.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge className={STATUS_BADGE_CLASSES[order.status]}>
                                {order.status === 'DRAFT'
                                  ? 'Draft'
                                  : order.status === 'SHIPPED'
                                    ? 'Shipped'
                                    : 'Cancelled'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {formatDateDisplay(order.createdAt)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                              {formatDateDisplay(order.shippedDate)}
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
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

export default function FulfillmentOrdersPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <PageContainer>
            <PageLoading />
          </PageContainer>
        </DashboardLayout>
      }
    >
      <FulfillmentOrdersPageContent />
    </Suspense>
  )
}
