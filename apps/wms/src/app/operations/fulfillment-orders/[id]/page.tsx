'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageLoading } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { ArrowLeft, Truck, XCircle, FileText } from '@/lib/lucide-icons'
import { format } from 'date-fns'

type FulfillmentOrderStatus = 'DRAFT' | 'SHIPPED' | 'CANCELLED'

type FulfillmentOrderLine = {
  id: string
  skuCode: string
  skuDescription: string | null
  batchLot: string
  quantity: number
  status: string
}

type FulfillmentOrder = {
  id: string
  foNumber: string
  status: FulfillmentOrderStatus
  warehouseCode: string
  warehouseName: string
  destinationType: string
  destinationName: string | null
  destinationAddress: string | null
  destinationCountry: string | null
  shippingCarrier: string | null
  shippingMethod: string | null
  trackingNumber: string | null
  shippedDate: string | null
  deliveredDate: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
  lines: FulfillmentOrderLine[]
}

const STATUS_BADGE_CLASSES: Record<FulfillmentOrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  SHIPPED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
}

function formatDateTimeDisplay(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'PPP p')
}

export default function FulfillmentOrderDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [order, setOrder] = useState<FulfillmentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const [shipForm, setShipForm] = useState({
    shippedDate: '',
    deliveredDate: '',
    shippingCarrier: '',
    shippingMethod: '',
    trackingNumber: '',
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/fulfillment-orders/${params.id}`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
    }
  }, [session, status, router, params.id])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/fulfillment-orders/${params.id}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(payload?.error ?? 'Failed to load fulfillment order')
        return
      }

      const data = payload?.data as FulfillmentOrder | undefined
      if (!data) {
        toast.error('Fulfillment order not found')
        return
      }

      setOrder(data)
      setShipForm({
        shippedDate: data.shippedDate ? new Date(data.shippedDate).toISOString().slice(0, 16) : '',
        deliveredDate: data.deliveredDate
          ? new Date(data.deliveredDate).toISOString().slice(0, 16)
          : '',
        shippingCarrier: data.shippingCarrier ?? '',
        shippingMethod: data.shippingMethod ?? '',
        trackingNumber: data.trackingNumber ?? '',
      })
    } catch (_error) {
      toast.error('Failed to load fulfillment order')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, params.id])

  const totalQuantity = useMemo(() => {
    return order?.lines?.reduce((sum, line) => sum + Number(line.quantity || 0), 0) ?? 0
  }, [order])

  const canShip = order?.status === 'DRAFT'

  const handleShip = async () => {
    if (!order) return
    try {
      setSubmitting(true)
      const payload = {
        targetStatus: 'SHIPPED',
        stageData: {
          shippedDate: shipForm.shippedDate ? new Date(shipForm.shippedDate).toISOString() : undefined,
          deliveredDate: shipForm.deliveredDate
            ? new Date(shipForm.deliveredDate).toISOString()
            : undefined,
          shippingCarrier: shipForm.shippingCarrier || undefined,
          shippingMethod: shipForm.shippingMethod || undefined,
          trackingNumber: shipForm.trackingNumber || undefined,
        },
      }

      const response = await fetchWithCSRF(`/api/fulfillment-orders/${order.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to ship fulfillment order')
        return
      }

      toast.success('Fulfillment order shipped')
      setOrder(data?.data ?? null)
    } catch (_error) {
      toast.error('Failed to ship fulfillment order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!order) return
    try {
      setSubmitting(true)
      const response = await fetchWithCSRF(`/api/fulfillment-orders/${order.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus: 'CANCELLED', stageData: {} }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to cancel fulfillment order')
        return
      }
      toast.success('Fulfillment order cancelled')
      setOrder(data?.data ?? null)
      setShowCancelConfirm(false)
    } catch (_error) {
      toast.error('Failed to cancel fulfillment order')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageContainer>
          <PageLoading />
        </PageContainer>
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <PageContainer>
          <PageHeaderSection
            title="Fulfillment Order"
            description="Operations"
            icon={FileText}
            actions={
              <Button asChild variant="outline" className="gap-2">
                <Link href="/operations/fulfillment-orders">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
            }
          />
          <PageContent>
            <div className="rounded-xl border bg-white shadow-soft p-6 text-sm text-muted-foreground">
              Fulfillment order not found.
            </div>
          </PageContent>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title={order.foNumber}
          description="Fulfillment Order"
          icon={Truck}
          actions={
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/operations/fulfillment-orders">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
              {order.status === 'DRAFT' ? (
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              ) : null}
            </div>
          }
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Warehouse</span>
                  <span className="text-sm font-semibold text-foreground">
                    {order.warehouseCode} — {order.warehouseName}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <Badge className={STATUS_BADGE_CLASSES[order.status]}>
                    {order.status === 'DRAFT'
                      ? 'Draft'
                      : order.status === 'SHIPPED'
                        ? 'Shipped'
                        : 'Cancelled'}
                  </Badge>
                  <span className="text-xs text-muted-foreground mt-1">
                    Created: {formatDateTimeDisplay(order.createdAt)}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Destination</div>
                  <div className="text-sm text-foreground">
                    {order.destinationName || (order.destinationType === 'AMAZON_FBA' ? 'Amazon FBA' : order.destinationType)}
                  </div>
                  {order.destinationCountry ? (
                    <div className="text-xs text-muted-foreground mt-1">{order.destinationCountry}</div>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tracking</div>
                  <div className="text-sm text-foreground">{order.trackingNumber || '—'}</div>
                  {order.shippingCarrier ? (
                    <div className="text-xs text-muted-foreground mt-1">{order.shippingCarrier}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
                <h2 className="text-sm font-semibold">Line Items</h2>
                <div className="text-sm text-muted-foreground">
                  Total cartons: <span className="font-semibold text-foreground">{totalQuantity}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] table-auto text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">SKU</th>
                      <th className="px-3 py-2 text-left font-semibold">Batch/Lot</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map(line => (
                      <tr key={line.id} className="odd:bg-muted/20">
                        <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                          {line.skuCode}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground uppercase whitespace-nowrap">
                          {line.batchLot}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[18rem] truncate" title={line.skuDescription ?? undefined}>
                          {line.skuDescription ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                          {line.quantity.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {line.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
                <h2 className="text-sm font-semibold">Shipping</h2>
                <div className="text-xs text-muted-foreground">
                  Shipped: {formatDateTimeDisplay(order.shippedDate)} • Delivered: {formatDateTimeDisplay(order.deliveredDate)}
                </div>
              </div>

              <div className="px-6 py-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Shipped Date</label>
                  <Input
                    type="datetime-local"
                    value={shipForm.shippedDate}
                    onChange={e => setShipForm(prev => ({ ...prev, shippedDate: e.target.value }))}
                    disabled={!canShip || submitting}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Delivered Date</label>
                  <Input
                    type="datetime-local"
                    value={shipForm.deliveredDate}
                    onChange={e => setShipForm(prev => ({ ...prev, deliveredDate: e.target.value }))}
                    disabled={!canShip || submitting}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Shipping Carrier</label>
                  <Input
                    value={shipForm.shippingCarrier}
                    onChange={e => setShipForm(prev => ({ ...prev, shippingCarrier: e.target.value }))}
                    disabled={!canShip || submitting}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Shipping Method</label>
                  <Input
                    value={shipForm.shippingMethod}
                    onChange={e => setShipForm(prev => ({ ...prev, shippingMethod: e.target.value }))}
                    disabled={!canShip || submitting}
                    className="text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Tracking Number</label>
                  <Input
                    value={shipForm.trackingNumber}
                    onChange={e => setShipForm(prev => ({ ...prev, trackingNumber: e.target.value }))}
                    disabled={!canShip || submitting}
                    className="text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  {canShip ? (
                    <Button onClick={handleShip} disabled={submitting} className="gap-2">
                      <Truck className="h-4 w-4" />
                      {submitting ? 'Shipping…' : 'Mark Shipped'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </PageContent>
      </PageContainer>

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="Cancel fulfillment order?"
        message="This will cancel the order. No inventory will be shipped."
        confirmText="Cancel Order"
        cancelText="Keep"
        type="danger"
        onConfirm={() => {
          void handleCancel()
        }}
      />
    </DashboardLayout>
  )
}
