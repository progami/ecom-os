'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import {
  FileText,
  ArrowLeft,
  Loader2,
  Package2,
  FileEdit,
  Factory,
  Ship,
  Warehouse,
  Truck,
  Upload,
  ChevronRight,
  Check,
  XCircle,
  History,
} from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PO_STATUS_BADGE_CLASSES, PO_STATUS_LABELS } from '@/lib/constants/status-mappings'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'

// 5-Stage State Machine Types
type POStageStatus = 'DRAFT' | 'MANUFACTURING' | 'OCEAN' | 'WAREHOUSE' | 'SHIPPED' | 'CANCELLED'

interface PurchaseOrderLineSummary {
  id: string
  skuCode: string
  skuDescription: string | null
  batchLot: string | null
  quantity: number
  unitCost: number | null
  currency?: string
  status: 'PENDING' | 'POSTED' | 'CANCELLED'
  postedQuantity: number
  quantityReceived?: number | null
  lineNotes?: string | null
  createdAt: string
  updatedAt: string
}

interface StageApproval {
  stage: string
  approvedAt: string | null
  approvedBy: string | null
}

interface StageData {
  manufacturing: {
    proformaInvoiceNumber: string | null
    proformaInvoiceDate: string | null
    factoryName: string | null
    manufacturingStartDate: string | null
    expectedCompletionDate: string | null
    actualCompletionDate: string | null
    totalWeightKg: number | null
    totalVolumeCbm: number | null
    totalCartons: number | null
    totalPallets: number | null
    packagingNotes: string | null
    // Legacy
    proformaInvoiceId: string | null
    proformaInvoiceData: unknown
    manufacturingStart: string | null
    manufacturingEnd: string | null
    cargoDetails: unknown
  }
  ocean: {
    houseBillOfLading: string | null
    masterBillOfLading: string | null
    commercialInvoiceNumber: string | null
    packingListRef: string | null
    vesselName: string | null
    voyageNumber: string | null
    portOfLoading: string | null
    portOfDischarge: string | null
    estimatedDeparture: string | null
    estimatedArrival: string | null
    actualDeparture: string | null
    actualArrival: string | null
    // Legacy
    commercialInvoiceId: string | null
  }
  warehouse: {
    warehouseCode: string | null
    warehouseName: string | null
    customsEntryNumber: string | null
    customsClearedDate: string | null
    dutyAmount: number | null
    dutyCurrency: string | null
    surrenderBlDate: string | null
    transactionCertNumber: string | null
    receivedDate: string | null
    discrepancyNotes: string | null
    // Legacy
    warehouseInvoiceId: string | null
    surrenderBL: string | null
    transactionCertificate: string | null
    customsDeclaration: string | null
  }
  shipped: {
    shipToName: string | null
    shipToAddress: string | null
    shipToCity: string | null
    shipToCountry: string | null
    shipToPostalCode: string | null
    shippingCarrier: string | null
    shippingMethod: string | null
    trackingNumber: string | null
    shippedDate: string | null
    proofOfDeliveryRef: string | null
    deliveredDate: string | null
    // Legacy
    proofOfDelivery: string | null
    shippedAt: string | null
    shippedBy: string | null
  }
}

interface PurchaseOrderSummary {
  id: string
  orderNumber: string
  poNumber: string | null
  type: 'PURCHASE' | 'ADJUSTMENT'
  status: POStageStatus
  isLegacy: boolean
  warehouseCode: string | null
  warehouseName: string | null
  counterpartyName: string | null
  expectedDate: string | null
  createdAt: string
  updatedAt: string
  notes?: string | null
  createdByName: string | null
  lines: PurchaseOrderLineSummary[]
  stageData: StageData
  approvalHistory: StageApproval[]
}

const DEFAULT_BADGE_CLASS = 'bg-muted text-muted-foreground border border-muted'

type PurchaseOrderDocumentStage = 'MANUFACTURING' | 'OCEAN' | 'WAREHOUSE' | 'SHIPPED'

