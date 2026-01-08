'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageLoading } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { ArrowLeft, Truck, XCircle, FileText, Upload, Check, Loader2 } from '@/lib/lucide-icons'
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
  shippingCarrier: string | null
  shippingMethod: string | null
  trackingNumber: string | null
  shippedDate: string | null
  deliveredDate: string | null
  externalReference: string | null
  amazonShipmentId: string | null
  amazonShipmentName: string | null
  amazonShipmentStatus: string | null
  amazonDestinationFulfillmentCenterId: string | null
  amazonLabelPrepType: string | null
  amazonBoxContentsSource: string | null
  amazonShipFromAddress: Record<string, unknown> | null
  amazonReferenceId: string | null
  amazonShipmentReference: string | null
  amazonShipperId: string | null
  amazonPickupNumber: string | null
  amazonPickupAppointmentId: string | null
  amazonDeliveryAppointmentId: string | null
  amazonLoadId: string | null
  amazonFreightBillNumber: string | null
  amazonBillOfLadingNumber: string | null
  amazonPickupWindowStart: string | null
  amazonPickupWindowEnd: string | null
  amazonDeliveryWindowStart: string | null
  amazonDeliveryWindowEnd: string | null
  amazonPickupAddress: string | null
  amazonPickupContactName: string | null
  amazonPickupContactPhone: string | null
  amazonDeliveryAddress: string | null
  amazonShipmentMode: string | null
  amazonBoxCount: number | null
  amazonPalletCount: number | null
  amazonCommodityDescription: string | null
  amazonDistanceMiles: number | null
  amazonBasePrice: number | null
  amazonFuelSurcharge: number | null
  amazonTotalPrice: number | null
  amazonCurrency: string | null
  notes: string | null
  createdAt: string
  lines: FulfillmentOrderLine[]
}

type FulfillmentOrderDocumentStage = 'PACKING' | 'SHIPPING' | 'DELIVERY'

type FulfillmentOrderDocumentSummary = {
  id: string
  stage: FulfillmentOrderDocumentStage
  documentType: string
  fileName: string
  contentType: string
  size: number
  uploadedAt: string
  uploadedByName: string | null
  s3Key: string
  viewUrl: string
}

type AmazonFreightFormState = {
  referenceId: string
  shipmentReference: string
  shipperId: string
  pickupNumber: string
  pickupAppointmentId: string
  deliveryAppointmentId: string
  loadId: string
  freightBillNumber: string
  billOfLadingNumber: string
  pickupWindowStart: string
  pickupWindowEnd: string
  deliveryWindowStart: string
  deliveryWindowEnd: string
  pickupAddress: string
  pickupContactName: string
  pickupContactPhone: string
  deliveryAddress: string
  shipmentMode: string
  boxCount: string
  palletCount: string
  commodityDescription: string
  distanceMiles: string
  basePrice: string
  fuelSurcharge: string
  totalPrice: string
  currency: string
}

const STATUS_BADGE_CLASSES: Record<FulfillmentOrderStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  SHIPPED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
}

const DOCUMENT_REQUIREMENTS: Record<
  FulfillmentOrderDocumentStage,
  Array<{ id: string; label: string }>
> = {
  PACKING: [],
  SHIPPING: [
    { id: 'bill_of_lading', label: 'Bill of Lading (BOL)' },
    { id: 'invoice', label: 'Invoice' },
  ],
  DELIVERY: [{ id: 'proof_of_delivery', label: 'Proof of Delivery (POD)' }],
}

function formatDateTimeDisplay(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'PPP p')
}

function formatDateTimeInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function formatAmazonAddress(address?: Record<string, unknown> | null) {
  if (!address) return '—'
  const getField = (key: string) => {
    const value = address[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  const name = getField('Name')
  const line1 = getField('AddressLine1')
  const line2 = getField('AddressLine2')
  const line3 = getField('AddressLine3')
  const city = getField('City')
  const state = getField('StateOrProvinceCode')
  const postal = getField('PostalCode')
  const country = getField('CountryCode')
  const phone = getField('Phone')

  const cityState = [city, state].filter(Boolean).join(', ')
  const cityStatePostal = [cityState, postal].filter(Boolean).join(' ')

  const lines = [name, line1, line2, line3, cityStatePostal, country, phone].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : '—'
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
  const [amazonForm, setAmazonForm] = useState<AmazonFreightFormState>({
    referenceId: '',
    shipmentReference: '',
    shipperId: '',
    pickupNumber: '',
    pickupAppointmentId: '',
    deliveryAppointmentId: '',
    loadId: '',
    freightBillNumber: '',
    billOfLadingNumber: '',
    pickupWindowStart: '',
    pickupWindowEnd: '',
    deliveryWindowStart: '',
    deliveryWindowEnd: '',
    pickupAddress: '',
    pickupContactName: '',
    pickupContactPhone: '',
    deliveryAddress: '',
    shipmentMode: '',
    boxCount: '',
    palletCount: '',
    commodityDescription: '',
    distanceMiles: '',
    basePrice: '',
    fuelSurcharge: '',
    totalPrice: '',
    currency: '',
  })
  const [amazonSaving, setAmazonSaving] = useState(false)
  const [documents, setDocuments] = useState<FulfillmentOrderDocumentSummary[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<Record<string, boolean>>({})

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
      setAmazonForm({
        referenceId: data.amazonReferenceId ?? '',
        shipmentReference: data.amazonShipmentReference ?? '',
        shipperId: data.amazonShipperId ?? '',
        pickupNumber: data.amazonPickupNumber ?? '',
        pickupAppointmentId: data.amazonPickupAppointmentId ?? '',
        deliveryAppointmentId: data.amazonDeliveryAppointmentId ?? '',
        loadId: data.amazonLoadId ?? '',
        freightBillNumber: data.amazonFreightBillNumber ?? '',
        billOfLadingNumber: data.amazonBillOfLadingNumber ?? '',
        pickupWindowStart: formatDateTimeInput(data.amazonPickupWindowStart ?? null),
        pickupWindowEnd: formatDateTimeInput(data.amazonPickupWindowEnd ?? null),
        deliveryWindowStart: formatDateTimeInput(data.amazonDeliveryWindowStart ?? null),
        deliveryWindowEnd: formatDateTimeInput(data.amazonDeliveryWindowEnd ?? null),
        pickupAddress: data.amazonPickupAddress ?? '',
        pickupContactName: data.amazonPickupContactName ?? '',
        pickupContactPhone: data.amazonPickupContactPhone ?? '',
        deliveryAddress: data.amazonDeliveryAddress ?? '',
        shipmentMode: data.amazonShipmentMode ?? '',
        boxCount: data.amazonBoxCount !== null && data.amazonBoxCount !== undefined ? String(data.amazonBoxCount) : '',
        palletCount:
          data.amazonPalletCount !== null && data.amazonPalletCount !== undefined
            ? String(data.amazonPalletCount)
            : '',
        commodityDescription: data.amazonCommodityDescription ?? '',
        distanceMiles:
          data.amazonDistanceMiles !== null && data.amazonDistanceMiles !== undefined
            ? String(data.amazonDistanceMiles)
            : '',
        basePrice:
          data.amazonBasePrice !== null && data.amazonBasePrice !== undefined
            ? String(data.amazonBasePrice)
            : '',
        fuelSurcharge:
          data.amazonFuelSurcharge !== null && data.amazonFuelSurcharge !== undefined
            ? String(data.amazonFuelSurcharge)
            : '',
        totalPrice:
          data.amazonTotalPrice !== null && data.amazonTotalPrice !== undefined
            ? String(data.amazonTotalPrice)
            : '',
        currency: data.amazonCurrency ?? '',
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

  useEffect(() => {
    if (!order?.id) return

    const loadDocuments = async () => {
      try {
        setDocumentsLoading(true)
        const response = await fetch(`/api/fulfillment-orders/${order.id}/documents`)
        if (!response.ok) {
          setDocuments([])
          return
        }

        const payload = await response.json().catch(() => null)
        const list = payload?.documents
        setDocuments(Array.isArray(list) ? (list as FulfillmentOrderDocumentSummary[]) : [])
      } catch {
        setDocuments([])
      } finally {
        setDocumentsLoading(false)
      }
    }

    loadDocuments()
  }, [order?.id])

  const totalQuantity = useMemo(() => {
    return order?.lines?.reduce((sum, line) => sum + Number(line.quantity || 0), 0) ?? 0
  }, [order])

  const documentsByKey = useMemo(() => {
    const map = new Map<string, FulfillmentOrderDocumentSummary>()
    for (const doc of documents) {
      map.set(`${doc.stage}::${doc.documentType}`, doc)
    }
    return map
  }, [documents])

  const renderDocumentStage = (stage: FulfillmentOrderDocumentStage, title: string) => {
    const required = DOCUMENT_REQUIREMENTS[stage] ?? []
    if (required.length === 0) return null

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </h4>
          {documentsLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>
        <div className="space-y-2">
          {required.map(docType => {
            const key = `${stage}::${docType.id}`
            const existing = documentsByKey.get(key)
            const isUploading = Boolean(uploadingDoc[key])

            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {existing ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{docType.label}</span>
                    {existing ? (
                      <a
                        href={existing.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                        title={existing.fileName}
                      >
                        {existing.fileName}
                      </a>
                    ) : (
                      <span className="block text-xs text-muted-foreground">
                        Not uploaded yet
                      </span>
                    )}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors flex-shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  {existing ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploading}
                    onChange={e => handleDocumentUpload(e, stage, docType.id)}
                  />
                  {isUploading && <span className="text-xs text-muted-foreground ml-1">…</span>}
                </label>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const canShip = order?.status === 'DRAFT'

  const updateAmazonFormField = (field: keyof AmazonFreightFormState, value: string) => {
    setAmazonForm(prev => ({ ...prev, [field]: value }))
  }

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

  const handleAmazonSave = async () => {
    if (!order) return
    try {
      setAmazonSaving(true)
      const payload = {
        amazonReferenceId: amazonForm.referenceId || null,
        amazonShipmentReference: amazonForm.shipmentReference || null,
        amazonShipperId: amazonForm.shipperId || null,
        amazonPickupNumber: amazonForm.pickupNumber || null,
        amazonPickupAppointmentId: amazonForm.pickupAppointmentId || null,
        amazonDeliveryAppointmentId: amazonForm.deliveryAppointmentId || null,
        amazonLoadId: amazonForm.loadId || null,
        amazonFreightBillNumber: amazonForm.freightBillNumber || null,
        amazonBillOfLadingNumber: amazonForm.billOfLadingNumber || null,
        amazonPickupWindowStart: amazonForm.pickupWindowStart || null,
        amazonPickupWindowEnd: amazonForm.pickupWindowEnd || null,
        amazonDeliveryWindowStart: amazonForm.deliveryWindowStart || null,
        amazonDeliveryWindowEnd: amazonForm.deliveryWindowEnd || null,
        amazonPickupAddress: amazonForm.pickupAddress || null,
        amazonPickupContactName: amazonForm.pickupContactName || null,
        amazonPickupContactPhone: amazonForm.pickupContactPhone || null,
        amazonDeliveryAddress: amazonForm.deliveryAddress || null,
        amazonShipmentMode: amazonForm.shipmentMode || null,
        amazonBoxCount: amazonForm.boxCount || null,
        amazonPalletCount: amazonForm.palletCount || null,
        amazonCommodityDescription: amazonForm.commodityDescription || null,
        amazonDistanceMiles: amazonForm.distanceMiles || null,
        amazonBasePrice: amazonForm.basePrice || null,
        amazonFuelSurcharge: amazonForm.fuelSurcharge || null,
        amazonTotalPrice: amazonForm.totalPrice || null,
        amazonCurrency: amazonForm.currency || null,
      }

      const response = await fetchWithCSRF(`/api/fulfillment-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to save Amazon freight details')
        return
      }

      toast.success('Amazon freight details saved')
      setOrder(data?.data ?? null)
    } catch (_error) {
      toast.error('Failed to save Amazon freight details')
    } finally {
      setAmazonSaving(false)
    }
  }

  const refreshDocuments = async () => {
    if (!order) return
    const response = await fetch(`/api/fulfillment-orders/${order.id}/documents`)
    if (!response.ok) {
      setDocuments([])
      return
    }

    const payload = await response.json().catch(() => null)
    const list = payload?.documents
    setDocuments(Array.isArray(list) ? (list as FulfillmentOrderDocumentSummary[]) : [])
  }

  const handleDocumentUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    stage: FulfillmentOrderDocumentStage,
    documentType: string
  ) => {
    const file = event.target.files?.[0]
    if (!order || !file) return

    const key = `${stage}::${documentType}`
    setUploadingDoc(prev => ({ ...prev, [key]: true }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('stage', stage)
      formData.append('documentType', documentType)

      const response = await fetch(`/api/fulfillment-orders/${order.id}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(payload?.error ?? 'Failed to upload document')
        return
      }

      await refreshDocuments()
      toast.success('Document uploaded')
    } catch {
      toast.error('Failed to upload document')
    } finally {
      setUploadingDoc(prev => ({ ...prev, [key]: false }))
      event.target.value = ''
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
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Amazon Shipment & Freight</h2>
                  <p className="text-xs text-muted-foreground">
                    Shipment plan details and Amazon Freight capture.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAmazonSave}
                  disabled={amazonSaving}
                  className="gap-2"
                >
                  {amazonSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Amazon Freight'
                  )}
                </Button>
              </div>

              <div className="px-6 py-4 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Shipment ID</div>
                    <div className="text-sm text-foreground">{order.amazonShipmentId || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Shipment Name</div>
                    <div className="text-sm text-foreground">
                      {order.amazonShipmentName || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Shipment Status</div>
                    <div className="text-sm text-foreground">
                      {order.amazonShipmentStatus || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Destination FC</div>
                    <div className="text-sm text-foreground">
                      {order.amazonDestinationFulfillmentCenterId || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Label Prep Type</div>
                    <div className="text-sm text-foreground">
                      {order.amazonLabelPrepType || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Box Contents Source</div>
                    <div className="text-sm text-foreground">
                      {order.amazonBoxContentsSource || '—'}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">
                      Amazon Reference ID (PO)
                    </label>
                    <Input
                      value={amazonForm.referenceId}
                      onChange={e => updateAmazonFormField('referenceId', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Ship From</label>
                    <Textarea
                      value={formatAmazonAddress(order.amazonShipFromAddress)}
                      readOnly
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-sm font-semibold">Amazon Freight</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Shipment Reference</label>
                      <Input
                        value={amazonForm.shipmentReference}
                        onChange={e => updateAmazonFormField('shipmentReference', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Shipper ID</label>
                      <Input
                        value={amazonForm.shipperId}
                        onChange={e => updateAmazonFormField('shipperId', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Pickup Number</label>
                      <Input
                        value={amazonForm.pickupNumber}
                        onChange={e => updateAmazonFormField('pickupNumber', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pickup Appointment ID
                      </label>
                      <Input
                        value={amazonForm.pickupAppointmentId}
                        onChange={e =>
                          updateAmazonFormField('pickupAppointmentId', e.target.value)
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        ISA / Delivery Appointment ID
                      </label>
                      <Input
                        value={amazonForm.deliveryAppointmentId}
                        onChange={e =>
                          updateAmazonFormField('deliveryAppointmentId', e.target.value)
                        }
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Load ID</label>
                      <Input
                        value={amazonForm.loadId}
                        onChange={e => updateAmazonFormField('loadId', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pro/Freight Bill Number
                      </label>
                      <Input
                        value={amazonForm.freightBillNumber}
                        onChange={e => updateAmazonFormField('freightBillNumber', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">BOL Number</label>
                      <Input
                        value={amazonForm.billOfLadingNumber}
                        onChange={e => updateAmazonFormField('billOfLadingNumber', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Shipment Mode</label>
                      <Input
                        value={amazonForm.shipmentMode}
                        onChange={e => updateAmazonFormField('shipmentMode', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Box Count</label>
                      <Input
                        type="number"
                        min="0"
                        value={amazonForm.boxCount}
                        onChange={e => updateAmazonFormField('boxCount', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Pallet Count</label>
                      <Input
                        type="number"
                        min="0"
                        value={amazonForm.palletCount}
                        onChange={e => updateAmazonFormField('palletCount', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pickup Window Start
                      </label>
                      <Input
                        type="datetime-local"
                        value={amazonForm.pickupWindowStart}
                        onChange={e => updateAmazonFormField('pickupWindowStart', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pickup Window End
                      </label>
                      <Input
                        type="datetime-local"
                        value={amazonForm.pickupWindowEnd}
                        onChange={e => updateAmazonFormField('pickupWindowEnd', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Delivery Window Start
                      </label>
                      <Input
                        type="datetime-local"
                        value={amazonForm.deliveryWindowStart}
                        onChange={e => updateAmazonFormField('deliveryWindowStart', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Delivery Window End
                      </label>
                      <Input
                        type="datetime-local"
                        value={amazonForm.deliveryWindowEnd}
                        onChange={e => updateAmazonFormField('deliveryWindowEnd', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pickup Contact Name
                      </label>
                      <Input
                        value={amazonForm.pickupContactName}
                        onChange={e => updateAmazonFormField('pickupContactName', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Pickup Contact Phone
                      </label>
                      <Input
                        value={amazonForm.pickupContactPhone}
                        onChange={e => updateAmazonFormField('pickupContactPhone', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Pickup Address</label>
                      <Textarea
                        value={amazonForm.pickupAddress}
                        onChange={e => updateAmazonFormField('pickupAddress', e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Delivery Address</label>
                      <Textarea
                        value={amazonForm.deliveryAddress}
                        onChange={e => updateAmazonFormField('deliveryAddress', e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">
                        Commodity Description
                      </label>
                      <Textarea
                        value={amazonForm.commodityDescription}
                        onChange={e =>
                          updateAmazonFormField('commodityDescription', e.target.value)
                        }
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">
                        Distance (miles)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={amazonForm.distanceMiles}
                        onChange={e => updateAmazonFormField('distanceMiles', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Base Price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amazonForm.basePrice}
                        onChange={e => updateAmazonFormField('basePrice', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Fuel Surcharge</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amazonForm.fuelSurcharge}
                        onChange={e => updateAmazonFormField('fuelSurcharge', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Total Price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amazonForm.totalPrice}
                        onChange={e => updateAmazonFormField('totalPrice', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Currency</label>
                      <Input
                        value={amazonForm.currency}
                        onChange={e => updateAmazonFormField('currency', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Documents</h2>
                  <p className="text-xs text-muted-foreground">
                    Upload BOL, POD, and invoice files for the shipment.
                  </p>
                </div>
                {documentsLoading ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : null}
              </div>
              <div className="px-6 py-4 space-y-6">
                {renderDocumentStage('SHIPPING', 'Shipping Documents')}
                {renderDocumentStage('DELIVERY', 'Delivery Documents')}
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
