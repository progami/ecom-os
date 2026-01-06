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
import {
  ArrowLeft,
  Loader2,
	Package2,
	FileEdit,
	Send,
	Factory,
	Ship,
	Warehouse,
	PackageX,
	Upload,
	Download,
	ChevronRight,
	Check,
  XCircle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PO_STATUS_BADGE_CLASSES, PO_STATUS_LABELS } from '@/lib/constants/status-mappings'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { withBasePath } from '@/lib/utils/base-path'

// 5-Stage State Machine Types
type POStageStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'MANUFACTURING'
  | 'OCEAN'
  | 'WAREHOUSE'
  | 'SHIPPED'
  | 'REJECTED'
  | 'CANCELLED'

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
  incoterms: string | null
  paymentTerms: string | null
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

const STAGE_DOCUMENTS: Record<
  Exclude<PurchaseOrderDocumentStage, 'SHIPPED'>,
  Array<{ id: string; label: string }>
> = {
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
}

// Stage configuration
const STAGES = [
  { value: 'DRAFT', label: 'Draft', icon: FileEdit, color: 'slate' },
  { value: 'ISSUED', label: 'Issued', icon: Send, color: 'emerald' },
  { value: 'MANUFACTURING', label: 'Manufacturing', icon: Factory, color: 'amber' },
  { value: 'OCEAN', label: 'In Transit', icon: Ship, color: 'blue' },
  { value: 'WAREHOUSE', label: 'At Warehouse', icon: Warehouse, color: 'purple' },
] as const