interface PurchaseOrderDocumentSummary {
  id: string
  stage: PurchaseOrderDocumentStage
  documentType: string
  fileName: string
  contentType: string
  size: number
  uploadedAt: string
  uploadedByName: string | null
  s3Key: string
  viewUrl: string
}

const STAGE_DOCUMENTS: Record<PurchaseOrderDocumentStage, Array<{ id: string; label: string }>> = {
  MANUFACTURING: [{ id: 'proforma_invoice', label: 'Proforma Invoice' }],
  OCEAN: [
    { id: 'commercial_invoice', label: 'Commercial Invoice' },
    { id: 'bill_of_lading', label: 'Bill of Lading' },
    { id: 'packing_list', label: 'Packing List' },
  ],
  WAREHOUSE: [
    { id: 'movement_note', label: 'Movement Note / Warehouse Receipt' },
    { id: 'custom_declaration', label: 'Customs Declaration (CDS)' },
  ],
  SHIPPED: [{ id: 'proof_of_pickup', label: 'Proof of Pickup' }],
}

// Stage configuration
const STAGES = [
  { value: 'DRAFT', label: 'Draft', icon: FileEdit, color: 'slate' },
  { value: 'MANUFACTURING', label: 'Manufacturing', icon: Factory, color: 'amber' },
  { value: 'OCEAN', label: 'In Transit', icon: Ship, color: 'blue' },
  { value: 'WAREHOUSE', label: 'At Warehouse', icon: Warehouse, color: 'purple' },
  { value: 'SHIPPED', label: 'Shipped', icon: Truck, color: 'emerald' },
] as const

function statusBadgeClasses(status: POStageStatus) {
  return PO_STATUS_BADGE_CLASSES[status] ?? DEFAULT_BADGE_CLASS
}

