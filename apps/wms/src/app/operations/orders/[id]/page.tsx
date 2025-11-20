'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { ATTACHMENT_CATEGORIES } from '@/components/operations/receive-attachments-tab'
import { FileText, ArrowLeft, Loader2, Package2, Truck, Paperclip, Check, ChevronRight } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'

interface PurchaseOrderLineSummary {
 id: string
 skuCode: string
 skuDescription: string | null
 batchLot: string | null
 quantity: number
 unitCost: number | null
 status: 'PENDING' | 'POSTED' | 'CANCELLED'
 postedQuantity: number
 createdAt: string
 updatedAt: string
}

interface PurchaseOrderSummary {
 id: string
 orderNumber: string
 type: 'PURCHASE' | 'FULFILLMENT' | 'ADJUSTMENT'
 status: 'DRAFT' | 'AWAITING_PROOF' | 'REVIEW' | 'POSTED' | 'CANCELLED' | 'CLOSED'
 warehouseCode: string
 warehouseName: string
 counterpartyName: string | null
 expectedDate: string | null
 postedAt: string | null
 createdAt: string
 updatedAt: string
 notes?: string | null
 lines: PurchaseOrderLineSummary[]
}

interface MovementNoteLineSummary {
 id: string
 skuCode?: string | null
 batchLot: string | null
 quantity: number
 varianceQuantity: number
 attachments?: Record<string, unknown> | null
}

interface MovementNoteSummary {
 id: string
 referenceNumber: string | null
 status: 'DRAFT' | 'POSTED' | 'CANCELLED' | 'RECONCILED'
 receivedAt: string
 warehouseCode: string
 warehouseName: string
 lines: MovementNoteLineSummary[]
 attachments?: Record<string, unknown> | null
}