const INCOTERMS_OPTIONS = ['EXW', 'FOB', 'FCA', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const

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
  const [tenantDestination, setTenantDestination] = useState<string>('')
  const [transitioning, setTransitioning] = useState(false)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState({
    counterpartyName: '',
    expectedDate: '',
    incoterms: '',
    paymentTerms: '',
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
    type: 'cancel' | 'reject' | null
    title: string
    message: string
  }>({ open: false, type: null, title: '', message: '' })

  // Stage-based navigation - which stage view is currently selected
  const [selectedStageView, setSelectedStageView] = useState<string | null>(null)

  // Collapsible sections
  const [showApprovalHistory, setShowApprovalHistory] = useState(false)

  // Advance stage modal
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal(
        '/login',
        `${window.location.origin}/operations/purchase-orders/${params.id}`
      )
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

    const loadTenant = async () => {
      try {
        const response = await fetch('/api/tenant/current')
        if (!response.ok) return
        const payload = await response.json().catch(() => null)
        const tenantName = payload?.current?.name
        const tenantCode = payload?.current?.displayName ?? payload?.current?.code
        if (typeof tenantName !== 'string' || !tenantName.trim()) return
        const label =
          typeof tenantCode === 'string' && tenantCode.trim()
            ? `${tenantName.trim()} (${tenantCode.trim().toUpperCase()})`
            : tenantName.trim()
        setTenantDestination(label)
      } catch {
        // Non-blocking
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
    loadTenant()
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
      incoterms: order.incoterms ?? '',
      paymentTerms: order.paymentTerms ?? '',
      notes: order.notes ?? '',
    })
  }, [order, isEditingDetails])

  const currentStageIndex = useMemo(() => {
    if (!order) return 0
    const idx = STAGES.findIndex(s => s.value === order.status)
    if (idx >= 0) return idx
    if (order.status === 'SHIPPED') return STAGES.length - 1
    return 0
  }, [order])

  // The stage view being displayed (defaults to current stage)
  const activeViewStage = useMemo(() => {
    if (selectedStageView) return selectedStageView
    if (!order) return 'DRAFT'
    return order.status
  }, [selectedStageView, order])

  // Is the active view stage the current stage?
  const isViewingCurrentStage = activeViewStage === order?.status

  // Can user click on a stage to view it?
  const canViewStage = (stageValue: string) => {
    if (!order || order.status === 'CANCELLED') return false
    const targetIdx = STAGES.findIndex(s => s.value === stageValue)
    if (targetIdx < 0) return false
    // Can view completed stages and current stage only
    return targetIdx <= currentStageIndex
  }

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
    const stage = nextStage.value as keyof typeof STAGE_DOCUMENTS
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

    if (targetStatus === 'REJECTED') {
      setConfirmDialog({
        open: true,
        type: 'reject',
        title: 'Mark as Rejected',
        message: 'Mark this PO as rejected by the supplier? You can reopen it as a draft to revise and re-issue.',
      })
      return
    }

    await executeTransition(targetStatus)
  }

  const executeTransition = async (targetStatus: POStageStatus): Promise<boolean> => {
    if (!order || transitioning) return false

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
        return false
      }

      const updated = await response.json()
      setOrder(updated)
      setStageFormData({}) // Clear form
      toast.success(`Order moved to ${formatStatusLabel(targetStatus)}`)
      return true
    } catch (_error) {
      toast.error('Failed to transition order')
      return false
    } finally {
      setTransitioning(false)
    }
  }

  const handleConfirmDialogConfirm = async () => {
    if (confirmDialog.type === 'cancel') {
      await executeTransition('CANCELLED')
    }
    if (confirmDialog.type === 'reject') {
      await executeTransition('REJECTED')
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
      incoterms: order.incoterms ?? '',
      paymentTerms: order.paymentTerms ?? '',
      notes: order.notes ?? '',
    })
    setIsEditingDetails(true)
  }

  const handleCancelEditDetails = () => {
    if (!order) return
    setDetailsDraft({
      counterpartyName: order.counterpartyName ?? '',
      expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
      incoterms: order.incoterms ?? '',
      paymentTerms: order.paymentTerms ?? '',
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
          incoterms: detailsDraft.incoterms,
          paymentTerms: detailsDraft.paymentTerms,
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
  const isTerminal = order.status === 'SHIPPED' || order.status === 'CANCELLED' || order.status === 'REJECTED'
  const canEdit = !isTerminal && order.status === 'DRAFT'
  const canDownloadPdf = order.status !== 'DRAFT'

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

    if (nextStage.value === 'ISSUED') {
      const missingFields = [
        !order?.expectedDate ? 'Expected date' : null,
        !order?.incoterms ? 'Incoterms' : null,
        !order?.paymentTerms ? 'Payment terms' : null,
      ].filter((value): value is string => value !== null)
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Marking this PO as issued locks draft edits and indicates it has been sent to the supplier.
          </p>
          {missingFields.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Missing required details: {missingFields.join(', ')}. Set them in Order Details.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            You can download the PDF and share it with the supplier once issued.
          </p>
        </div>
      )
    }

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
    }

    if (fields.length === 0) return null

    const docStage = nextStage.value as keyof typeof STAGE_DOCUMENTS
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
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4">
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-slate-900">Required Documents</h5>
              {documentsLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
            </div>
            <div className="space-y-2">
              {requiredDocs.map(doc => {
                const key = `${docStage}::${doc.id}`
                const existing = docsByType.get(key)
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
                        <span className="text-sm font-medium text-slate-900">{doc.label}</span>
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
                        onChange={e => handleUpload(e, doc.id)}
                      />
                      {isUploading && <span className="text-xs text-muted-foreground ml-1">…</span>}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render documents for a specific stage
  const renderStageDocuments = (stage: 'MANUFACTURING' | 'OCEAN' | 'WAREHOUSE') => {
    const required = STAGE_DOCUMENTS[stage] ?? []
    const stageDocs = documents.filter(doc => doc.stage === stage)
    const docsByType = new Map(stageDocs.map(doc => [doc.documentType, doc]))

    if (required.length === 0 && stageDocs.length === 0) return null

    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Documents
          </h4>
          {documentsLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {required.map(docType => {
            const existing = docsByType.get(docType.id)
            return (
              <div
                key={docType.id}
                className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {existing ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{docType.label}</span>
                    {existing && (
                      <a
                        href={existing.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                        title={existing.fileName}
                      >
                        {existing.fileName}
                      </a>
                    )}
                  </div>
                </div>
                {existing && (
                  <a
                    href={existing.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 text-xs text-primary hover:underline ml-2"
                  >
                    View
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

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
                {order.warehouseCode || order.warehouseName ? (
                  <>
                    Warehouse: {order.warehouseName ?? order.warehouseCode}
                    {order.warehouseName && order.warehouseCode
                      ? ` (${order.warehouseCode})`
                      : null}
                  </>
                ) : (
                  'Warehouse: Not assigned'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDownloadPdf && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={withBasePath(`/api/purchase-orders/${order.id}/pdf`)}
                  download
                  className="flex items-center"
                >
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </a>
              </Button>
            )}
            <Badge className={statusBadgeClasses(order.status)}>
              {formatStatusLabel(order.status)}
            </Badge>
          </div>
        </div>

        {/* Stage Progress Bar */}
        {!order.isLegacy && order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Order Progress</h2>
              {order.counterpartyName && (
                <span className="text-sm text-muted-foreground">
                  Supplier: {order.counterpartyName}
                </span>
              )}
            </div>

            {/* Stage Progress - Clickable Navigation */}
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
                const isClickable = canViewStage(stage.value)
                const isViewing = activeViewStage === stage.value
                const Icon = stage.icon

                return (
                  <button
                    key={stage.value}
                    type="button"
                    onClick={() => isClickable && setSelectedStageView(stage.value)}
                    disabled={!isClickable}
                    className={`flex flex-col items-center relative z-10 transition-all ${
                      isClickable ? 'cursor-pointer group' : 'cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isViewing ? 'ring-2 ring-offset-2 ring-emerald-400' : ''
                      } ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white group-hover:bg-emerald-600'
                          : isCurrent
                            ? 'bg-white border-emerald-500 text-emerald-600 group-hover:bg-emerald-50'
                            : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium transition-colors ${
                        isViewing
                          ? 'text-emerald-600'
                          : isCompleted || isCurrent
                            ? 'text-slate-900 group-hover:text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isViewing && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {nextStage && (
                <Button
                  onClick={() => setAdvanceModalOpen(true)}
                  disabled={transitioning}
                  className="gap-2"
                >
                  Advance to {nextStage.label}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {order.status === 'ISSUED' && (
                <Button
                  variant="outline"
                  onClick={() => handleTransition('DRAFT')}
                  disabled={transitioning}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Draft
                </Button>
              )}
              {order.status === 'ISSUED' && (
                <Button
                  variant="outline"
                  onClick={() => handleTransition('REJECTED')}
                  disabled={transitioning}
                  className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                >
                  <PackageX className="h-4 w-4" />
                  Mark Rejected
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

            {order.status === 'WAREHOUSE' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Shipping is handled via Fulfillment Orders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create a fulfillment order (FO) to ship inventory out of this warehouse.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/operations/fulfillment-orders/new" prefetch={false}>
                    Create Fulfillment Order
                  </Link>
                </Button>
              </div>
            )}
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

        {/* Rejected banner */}
        {order.status === 'REJECTED' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-slate-700">
              This PO was rejected by the supplier. Reopen it as a draft to revise and re-issue.
            </p>
            <Button
              variant="outline"
              onClick={() => handleTransition('DRAFT')}
              disabled={transitioning}
              className="gap-2"
            >
              <FileEdit className="h-4 w-4" />
              Reopen Draft
            </Button>
          </div>
        )}

        {/* Stage-Based Content View */}
        <div className="rounded-xl border bg-white shadow-sm">
          {/* Stage Content Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {activeViewStage === 'DRAFT' && 'Order Details'}
                  {activeViewStage === 'ISSUED' && 'Issued'}
                  {activeViewStage === 'MANUFACTURING' && 'Manufacturing Stage'}
                  {activeViewStage === 'OCEAN' && 'In Transit Stage'}
                  {activeViewStage === 'WAREHOUSE' && 'Warehouse Stage'}
                  {activeViewStage === 'SHIPPED' && 'Shipped'}
                  {activeViewStage === 'REJECTED' && 'Rejected'}
                </h3>
              <p className="text-xs text-muted-foreground">
                {isViewingCurrentStage ? 'Current stage' : 'Viewing past stage (read-only)'}
              </p>
            </div>
            {/* Inline edit controls for DRAFT stage */}
            {activeViewStage === 'DRAFT' && canEdit && (
              <div className="flex items-center gap-2">
                {isEditingDetails ? (
                  <>
                    <Button
                      size="sm"
                      onClick={handleSaveDetails}
                      disabled={detailsSaving}
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {detailsSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditDetails}
                      disabled={detailsSaving}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditDetails}
                    className="gap-1.5"
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stage Content Body */}
          <div className="p-6 space-y-6">
            {/* DRAFT Stage View */}
            {activeViewStage === 'DRAFT' && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">PO Number</label>
                    <Input value={order.poNumber || order.orderNumber} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Supplier</label>
                    <Input value={order.counterpartyName || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Destination Country
                    </label>
                    <Input value={tenantDestination || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Expected Date
                    </label>
                    {isEditingDetails ? (
                      <Input
                        type="date"
                        value={detailsDraft.expectedDate}
                        onChange={e =>
                          setDetailsDraft(d => ({ ...d, expectedDate: e.target.value }))
                        }
                        disabled={detailsSaving}
                      />
                    ) : (
                      <Input
                        value={order.expectedDate ? formatDateOnly(order.expectedDate) : '—'}
                        disabled
                        readOnly
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Incoterms</label>
                    {isEditingDetails ? (
                      <select
                        value={detailsDraft.incoterms}
                        onChange={e =>
                          setDetailsDraft(d => ({ ...d, incoterms: e.target.value }))
                        }
                        disabled={detailsSaving}
                        className="w-full h-10 px-3 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      >
                        <option value="">Select incoterms</option>
                        {INCOTERMS_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input value={order.incoterms || '—'} disabled readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Payment Terms
                    </label>
                    {isEditingDetails ? (
                      <Input
                        value={detailsDraft.paymentTerms}
                        onChange={e =>
                          setDetailsDraft(d => ({ ...d, paymentTerms: e.target.value }))
                        }
                        disabled={detailsSaving}
                        placeholder="e.g., 30% deposit, 70% before shipment"
                      />
                    ) : (
                      <Input value={order.paymentTerms || '—'} disabled readOnly />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <Input
                      value={`${formatDate(order.createdAt)}${order.createdByName ? ` by ${order.createdByName}` : ''}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  {isEditingDetails ? (
                    <Textarea
                      value={detailsDraft.notes}
                      onChange={e => setDetailsDraft(d => ({ ...d, notes: e.target.value }))}
                      rows={3}
                      disabled={detailsSaving}
                      placeholder="Add internal notes for the team"
                    />
                  ) : (
                    <div className="text-sm text-slate-700 bg-slate-50 rounded-md px-3 py-2 min-h-[60px]">
                      {order.notes || (
                        <span className="text-muted-foreground italic">No notes</span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ISSUED Stage View */}
            {activeViewStage === 'ISSUED' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-slate-700">
                    This PO has been issued to the supplier. Capture supplier confirmation (e.g. proforma invoice)
                    before advancing to manufacturing.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">PO Number</label>
                    <Input value={order.poNumber || order.orderNumber} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Supplier</label>
                    <Input value={order.counterpartyName || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Destination Country
                    </label>
                    <Input value={tenantDestination || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Expected Date</label>
                    <Input
                      value={order.expectedDate ? formatDateOnly(order.expectedDate) : '—'}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Incoterms</label>
                    <Input value={order.incoterms || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Payment Terms
                    </label>
                    <Input value={order.paymentTerms || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <Input
                      value={`${formatDate(order.createdAt)}${order.createdByName ? ` by ${order.createdByName}` : ''}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <div className="text-sm text-slate-700 bg-slate-50 rounded-md px-3 py-2 min-h-[60px]">
                    {order.notes || <span className="text-muted-foreground italic">No notes</span>}
                  </div>
                </div>
              </div>
            )}

            {/* REJECTED Stage View */}
            {activeViewStage === 'REJECTED' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm text-slate-700">
                    This PO was rejected by the supplier. Reopen as a draft to revise and re-issue.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">PO Number</label>
                    <Input value={order.poNumber || order.orderNumber} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Supplier</label>
                    <Input value={order.counterpartyName || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Destination Country
                    </label>
                    <Input value={tenantDestination || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Expected Date</label>
                    <Input
                      value={order.expectedDate ? formatDateOnly(order.expectedDate) : '—'}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Incoterms</label>
                    <Input value={order.incoterms || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Payment Terms
                    </label>
                    <Input value={order.paymentTerms || '—'} disabled readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <Input
                      value={`${formatDate(order.createdAt)}${order.createdByName ? ` by ${order.createdByName}` : ''}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <div className="text-sm text-slate-700 bg-slate-50 rounded-md px-3 py-2 min-h-[60px]">
                    {order.notes || <span className="text-muted-foreground italic">No notes</span>}
                  </div>
                </div>
              </div>
            )}

            {/* MANUFACTURING Stage View */}
            {activeViewStage === 'MANUFACTURING' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Proforma Invoice
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.manufacturing?.proformaInvoiceNumber || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Supplier
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.manufacturing?.factoryName || order.counterpartyName || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Manufacturing Start
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(
                        order.stageData.manufacturing?.manufacturingStartDate ||
                          order.stageData.manufacturing?.manufacturingStart
                      ) || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Expected Completion
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(order.stageData.manufacturing?.expectedCompletionDate) || '—'}
                    </p>
                  </div>
                </div>

                {/* Manufacturing Documents */}
                {renderStageDocuments('MANUFACTURING')}
              </div>
            )}

            {/* OCEAN Stage View */}
            {activeViewStage === 'OCEAN' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      House B/L
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.ocean?.houseBillOfLading || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Master B/L
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.ocean?.masterBillOfLading || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Commercial Invoice
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.ocean?.commercialInvoiceNumber || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Vessel
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.ocean?.vesselName || '—'}
                      {order.stageData.ocean?.voyageNumber
                        ? ` (${order.stageData.ocean.voyageNumber})`
                        : ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Route
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.ocean?.portOfLoading &&
                      order.stageData.ocean?.portOfDischarge
                        ? `${order.stageData.ocean.portOfLoading} → ${order.stageData.ocean.portOfDischarge}`
                        : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ETA
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(order.stageData.ocean?.estimatedArrival) || '—'}
                    </p>
                  </div>
                </div>

                {/* Ocean Documents */}
                {renderStageDocuments('OCEAN')}
              </div>
            )}

            {/* WAREHOUSE Stage View */}
            {activeViewStage === 'WAREHOUSE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Warehouse
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.warehouse?.warehouseName || order.warehouseName || '—'}
                      {order.stageData.warehouse?.warehouseCode || order.warehouseCode
                        ? ` (${order.stageData.warehouse?.warehouseCode || order.warehouseCode})`
                        : ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Customs Entry
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.warehouse?.customsEntryNumber || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Customs Cleared
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(order.stageData.warehouse?.customsClearedDate) || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Received Date
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(order.stageData.warehouse?.receivedDate) || '—'}
                    </p>
                  </div>
                  {order.stageData.warehouse?.dutyAmount != null && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Duty
                      </label>
                      <p className="text-sm font-medium text-slate-900">
                        {order.stageData.warehouse.dutyCurrency || ''}{' '}
                        {order.stageData.warehouse.dutyAmount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Warehouse Documents */}
                {renderStageDocuments('WAREHOUSE')}
              </div>
            )}

            {/* SHIPPED Stage View */}
            {activeViewStage === 'SHIPPED' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Ship To
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.shipped?.shipToName || '—'}
                    </p>
                    {order.stageData.shipped?.shipToAddress && (
                      <p className="text-xs text-muted-foreground">
                        {order.stageData.shipped.shipToAddress}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Carrier
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.shipped?.shippingCarrier || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Tracking
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {order.stageData.shipped?.trackingNumber || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Shipped Date
                    </label>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateOnly(
                        order.stageData.shipped?.shippedDate || order.stageData.shipped?.shippedAt
                      ) || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cargo Section - Always Visible */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-foreground">Cargo</h3>
              <Badge variant="outline" className="text-xs">
                {order.lines.length} items
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              Total: {totalQuantity.toLocaleString()} units
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">SKU</th>
                  <th className="px-4 py-2 text-left font-semibold">Description</th>
                  <th className="px-4 py-2 text-left font-semibold">Batch / Lot</th>
                  <th className="px-4 py-2 text-right font-semibold">Ordered</th>
                  <th className="px-4 py-2 text-right font-semibold">Received</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
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
                    <tr key={line.id} className="border-t hover:bg-muted/10">
                      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                        {line.skuCode}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                        {line.skuDescription || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {line.batchLot || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                        {line.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                        {(line.quantityReceived ?? line.postedQuantity).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant="outline">{line.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collapsible Approval History */}
        {order.approvalHistory && order.approvalHistory.length > 0 && (
          <div className="rounded-xl border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowApprovalHistory(!showApprovalHistory)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Approval History</h3>
                <Badge variant="outline" className="text-xs">
                  {order.approvalHistory.length}
                </Badge>
              </div>
              {showApprovalHistory ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showApprovalHistory && (
              <div className="border-t px-6 py-4 space-y-2">
                {order.approvalHistory.map((approval, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-3 bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{approval.stage}</p>
                        <p className="text-xs text-muted-foreground">
                          by {approval.approvedBy || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {approval.approvedAt ? formatDate(approval.approvedAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advance Stage Modal */}
      {advanceModalOpen && nextStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !transitioning && setAdvanceModalOpen(false)}
          />
          {/* Modal */}
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Advance to {nextStage.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {STAGES[currentStageIndex]?.label ?? formatStatusLabel(order.status)} →{' '}
                  {nextStage.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !transitioning && setAdvanceModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                disabled={transitioning}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">{renderStageTransitionForm()}</div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <Button
                variant="outline"
                onClick={() => setAdvanceModalOpen(false)}
                disabled={transitioning}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const success = await executeTransition(nextStage.value as POStageStatus)
                  if (success) {
                    setAdvanceModalOpen(false)
                  }
                }}
                disabled={
                  transitioning ||
                  documentsLoading ||
                  !nextStageDocsComplete ||
                  (nextStage.value === 'ISSUED' &&
                    (!order.expectedDate || !order.incoterms || !order.paymentTerms))
                }
                className="gap-2"
              >
                {transitioning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Advancing...
                  </>
                ) : (
                  <>
                    Advance to {nextStage.label}
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        onConfirm={handleConfirmDialogConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type ? 'danger' : 'info'}
        confirmText={
          confirmDialog.type === 'cancel'
            ? 'Cancel Order'
            : confirmDialog.type === 'reject'
              ? 'Mark Rejected'
              : 'Confirm'
        }
        cancelText="Go Back"
      />
    </DashboardLayout>
  )
}