function formatStatusLabel(status: POStageStatus) {
  return PO_STATUS_LABELS[status] ?? status
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

function formatDateOnly(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<PurchaseOrderSummary | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState({
    counterpartyName: '',
    expectedDate: '',
    notes: '',
  })

  // Stage transition form data
  const [stageFormData, setStageFormData] = useState<Record<string, string>>({})
  const [warehouses, setWarehouses] = useState<Array<{ code: string; name: string }>>([])
  const [warehousesLoading, setWarehousesLoading] = useState(false)
  const [documents, setDocuments] = useState<PurchaseOrderDocumentSummary[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<Record<string, boolean>>({})

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'cancel' | 'ship' | null
    title: string
    message: string
  }>({ open: false, type: null, title: '', message: '' })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/purchase-orders/${params.id}`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }

    const loadWarehouses = async () => {
      try {
        setWarehousesLoading(true)
        const response = await fetch('/api/warehouses')
        if (!response.ok) return
        const payload: unknown = await response.json().catch(() => null)

        const listCandidate: unknown =
          payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
            ? (payload as { data?: unknown }).data
            : payload

        if (!Array.isArray(listCandidate)) {
          setWarehouses([])
          return
        }

        const parsed = listCandidate
          .map((item): { code: string; name: string } | null => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null
            const record = item as Record<string, unknown>
            const code = record.code
            const name = record.name
            if (typeof code !== 'string' || typeof name !== 'string') return null
            if (!code.trim() || !name.trim()) return null
            return { code, name }
          })
          .filter((value): value is { code: string; name: string } => value !== null)

        setWarehouses(parsed)
      } catch (_error) {
        // Non-blocking; warehouse can still be selected later via API if needed.
      } finally {
        setWarehousesLoading(false)
      }
    }

    const loadOrder = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/purchase-orders/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to load purchase order')
        }
        const data = await response.json()
        setOrder(data)
      } catch (_error) {
        toast.error('Failed to load purchase order')
        router.push('/operations/purchase-orders')
      } finally {
        setLoading(false)
      }
    }

    loadWarehouses()
    loadOrder()
  }, [params.id, router, session, status])

  useEffect(() => {
    if (!order?.id) return

    const loadDocuments = async () => {
      try {
        setDocumentsLoading(true)
        const response = await fetch(`/api/purchase-orders/${order.id}/documents`)
        if (!response.ok) {
          setDocuments([])
          return
        }

        const payload = await response.json().catch(() => null)
        const list = payload?.documents
        setDocuments(Array.isArray(list) ? (list as PurchaseOrderDocumentSummary[]) : [])
      } catch {
        setDocuments([])
      } finally {
        setDocumentsLoading(false)
      }
    }

    loadDocuments()
  }, [order?.id])

  useEffect(() => {
    if (!order || isEditingDetails) return

    setDetailsDraft({
      counterpartyName: order.counterpartyName ?? '',
      expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
      notes: order.notes ?? '',
    })
  }, [order, isEditingDetails])

  const currentStageIndex = useMemo(() => {
    if (!order) return 0
    const idx = STAGES.findIndex(s => s.value === order.status)
    return idx >= 0 ? idx : 0
  }, [order])

  const nextStage = useMemo(() => {
    if (!order || order.status === 'CANCELLED') return null
    const idx = STAGES.findIndex(s => s.value === order.status)
    if (idx >= 0 && idx < STAGES.length - 1) {
      return STAGES[idx + 1]
    }
    return null
  }, [order])

  const nextStageDocsComplete = useMemo(() => {
    if (!order || !nextStage) return true
    const stage = nextStage.value as PurchaseOrderDocumentStage
    const required = STAGE_DOCUMENTS[stage] ?? []
    if (required.length === 0) return true

    return required.every(req =>
      documents.some(doc => doc.stage === stage && doc.documentType === req.id)
    )
  }, [documents, nextStage, order])

  const handleTransition = async (targetStatus: POStageStatus) => {
    if (!order || transitioning) return

    // Show confirmation dialog for cancel
    if (targetStatus === 'CANCELLED') {
      setConfirmDialog({
        open: true,
        type: 'cancel',
        title: 'Cancel Order',
        message: 'Are you sure you want to cancel this order? This cannot be undone.',
      })
      return
    }

    // Show confirmation dialog for shipped
    if (targetStatus === 'SHIPPED') {
      setConfirmDialog({
        open: true,
        type: 'ship',
        title: 'Mark as Shipped',
        message: 'Mark this order as shipped? This will finalize the order.',
      })
      return
    }

    await executeTransition(targetStatus)
  }

  const executeTransition = async (targetStatus: POStageStatus) => {
    if (!order || transitioning) return

    try {
      setTransitioning(true)
      const response = await fetchWithCSRF(`/api/purchase-orders/${order.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus,
          stageData: stageFormData,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Failed to transition order')
        return
      }

      const updated = await response.json()
      setOrder(updated)
      setStageFormData({}) // Clear form
      toast.success(`Order moved to ${formatStatusLabel(targetStatus)}`)
    } catch (_error) {
      toast.error('Failed to transition order')
    } finally {
      setTransitioning(false)
    }
  }

  const handleConfirmDialogConfirm = async () => {
    if (confirmDialog.type === 'cancel') {
      await executeTransition('CANCELLED')
    } else if (confirmDialog.type === 'ship') {
      await executeTransition('SHIPPED')
    }
    setConfirmDialog({ open: false, type: null, title: '', message: '' })
  }

  const handleConfirmDialogClose = () => {
    setConfirmDialog({ open: false, type: null, title: '', message: '' })
  }

  const handleEditDetails = () => {
    if (!order) return
    setDetailsDraft({
      counterpartyName: order.counterpartyName ?? '',
      expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
      notes: order.notes ?? '',
    })
    setIsEditingDetails(true)
  }

  const handleCancelEditDetails = () => {
    if (!order) return
    setDetailsDraft({
      counterpartyName: order.counterpartyName ?? '',
      expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
      notes: order.notes ?? '',
    })
    setIsEditingDetails(false)
  }

  const handleSaveDetails = async () => {
    if (!order || detailsSaving) return
    try {
      setDetailsSaving(true)
      const response = await fetchWithCSRF(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyName: detailsDraft.counterpartyName,
          expectedDate: detailsDraft.expectedDate,
          notes: detailsDraft.notes,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Failed to update purchase order')
        return
      }

      const updated = await response.json()
      setOrder(updated)
      toast.success('Purchase order updated')
      setIsEditingDetails(false)
    } catch (_error) {
      toast.error('Failed to update purchase order')
    } finally {
      setDetailsSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Loading purchase order...</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!order) {
    return null
  }

  const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const isTerminal = order.status === 'SHIPPED' || order.status === 'CANCELLED'
  const canEdit = !isTerminal && order.status === 'DRAFT'

  const hasManufacturingInfo = Boolean(
    order.stageData.manufacturing?.proformaInvoiceNumber ||
      order.stageData.manufacturing?.proformaInvoiceId ||
      order.stageData.manufacturing?.manufacturingStartDate ||
      order.stageData.manufacturing?.manufacturingStart ||
      order.stageData.manufacturing?.factoryName ||
      order.stageData.manufacturing?.expectedCompletionDate
  )

  const hasOceanInfo = Boolean(
    order.stageData.ocean?.houseBillOfLading ||
      order.stageData.ocean?.masterBillOfLading ||
      order.stageData.ocean?.vesselName ||
      order.stageData.ocean?.commercialInvoiceNumber ||
      order.stageData.ocean?.commercialInvoiceId
  )

  const hasWarehouseInfo = Boolean(
    order.stageData.warehouse?.warehouseCode ||
      order.stageData.warehouse?.customsEntryNumber ||
      order.stageData.warehouse?.customsClearedDate ||
      order.stageData.warehouse?.receivedDate ||
      order.stageData.warehouse?.warehouseInvoiceId
  )

  const hasShippedInfo = Boolean(
    order.stageData.shipped?.shipToName ||
      order.stageData.shipped?.shippingCarrier ||
      order.stageData.shipped?.trackingNumber ||
      order.stageData.shipped?.shippedDate ||
      order.stageData.shipped?.proofOfDeliveryRef ||
      order.stageData.shipped?.proofOfDelivery ||
      order.stageData.shipped?.deliveredDate
  )

  const hasAnyStageInfo = hasManufacturingInfo || hasOceanInfo || hasWarehouseInfo || hasShippedInfo

  const breadcrumbItems = [
    { label: 'Operations', href: '/operations' },
    { label: 'Purchase Orders', href: '/operations/purchase-orders' },
    { label: order.poNumber || order.orderNumber },
  ]

  const breadcrumbContent = (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" className="gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {breadcrumbItems.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{item.label}</span>
            )}
          </div>
        ))}
      </nav>
    </div>
  )

  // Stage-specific form fields based on next stage
  const renderStageTransitionForm = () => {
    if (!nextStage) return null

    const fields: Array<{
      key: string
      label: string
      type: 'text' | 'date' | 'select'
      placeholder?: string
      options?: Array<{ value: string; label: string }>
      disabled?: boolean
    }> = []

    switch (nextStage.value) {
      case 'MANUFACTURING':
        fields.push(
          { key: 'proformaInvoiceNumber', label: 'Proforma Invoice Number', type: 'text' },
          { key: 'manufacturingStartDate', label: 'Manufacturing Start Date', type: 'date' }
        )
        break
      case 'OCEAN':
        fields.push(
          { key: 'houseBillOfLading', label: 'House Bill of Lading', type: 'text' },
          { key: 'commercialInvoiceNumber', label: 'Commercial Invoice Number', type: 'text' },
          { key: 'packingListRef', label: 'Packing List Reference', type: 'text' },
          { key: 'vesselName', label: 'Vessel Name', type: 'text' },
          { key: 'portOfLoading', label: 'Port of Loading', type: 'text' },
          { key: 'portOfDischarge', label: 'Port of Discharge', type: 'text' }
        )
        break
      case 'WAREHOUSE':
        fields.push(
          {
            key: 'warehouseCode',
            label: 'Warehouse',
            type: 'select',
            options: warehouses.map(w => ({ value: w.code, label: `${w.name} (${w.code})` })),
            disabled: warehousesLoading || warehouses.length === 0,
          },
          {
            key: 'receiveType',
            label: 'Inbound Type',
            type: 'select',
            options: [
              { value: 'LCL', label: 'LCL' },
              { value: 'CONTAINER_20', label: "20' Container" },
              { value: 'CONTAINER_40', label: "40' Container" },
              { value: 'CONTAINER_40_HQ', label: "40' HQ Container" },
              { value: 'CONTAINER_45_HQ', label: "45' HQ Container" },
            ],
          },
          { key: 'customsEntryNumber', label: 'Customs Entry Number', type: 'text' },
          { key: 'customsClearedDate', label: 'Customs Cleared Date', type: 'date' },
          { key: 'receivedDate', label: 'Received Date', type: 'date' }
        )
        break
      case 'SHIPPED':
        fields.push(
          { key: 'shipToName', label: 'Ship To Name', type: 'text' },
          {
            key: 'shipMode',
            label: 'Outbound Mode',
            type: 'select',
            options: [
              { value: 'CARTONS', label: 'Cartons' },
              { value: 'PALLETS', label: 'Pallets' },
            ],
          },
          { key: 'shippingCarrier', label: 'Shipping Carrier', type: 'text' },
          { key: 'trackingNumber', label: 'Tracking Number', type: 'text' },
          { key: 'shippedDate', label: 'Shipped Date', type: 'date' }
        )
        break
    }

    if (fields.length === 0) return null

    const docStage = nextStage.value as PurchaseOrderDocumentStage
    const requiredDocs = STAGE_DOCUMENTS[docStage] ?? []

    const docsByType = new Map<string, PurchaseOrderDocumentSummary>(
      documents
        .filter(doc => doc.stage === docStage)
        .map(doc => [`${doc.stage}::${doc.documentType}`, doc])
    )

    const refreshDocuments = async () => {
      if (!order) return
      const response = await fetch(`/api/purchase-orders/${order.id}/documents`)
      if (!response.ok) {
        setDocuments([])
        return
      }
      const payload = await response.json().catch(() => null)
      const list = payload?.documents
      setDocuments(Array.isArray(list) ? (list as PurchaseOrderDocumentSummary[]) : [])
    }

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>, documentType: string) => {
      const file = event.target.files?.[0]
      if (!order || !file) return

      const key = `${docStage}::${documentType}`
      setUploadingDoc(prev => ({ ...prev, [key]: true }))

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('stage', docStage)
        formData.append('documentType', documentType)

        const response = await fetch(`/api/purchase-orders/${order.id}/documents`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
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

    return (
      <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
        <h4 className="text-sm font-semibold text-slate-900">
          Advance: {STAGES[currentStageIndex]?.label ?? formatStatusLabel(order.status)} →{' '}
          {nextStage.label}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Provide the details and required documents below to move to the next stage.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={stageFormData[field.key] || ''}
                  onChange={e => {
                    const value = e.target.value
                    setStageFormData(prev => ({ ...prev, [field.key]: value }))
                  }}
                  disabled={field.disabled}
                  className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm disabled:opacity-50"
                >
                  <option value="">
                    {field.key === 'warehouseCode'
                      ? warehousesLoading
                        ? 'Loading warehouses…'
                        : 'Select warehouse'
                      : `Select ${field.label.toLowerCase()}`}
                  </option>
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={field.type}
                  value={stageFormData[field.key] || ''}
                  onChange={e =>
                    setStageFormData(prev => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.type === 'date' ? '' : `Enter ${field.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}
        </div>

        {requiredDocs.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-slate-900">Required documents</h5>
              {documentsLoading && (
                <span className="text-xs text-muted-foreground">Loading…</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {requiredDocs.map(doc => {
                const key = `${docStage}::${doc.id}`
                const existing = docsByType.get(key)
                const isUploading = Boolean(uploadingDoc[key])

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {existing ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-900">{doc.label}</span>
                      </div>
                      {existing ? (
                        <a
                          href={existing.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-primary hover:underline mt-0.5"
                          title={existing.fileName}
                        >
                          {existing.fileName}
                        </a>
                      ) : (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Not uploaded yet
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {existing ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          className="hidden"
                          disabled={isUploading}
                          onChange={e => handleUpload(e, doc.id)}
                        />
                      </label>
                      {isUploading && <span className="text-xs text-muted-foreground">…</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const tabConfig = [
    { id: 'overview', label: 'Overview', icon: <FileText className="h-4 w-4" /> },
    { id: 'cargo', label: `Cargo (${order.lines.length})`, icon: <Package2 className="h-4 w-4" /> },
    {
      id: 'documents',
      label: `Documents (${documents.length})`,
      icon: <Upload className="h-4 w-4" />,
    },
    { id: 'history', label: 'Approval History', icon: <History className="h-4 w-4" /> },
  ]

  return (
    <DashboardLayout hideBreadcrumb customBreadcrumb={breadcrumbContent}>
      <div className="flex h-full min-h-0 flex-col space-y-6 overflow-y-auto pr-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border bg-emerald-50 border-emerald-200 text-emerald-600">
              <Package2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {order.poNumber || order.orderNumber}
              </h1>
              <p className="text-sm text-muted-foreground">
                {order.warehouseCode && order.warehouseName
                  ? `${order.warehouseName} (${order.warehouseCode})`
                  : 'Warehouse not set yet (selected at Stage 4)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusBadgeClasses(order.status)}>
              {formatStatusLabel(order.status)}
            </Badge>
          </div>
        </div>

        {/* Stage Progress Bar */}
        {!order.isLegacy && order.status !== 'CANCELLED' && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Order Progress</h2>
              {order.counterpartyName && (
                <span className="text-sm text-muted-foreground">
                  Counterparty: {order.counterpartyName}
                </span>
              )}
            </div>

            {/* Stage Progress */}
            <div className="flex items-center justify-between relative">
              {/* Progress line */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 mx-8" />
              <div
                className="absolute top-5 left-0 h-1 bg-emerald-500 transition-all duration-300 mx-8"
                style={{
                  width: `calc(${(currentStageIndex / (STAGES.length - 1)) * 100}% - 4rem)`,
                }}
              />

              {STAGES.map((stage, index) => {
                const isCompleted = index < currentStageIndex
                const isCurrent = index === currentStageIndex
                const Icon = stage.icon

                return (
                  <div key={stage.value} className="flex flex-col items-center relative z-10">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-white border-emerald-500 text-emerald-600'
                            : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${
                        isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Stage Transition Form */}
            {renderStageTransitionForm()}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
	              {nextStage && (
	                <Button
	                  onClick={() => handleTransition(nextStage.value as POStageStatus)}
	                  disabled={transitioning || documentsLoading || !nextStageDocsComplete}
	                  className="gap-2"
	                >
                  {transitioning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Transitioning...
                    </>
                  ) : (
                    <>
                      Advance to {nextStage.label}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
              {!isTerminal && (
                <Button
                  variant="destructive"
                  onClick={() => handleTransition('CANCELLED')}
                  disabled={transitioning}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {order.status === 'CANCELLED' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-slate-700">
              This order has been cancelled and cannot be modified.
            </p>
          </div>
        )}

        {/* Tabs */}
        <TabbedContainer tabs={tabConfig} defaultTab="overview">
          <TabPanel>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Order Details</h3>
                  <p className="text-xs text-muted-foreground">
                    Core information about this purchase order
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {isEditingDetails ? (
                      <>
                        <Button size="sm" onClick={handleSaveDetails} disabled={detailsSaving}>
                          {detailsSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditDetails}
                          disabled={detailsSaving}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={handleEditDetails}>
                        Edit Details
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">PO Number</label>
                  <Input value={order.poNumber || order.orderNumber} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
                  <Input
                    value={
                      order.warehouseCode && order.warehouseName
                        ? `${order.warehouseName} (${order.warehouseCode})`
                        : 'Not set yet'
                    }
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Counterparty</label>
                  {isEditingDetails ? (
                    <Input
                      value={detailsDraft.counterpartyName}
                      placeholder="Enter counterparty name"
                      onChange={e =>
                        setDetailsDraft(d => ({ ...d, counterpartyName: e.target.value }))
                      }
                      disabled={detailsSaving}
                    />
                  ) : (
                    <Input value={order.counterpartyName || '—'} disabled readOnly />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Expected Date</label>
                  {isEditingDetails ? (
                    <Input
                      type="date"
                      value={detailsDraft.expectedDate}
                      onChange={e => setDetailsDraft(d => ({ ...d, expectedDate: e.target.value }))}
                      disabled={detailsSaving}
                    />
                  ) : (
                    <Input value={formatDate(order.expectedDate)} disabled readOnly />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <Input value={formatDate(order.createdAt)} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <Input value={order.createdByName || '—'} disabled readOnly />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                {isEditingDetails ? (
                  <Textarea
                    value={detailsDraft.notes}
                    onChange={e => setDetailsDraft(d => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    disabled={detailsSaving}
                    placeholder="Add internal notes for the team"
                  />
                ) : (
                  <Textarea
                    value={order.notes || ''}
                    disabled
                    readOnly
                    rows={4}
                    placeholder="No internal notes yet."
                  />
                )}
              </div>

              {/* Stage Data Summary - Clean Timeline */}
              {hasAnyStageInfo && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-900">Stage History</h3>
                  <div className="space-y-2">
                    {/* Manufacturing */}
                    {hasManufacturingInfo && (
                      <div className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-24 text-slate-500 font-medium">Manufacturing</div>
                        <div className="flex-1 text-slate-700">
                          {[
                            order.stageData.manufacturing?.proformaInvoiceNumber && `PI: ${order.stageData.manufacturing.proformaInvoiceNumber}`,
                            (order.stageData.manufacturing?.manufacturingStartDate || order.stageData.manufacturing?.manufacturingStart) &&
                              `Started: ${formatDateOnly(order.stageData.manufacturing.manufacturingStartDate || order.stageData.manufacturing.manufacturingStart)}`,
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    )}
                    {/* Ocean/Transit */}
                    {hasOceanInfo && (
                      <div className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-24 text-slate-500 font-medium">In Transit</div>
                        <div className="flex-1 text-slate-700">
                          {[
                            order.stageData.ocean?.houseBillOfLading && `B/L: ${order.stageData.ocean.houseBillOfLading}`,
                            order.stageData.ocean?.vesselName && `Vessel: ${order.stageData.ocean.vesselName}`,
                            (order.stageData.ocean?.portOfLoading && order.stageData.ocean?.portOfDischarge) &&
                              `${order.stageData.ocean.portOfLoading} → ${order.stageData.ocean.portOfDischarge}`,
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    )}
                    {/* Warehouse */}
                    {hasWarehouseInfo && (
                      <div className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-24 text-slate-500 font-medium">Warehouse</div>
                        <div className="flex-1 text-slate-700">
                          {[
                            order.stageData.warehouse?.customsEntryNumber && `Customs: ${order.stageData.warehouse.customsEntryNumber}`,
                            order.stageData.warehouse?.receivedDate && `Received: ${formatDateOnly(order.stageData.warehouse.receivedDate)}`,
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    )}
                    {/* Shipped */}
                    {hasShippedInfo && (
                      <div className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-24 text-slate-500 font-medium">Shipped</div>
                        <div className="flex-1 text-slate-700">
                          {[
                            order.stageData.shipped?.trackingNumber && `Tracking: ${order.stageData.shipped.trackingNumber}`,
                            order.stageData.shipped?.shippedDate && `Date: ${formatDateOnly(order.stageData.shipped.shippedDate)}`,
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                <span>
                  {order.lines.length} line{order.lines.length === 1 ? '' : 's'}
                </span>
                <span>Total quantity: {totalQuantity.toLocaleString()}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">SKU</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-left font-semibold">Batch / Lot</th>
                      <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                      <th className="px-3 py-2 text-right font-semibold">Received</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                          No lines added to this order yet.
                        </td>
                      </tr>
                    ) : (
                      order.lines.map(line => (
                        <tr key={line.id} className="odd:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                            {line.skuCode}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {line.skuDescription || '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {line.batchLot || '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">
                            {line.quantity.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                            {(line.quantityReceived ?? line.postedQuantity).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge variant="outline">{line.status}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                  <p className="text-xs text-muted-foreground">
                    View uploaded documents across every stage.
                  </p>
                </div>
                {documentsLoading && (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                )}
              </div>

              {(['MANUFACTURING', 'OCEAN', 'WAREHOUSE', 'SHIPPED'] as const).map(stage => {
                const stageLabel = STAGES.find(item => item.value === stage)?.label ?? stage
                const required = STAGE_DOCUMENTS[stage] ?? []
                const stageDocs = documents.filter(doc => doc.stage === stage)
                const docsByType = new Map(stageDocs.map(doc => [doc.documentType, doc]))
                const requiredDocTypes = new Set(required.map(doc => doc.id))
                const otherDocs = stageDocs.filter(doc => !requiredDocTypes.has(doc.documentType))

                return (
                  <div key={stage} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">{stageLabel}</h4>
                      <Badge variant="outline">{stageDocs.length} uploaded</Badge>
                    </div>

                    {required.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {required.map(docType => {
                          const existing = docsByType.get(docType.id)
                          return (
                            <div
                              key={`${stage}::${docType.id}`}
                              className="rounded-md border bg-slate-50 px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                {existing ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-slate-400" />
                                )}
                                <span className="text-sm font-medium text-slate-900">
                                  {docType.label}
                                </span>
                              </div>

                              {existing ? (
                                <div className="mt-1">
                                  <a
                                    href={existing.viewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block truncate text-xs text-primary hover:underline"
                                    title={existing.fileName}
                                  >
                                    {existing.fileName}
                                  </a>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Uploaded {formatDate(existing.uploadedAt)}
                                    {existing.uploadedByName ? ` • ${existing.uploadedByName}` : ''}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-muted-foreground">Not uploaded yet</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {otherDocs.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Other uploads
                        </p>
                        <div className="mt-2 space-y-1">
                          {otherDocs.map(doc => (
                            <a
                              key={doc.id}
                              href={doc.viewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-xs text-primary hover:underline"
                              title={doc.fileName}
                            >
                              {doc.documentType}: {doc.fileName}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {required.length === 0 && stageDocs.length === 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">No documents uploaded.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </TabPanel>

          <TabPanel>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Stage Approval History</h3>
                <p className="text-xs text-muted-foreground">
                  Track who approved each stage transition
                </p>
              </div>

              {order.approvalHistory && order.approvalHistory.length > 0 ? (
                <div className="space-y-3">
                  {order.approvalHistory.map((approval, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-4 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{approval.stage}</p>
                          <p className="text-xs text-muted-foreground">
                            Approved by {approval.approvedBy || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {approval.approvedAt ? formatDate(approval.approvedAt) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>
              )}
            </div>
          </TabPanel>
        </TabbedContainer>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        onConfirm={handleConfirmDialogConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type === 'cancel' ? 'danger' : 'info'}
        confirmText={confirmDialog.type === 'cancel' ? 'Cancel Order' : 'Confirm'}
        cancelText="Go Back"
      />
    </DashboardLayout>
  )
}