function statusBadgeClasses(status: PurchaseOrderSummary['status']) {
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

function formatStatusLabel(status: PurchaseOrderSummary['status']) {
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

function typeBadgeClasses(type: PurchaseOrderSummary['type']) {
 switch (type) {
 case 'PURCHASE':
 return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
 case 'FULFILLMENT':
 return 'bg-red-50 text-red-700 border border-red-200'
 default:
 return 'bg-muted text-muted-foreground border border-muted'
 }
}

function formatDate(value: string | null) {
 if (!value) return '—'
 const parsed = new Date(value)
 if (Number.isNaN(parsed.getTime())) return '—'
 return parsed.toLocaleString()
}

export default function PurchaseOrderDetailPage() {
 const params = useParams()
 const router = useRouter()
 const { data: session, status } = useSession()
 const [loading, setLoading] = useState(true)
 const [actionLoading, setActionLoading] = useState(false)
 const [order, setOrder] = useState<PurchaseOrderSummary | null>(null)
 const [movementNotes, setMovementNotes] = useState<MovementNoteSummary[]>([])
 const [linkedLoading, setLinkedLoading] = useState(false)
 const [statusUpdating, setStatusUpdating] = useState(false)
 const [detailsSaving, setDetailsSaving] = useState(false)
 const [isEditingDetails, setIsEditingDetails] = useState(false)
 const [detailsDraft, setDetailsDraft] = useState({
 counterpartyName: '',
 expectedDate: '',
 notes: '',
 })

 const attachmentSummary = useMemo(() => {
 const map: Record<string, Array<{ name: string; size: number; source: string; viewUrl?: string }>> = {}

 const append = (
 category: string,
 item: { name: string; size: number; source: string; viewUrl?: string }
 ) => {
 if (!map[category]) {
 map[category] = []
 }
 map[category].push(item)
 }

 const toItems = (
 category: string,
 value: unknown,
 source: string
 ): Array<{ name: string; size: number; source: string; viewUrl?: string }> => {
 if (!value) return []

 const normalise = (record: Record<string, unknown>) => {
 const name = typeof record.fileName === 'string'
 ? record.fileName
 : typeof record.name === 'string'
 ? record.name
 : `${category.replace(/_/g, ' ')} document`
 const size = typeof record.size === 'number' ? record.size : 0
 const viewUrl = typeof record.s3Url === 'string'
 ? record.s3Url
 : typeof record.viewUrl === 'string'
 ? record.viewUrl
 : undefined

 return { name, size, source, viewUrl }
 }

 if (Array.isArray(value)) {
 return value
 .filter(item => typeof item === 'object' && item !== null)
 .map(item => normalise(item as Record<string, unknown>))
 }

 if (typeof value === 'object' && value !== null) {
 return [normalise(value as Record<string, unknown>)]
 }

 return []
 }

 movementNotes.forEach(note => {
 const sourceLabel = note.referenceNumber || `Delivery Note ${note.id.slice(0, 8)}`

 if (note.attachments && typeof note.attachments === 'object' && !Array.isArray(note.attachments)) {
 Object.entries(note.attachments).forEach(([category, value]) => {
 toItems(category, value, sourceLabel).forEach(item => append(category, item))
 })
 }

 note.lines.forEach((line, index) => {
 const skuSuffix = line.skuCode ? ` (${line.skuCode})` : ''
 const lineSource = `${sourceLabel} · Line ${index + 1}${skuSuffix}`
 if (line.attachments && typeof line.attachments === 'object' && !Array.isArray(line.attachments)) {
 Object.entries(line.attachments).forEach(([category, value]) => {
 toItems(category, value, lineSource).forEach(item => append(category, item))
 })
 }
 })
 })

 return map
 }, [movementNotes])

 const totalAttachments = useMemo(
 () => Object.values(attachmentSummary).reduce((sum, items) => sum + items.length, 0),
 [attachmentSummary]
 )

 const knownAttachmentCategories = useMemo(
 () => new Set(ATTACHMENT_CATEGORIES.map(category => category.id)),
 []
 )

 const additionalAttachmentCategories = useMemo(
 () =>
 Object.keys(attachmentSummary).filter(category => !knownAttachmentCategories.has(category)),
 [attachmentSummary, knownAttachmentCategories]
 )

 const attachmentCategoriesOrdered = useMemo(() => {
 const priority = ['movement_note']
 return [...ATTACHMENT_CATEGORIES].sort((a, b) => {
 const aIdx = priority.includes(a.id) ? priority.indexOf(a.id) : priority.length
 const bIdx = priority.includes(b.id) ? priority.indexOf(b.id) : priority.length
 if (aIdx === bIdx) return a.label.localeCompare(b.label)
 return aIdx - bIdx
 })
 }, [])

 useEffect(() => {
 if (status === 'loading') return
  if (!session) {
    redirectToPortal('/login', `${window.location.origin}/operations/orders/${params.id}`)
 return
 }
 if (!['staff', 'admin'].includes(session.user.role)) {
 router.push('/dashboard')
 return
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
    router.push('/operations/orders')
 } finally {
 setLoading(false)
 }
 }

 loadOrder()
 }, [params.id, router, session, status])

 useEffect(() => {
 if (!order) return

 const fetchLinked = async () => {
 try {
 setLinkedLoading(true)

    const notesRes = await fetch(`/api/movement-notes?purchaseOrderId=${order.id}`)

    if (notesRes.ok) {
      const data = await notesRes.json()
      const normalizedNotes: MovementNoteSummary[] = Array.isArray(data?.data)
        ? data.data.map((note: MovementNoteSummary) => ({
            ...note,
            attachments: note.attachments ?? null,
            lines: Array.isArray(note.lines)
              ? note.lines.map(line => ({
                  ...line,
                  skuCode: line.skuCode ?? null,
                  quantity: Number(line.quantity ?? 0),
                  varianceQuantity: Number(line.varianceQuantity ?? 0),
                  attachments: line.attachments ?? null,
                }))
              : [],
          }))
        : []
      setMovementNotes(normalizedNotes)
    }
 } catch (_error) {
 // ignore individual fetch errors; main order fetch already surfaced issues
 } finally {
 setLinkedLoading(false)
 }
 }

 fetchLinked()
 }, [order])

 useEffect(() => {
 if (!order || isEditingDetails) return

 setDetailsDraft({
 counterpartyName: order.counterpartyName ?? '',
 expectedDate: order.expectedDate ? order.expectedDate.slice(0, 10) : '',
 notes: order.notes ?? '',
 })
 }, [order, isEditingDetails])

 const handleVoid = async () => {
 if (!order || order.status === 'CANCELLED') return
 try {
 setActionLoading(true)
 const response = await fetch(`/api/purchase-orders/${order.id}/void`, {
 method: 'POST',
 })
 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 toast.error(payload?.error ?? 'Failed to void purchase order')
 return
 }
 const updated = await response.json()
 toast.success('Purchase order voided')
 setOrder(updated)
 } catch (_error) {
 toast.error('Failed to void purchase order')
 } finally {
 setActionLoading(false)
 }
 }

 const updateStatus = async (nextStatus: PurchaseOrderSummary['status']) => {
 if (!order || statusUpdating || detailsSaving) return
 if (nextStatus === order.status) return

 const allowed = ['DRAFT', 'AWAITING_PROOF', 'REVIEW', 'POSTED'] as const
 if (!allowed.includes(nextStatus as typeof allowed[number])) {
 toast.error('Unsupported status change')
 return
 }

 if (nextStatus === 'POSTED') {
 const confirmed = window.confirm('Approve and post this purchase order? This will lock the workflow state.')
 if (!confirmed) {
 return
 }
 }

 try {
 setStatusUpdating(true)
 const response = await fetch(`/api/purchase-orders/${order.id}/status`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status: nextStatus }),
 })

 if (!response.ok) {
 const payload = await response.json().catch(() => null)
 toast.error(payload?.error ?? 'Failed to update status')
 return
 }

 const updated = await response.json()
 setOrder(updated)
 toast.success(
 nextStatus === 'POSTED'
 ? 'Purchase order posted'
 : nextStatus === 'AWAITING_PROOF'
 ? 'Purchase order marked as awaiting proof'
 : 'Purchase order returned to draft'
 )
 } catch (_error) {
 toast.error('Failed to update status')
 } finally {
 setStatusUpdating(false)
 }
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
 const response = await fetch(`/api/purchase-orders/${order.id}`, {
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
 <span>Loading purchase order…</span>
 </div>
 </div>
 </DashboardLayout>
 )
 }

 if (!order) {
 return null
 }

 const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0)
 const isInbound = order.type === 'PURCHASE'
 const workflowLabel = isInbound ? 'Receive' : order.type === 'FULFILLMENT' ? 'Ship' : 'Adjustment'
 const statusHelper = statusUpdating
 ? 'Updating status…'
 : detailsSaving
 ? 'Saving purchase order changes…'
 : order.status === 'DRAFT'
 ? 'Prepare the order and submit for proof once documents are ready.'
 : order.status === 'AWAITING_PROOF'
 ? 'We are waiting on a delivery note or supporting documents.'
 : order.status === 'REVIEW'
 ? 'Documents are in. Complete the review and decide to post or send back.'
 : order.status === 'POSTED'
 ? 'Order posted to the ledger. No further changes allowed.'
 : order.status === 'CANCELLED'
 ? 'This purchase order was cancelled early in the workflow.'
 : order.status === 'CLOSED'
 ? 'This purchase order is closed and archived.'
 : 'Review the current status for next steps.'
 const statusSteps = [
 { value: 'DRAFT', label: 'Draft' },
 { value: 'AWAITING_PROOF', label: isInbound ? 'Awaiting Proof (Inbound)' : 'Awaiting Proof' },
 { value: 'REVIEW', label: 'Review' },
 { value: 'POSTED', label: 'Posted' },
 ] as const
 const rawStatusIndex = statusSteps.findIndex(step => step.value === order.status)
 const activeStatusIndex = rawStatusIndex === -1 ? 0 : rawStatusIndex
 const showMovementTab = movementNotes.length > 0
 const canEditDetails = ['DRAFT', 'AWAITING_PROOF', 'REVIEW', 'POSTED'].includes(order.status)
 const actionBusy = statusUpdating || detailsSaving
 const tabConfig = [
 { id: 'details', label: isInbound ? 'Receipt Details' : 'Shipment Details', icon: <FileText className="h-4 w-4" /> },
 { id: 'cargo', label: `Cargo (${order.lines.length})`, icon: <Package2 className="h-4 w-4" /> },
 { id: 'attachments', label: `Attachments (${totalAttachments})`, icon: <Paperclip className="h-4 w-4" /> },
    ...(showMovementTab
      ? [{ id: 'movement', label: `Movement Notes (${movementNotes.length})`, icon: <FileText className="h-4 w-4" /> }]
      : []),
 ]

 const formatFileSize = (bytes: number) => {
 if (!bytes) return '—'
 if (bytes < 1024) return `${bytes} B`
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
 }
 const headerTitle = isInbound ? 'Inbound Purchase Order' : 'Outbound Purchase Order'
 const headerAccent = isInbound ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-cyan-600 bg-cyan-50 border-cyan-200'

 const breadcrumbItems = [
 { label: 'Operations', href: '/operations' },
 { label: 'Orders', href: '/operations/orders' },
 { label: `PO ${order.orderNumber}` },
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

 return (
 <DashboardLayout hideBreadcrumb customBreadcrumb={breadcrumbContent}>
 <div className="flex h-full min-h-0 flex-col space-y-6 overflow-y-auto pr-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <span className={`flex h-12 w-12 items-center justify-center rounded-full border ${headerAccent}`}>
 {isInbound ? <Package2 className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
 </span>
 <div>
 <h1 className="text-2xl font-semibold text-foreground">{headerTitle}</h1>
 <p className="text-sm text-muted-foreground">Purchase Order {order.orderNumber}</p>
 </div>
 </div>
 <div className="flex flex-col gap-3 sm:items-end">
 <div className="flex flex-wrap items-center gap-2">
 <Badge className={statusBadgeClasses(order.status)}>{formatStatusLabel(order.status)}</Badge>
 <Badge className={typeBadgeClasses(order.type)}>{workflowLabel}</Badge>
 </div>

 <div className="flex flex-col gap-3">
 <div className="flex flex-wrap items-center gap-4">
 {statusSteps.map((step, index) => {
 const isCompleted = index < activeStatusIndex
 const isActiveStep = index === activeStatusIndex
 return (
 <div key={step.value} className="flex items-center gap-2">
 <div className={`flex items-center gap-2 text-xs font-medium ${isCompleted || isActiveStep ? 'text-foreground' : 'text-muted-foreground'}`}>
 <span className={`h-2.5 w-2.5 rounded-full ${isCompleted || isActiveStep ? 'bg-primary' : 'bg-border'}`} />
 <span>{step.label}</span>
 </div>
 {index < statusSteps.length - 1 && (
 <span className="hidden h-px w-8 bg-border sm:block" />
 )}
 </div>
 )
 })}
 </div>
 <p className="text-xs text-muted-foreground max-w-sm">{statusHelper}</p>
 <div className="flex flex-wrap items-center gap-2">
 {order.status === 'DRAFT' && (
 <>
 <Button
 onClick={() => updateStatus('AWAITING_PROOF')}
 disabled={actionBusy}
 className="gap-2"
 >
 {statusUpdating ? 'Moving…' : 'Submit for Proof'}
 </Button>
 </>
 )}
 {order.status === 'AWAITING_PROOF' && (
 <>
 <Button
 onClick={() => updateStatus('REVIEW')}
 disabled={actionBusy}
 className="gap-2"
 >
 {statusUpdating ? 'Advancing…' : 'Mark Ready for Review'}
 </Button>
 <Button
 variant="outline"
 onClick={() => updateStatus('DRAFT')}
 disabled={actionBusy}
 >
 Return to Draft
 </Button>
 </>
 )}
 {order.status === 'REVIEW' && (
 <>
 <Button
 onClick={() => updateStatus('POSTED')}
 disabled={actionBusy}
 className="gap-2"
 >
 {statusUpdating ? 'Posting…' : 'Approve & Post'}
 </Button>
 <Button
 variant="outline"
 onClick={() => updateStatus('AWAITING_PROOF')}
 disabled={actionBusy}
 >
 Return to Proof
 </Button>
 </>
 )}
 {order.status !== 'POSTED' && order.status !== 'CANCELLED' && (
 <Button variant="destructive" onClick={handleVoid} disabled={actionBusy || actionLoading}>
 {actionLoading ? 'Working…' : 'Void PO'}
 </Button>
 )}
 {canEditDetails && (
 isEditingDetails ? (
 <>
 <Button size="sm" onClick={handleSaveDetails} disabled={detailsSaving}>
 {detailsSaving ? 'Saving…' : 'Save details'}
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
 <Button size="sm" variant="outline" onClick={handleEditDetails} disabled={actionBusy}>
 Edit details
 </Button>
 )
 )}
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-xl border bg-white p-4 shadow-soft">
 <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
 <span>Expected: {formatDate(order.expectedDate)} • Posted: {formatDate(order.postedAt)}</span>
 <span>Created: {formatDate(order.createdAt)} • Updated: {formatDate(order.updatedAt)}</span>
 </div>
 </div>

 <TabbedContainer tabs={tabConfig} defaultTab="details">
 <TabPanel>
 <div className="space-y-6">
 <div>
 <h3 className="text-sm font-semibold text-foreground">Order metadata</h3>
 <p className="text-xs text-muted-foreground">
 Keep reference details up to date for the warehouse team.
 {isEditingDetails && ' Editing mode enabled—remember to save or cancel above.'}
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <label className="text-sm font-medium text-muted-foreground">Order Number</label>
 <Input value={order.orderNumber} disabled readOnly />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-muted-foreground">Workflow</label>
 <Input value={workflowLabel} disabled readOnly />
 </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Warehouse</label>
            <Input value={order.warehouseCode} disabled readOnly />
          </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-muted-foreground">Counterparty</label>
 {isEditingDetails ? (
 <Input
 value={detailsDraft.counterpartyName}
 placeholder="Enter counterparty name"
 onChange={event =>
 setDetailsDraft(draft => ({ ...draft, counterpartyName: event.target.value }))
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
 onChange={event =>
 setDetailsDraft(draft => ({ ...draft, expectedDate: event.target.value }))
 }
 disabled={detailsSaving}
 />
 ) : (
 <Input value={formatDate(order.expectedDate)} disabled readOnly />
 )}
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium text-muted-foreground">Posted At</label>
 <Input value={formatDate(order.postedAt)} disabled readOnly />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-sm font-medium text-muted-foreground">Notes</label>
 {isEditingDetails ? (
 <Textarea
 value={detailsDraft.notes}
 onChange={event =>
 setDetailsDraft(draft => ({ ...draft, notes: event.target.value }))
 }
 rows={4}
 disabled={detailsSaving}
 placeholder="Add internal notes for the team"
 />
 ) : (
 <Textarea value={order.notes || ''} disabled readOnly rows={4} placeholder="No internal notes yet." />
 )}
 </div>
 </div>
 </TabPanel>

 <TabPanel>
 <div className="space-y-4">
 <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
 <span>{order.lines.length} line{order.lines.length === 1 ? '' : 's'}</span>
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
 <th className="px-3 py-2 text-right font-semibold">Posted</th>
 <th className="px-3 py-2 text-left font-semibold">Status</th>
 </tr>
 </thead>
 <tbody>
 {order.lines.map(line => (
 <tr key={line.id} className="odd:bg-muted/20">
 <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{line.skuCode}</td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{line.skuDescription || '—'}</td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{line.batchLot || '—'}</td>
 <td className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">{line.quantity.toLocaleString()}</td>
 <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{line.postedQuantity.toLocaleString()}</td>
 <td className="px-3 py-2 whitespace-nowrap">
 <Badge variant="outline">{line.status}</Badge>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </TabPanel>

 <TabPanel>
 <div className="space-y-6">
 {attachmentCategoriesOrdered.map(category => {
 const items = attachmentSummary[category.id] ?? []
 return (
 <div key={category.id} className="rounded-xl border bg-white p-4">
 <div className="flex items-start justify-between gap-3">
 <div>
 <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
 {category.label}
 {category.id === 'movement_note' && (
 <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
 Proof
 </span>
 )}
 {items.length > 0 && <Check className="h-4 w-4 text-emerald-600" />}
 </h3>
 <p className="text-xs text-muted-foreground">
 {category.description}
 {category.id === 'movement_note' && ' · Delivery note acts as proof for posting'}
 </p>
 </div>
 <Badge variant={items.length > 0 ? 'default' : 'outline'}>
 {items.length > 0 ? `${items.length} file${items.length === 1 ? '' : 's'}` : 'No files'}
 </Badge>
 </div>

 <div className="mt-4 space-y-3">
 {items.length === 0 ? (
 <p className="text-xs text-muted-foreground">
 No {category.label.toLowerCase()} uploaded yet. Add it from the {isInbound ? 'receive' : 'ship'} workflow when completing this purchase order.
 </p>
 ) : (
 items.map(item => (
 <div key={`${category.id}-${item.name}-${item.source}`} className="rounded border bg-slate-50 p-3">
 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <p className="text-sm font-medium text-foreground">{item.name}</p>
 <p className="text-xs text-muted-foreground">
 {formatFileSize(item.size)} • {item.source}
 </p>
 </div>
 {item.viewUrl && (
 <Button asChild size="sm" variant="secondary">
 <a href={item.viewUrl} target="_blank" rel="noopener noreferrer">
 View document
 </a>
 </Button>
 )}
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 )
 })}

 {additionalAttachmentCategories.length > 0 && (
 <div className="rounded-xl border bg-white p-4 space-y-3">
 <h3 className="text-sm font-semibold text-foreground">Additional Documents</h3>
 {additionalAttachmentCategories.map(category => (
 <div key={category} className="rounded border bg-slate-50 p-3 space-y-2">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-medium text-foreground">{category}</p>
 <p className="text-xs text-muted-foreground">Uploaded via linked workflows</p>
 </div>
 <Badge variant="default">{attachmentSummary[category].length}</Badge>
 </div>
 {attachmentSummary[category].map(item => (
 <div key={`${category}-${item.name}-${item.source}`} className="rounded border bg-white p-2">
 <p className="text-sm text-foreground">{item.name}</p>
 <p className="text-xs text-muted-foreground">{formatFileSize(item.size)} • {item.source}</p>
 {item.viewUrl && (
 <a
 href={item.viewUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs text-primary hover:underline"
 >
 View document
 </a>
 )}
 </div>
 ))}
 </div>
 ))}
 </div>
 )}

 {totalAttachments === 0 && (
 <p className="text-sm text-muted-foreground">
 No supporting documents yet. Upload proofs and delivery notes from the {isInbound ? 'receive' : 'ship'} workflow to keep this purchase order moving.
 </p>
 )}
 </div>
 </TabPanel>

 {showMovementTab && (
 <TabPanel>
 <div className="space-y-4">
 <div className="flex items-center justify-between text-sm text-muted-foreground">
 <span>Movement notes linked to this order</span>
 <span>{linkedLoading ? 'Refreshing…' : `${movementNotes.length} note${movementNotes.length === 1 ? '' : 's'}`}</span>
 </div>
 <div className="overflow-x-auto rounded-xl border">
 <table className="min-w-full table-auto text-sm">
 <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
 <tr>
 <th className="px-3 py-2 text-left font-semibold">Movement Note</th>
 <th className="px-3 py-2 text-left font-semibold">Status</th>
 <th className="px-3 py-2 text-left font-semibold">Received At</th>
 <th className="px-3 py-2 text-right font-semibold">Quantity</th>
 <th className="px-3 py-2 text-right font-semibold">Variance</th>
 <th className="px-3 py-2 text-left font-semibold">Actions</th>
 </tr>
 </thead>
 <tbody>
 {movementNotes.map(note => {
 const totalQty = note.lines.reduce((sum, line) => sum + line.quantity, 0)
 const variance = note.lines.reduce((sum, line) => sum + line.varianceQuantity, 0)
 return (
 <tr key={note.id} className="odd:bg-muted/20">
 <td className="px-3 py-2 whitespace-nowrap font-medium text-foreground">
 {note.referenceNumber || note.id.slice(0, 8)}
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 <Badge variant="outline">{note.status}</Badge>
 </td>
 <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(note.receivedAt)}</td>
 <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{totalQty.toLocaleString()}</td>
 <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{variance.toLocaleString()}</td>
 <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">—</td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 </div>
 </TabPanel>
 )}

 </TabbedContainer>
 </div>
 </DashboardLayout>
 )
}
