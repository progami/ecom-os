'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { toast } from 'react-hot-toast'
import { Upload, FileText, X, Check } from '@/lib/lucide-icons'
import { Button } from '@/components/ui/button'

type TransactionType = 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'

type AttachmentData = {
  fileName: string
  uploadedAt: string
  uploadedBy: string
  s3Key: string
  s3Url?: string
  size: number
  contentType: string
}

type AttachmentsRecord = Record<string, AttachmentData>

type AttachmentCategory = {
  id: string
  label: string
  description: string
  required: boolean
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  movement_note: ['movement_note', 'movementNote', 'delivery_note', 'deliveryNote'],
  adjustment_evidence: [
    'adjustment_evidence',
    'adjustmentEvidence',
    'proof_of_pickup',
    'proofOfPickup',
  ],
}

const RECEIVE_CATEGORIES: AttachmentCategory[] = [
  {
    id: 'commercial_invoice',
    label: 'Commercial Invoice',
    description: 'Invoice with pricing',
    required: true,
  },
  {
    id: 'bill_of_lading',
    label: 'Bill of Lading',
    description: 'Carrier document',
    required: true,
  },
  {
    id: 'packing_list',
    label: 'Packing List',
    description: 'Items & quantities',
    required: true,
  },
  {
    id: 'movement_note',
    label: 'Movement Note',
    description: 'Warehouse receipt / movement proof',
    required: true,
  },
  {
    id: 'cube_master',
    label: 'Cube Master',
    description: 'Pallet stacking config',
    required: true,
  },
  {
    id: 'transaction_certificate',
    label: 'Transaction Certificate',
    description: 'TC / compliance certificate',
    required: true,
  },
  {
    id: 'custom_declaration',
    label: 'Custom Declaration',
    description: 'Customs clearance',
    required: true,
  },
]

const SHIP_CATEGORIES: AttachmentCategory[] = [
  {
    id: 'packing_list',
    label: 'Packing List',
    description: 'Items & quantities for shipment',
    required: true,
  },
  {
    id: 'movement_note',
    label: 'Movement Note',
    description: 'Shipping documentation',
    required: true,
  },
]

const ADJUSTMENT_CATEGORIES: AttachmentCategory[] = [
  {
    id: 'adjustment_evidence',
    label: 'Adjustment Evidence',
    description: 'Stocktake, Amazon/FBA receipt, damage report, etc.',
    required: true,
  },
]

const CATEGORIES_BY_TYPE: Record<TransactionType, AttachmentCategory[]> = {
  RECEIVE: RECEIVE_CATEGORIES,
  SHIP: SHIP_CATEGORIES,
  ADJUST_IN: ADJUSTMENT_CATEGORIES,
  ADJUST_OUT: ADJUSTMENT_CATEGORIES,
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TransactionAttachmentsTab({
  transactionId,
  transactionType,
}: {
  transactionId: string
  transactionType: TransactionType
}) {
  const [attachments, setAttachments] = useState<AttachmentsRecord>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  const categories = useMemo(() => CATEGORIES_BY_TYPE[transactionType] ?? [], [transactionType])

  const resolveAttachment = (categoryId: string) => {
    const baseCandidates = [categoryId, toCamelCase(categoryId)]
    const synonyms = CATEGORY_SYNONYMS[categoryId] ?? []
    const candidates = Array.from(
      new Set(
        [...baseCandidates, ...synonyms].flatMap(value => [value, toCamelCase(value)])
      )
    )

    for (const key of candidates) {
      const attachment = attachments[key]
      if (attachment?.s3Key) {
        return { key, attachment }
      }
    }

    return null
  }

  const allRequiredPresent = categories
    .filter(category => category.required)
    .every(category => Boolean(resolveAttachment(category.id)?.attachment?.s3Key))

  const loadAttachments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/transactions/${transactionId}/attachments`, {
        credentials: 'include',
      })
      const payload = await response.json().catch(() => null)
      const record = payload?.attachments
      setAttachments(
        record && typeof record === 'object' && !Array.isArray(record)
          ? (record as AttachmentsRecord)
          : {}
      )
    } catch {
      setAttachments({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAttachments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    categoryId: string,
    existingKey?: string
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name} is too large. Maximum size is 5MB.`)
      event.target.value = ''
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`${file.name}: Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX`)
      event.target.value = ''
      return
    }

    try {
      setUploading(prev => ({ ...prev, [categoryId]: true }))
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', categoryId)

      const response = await fetch(`/api/transactions/${transactionId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Upload failed')
        return
      }

      if (existingKey && existingKey !== categoryId) {
        await fetch(
          `/api/transactions/${transactionId}/attachments?category=${encodeURIComponent(existingKey)}`,
          { method: 'DELETE', credentials: 'include' }
        ).catch(() => null)
      }

      toast.success('Document uploaded')
      await loadAttachments()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(prev => ({ ...prev, [categoryId]: false }))
      event.target.value = ''
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (deleting[categoryId]) return

    try {
      setDeleting(prev => ({ ...prev, [categoryId]: true }))
      const response = await fetch(
        `/api/transactions/${transactionId}/attachments?category=${encodeURIComponent(categoryId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error ?? 'Delete failed')
        return
      }

      toast.success('Document deleted')
      await loadAttachments()
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(prev => ({ ...prev, [categoryId]: false }))
    }
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No document requirements defined.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          Required Documents
        </div>
        <div className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : allRequiredPresent ? 'All required documents uploaded' : 'Missing required documents'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {categories.map(category => {
          const resolved = resolveAttachment(category.id)
          const attachmentKey = resolved?.key
          const attachment = resolved?.attachment
          const isUploading = Boolean(uploading[category.id])
          const isDeleting = attachmentKey ? Boolean(deleting[attachmentKey]) : false
          const uploaded = Boolean(attachment?.s3Key)

          return (
            <div key={category.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {uploaded ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <X className="h-4 w-4 text-slate-400" />
                    )}
                    <h4 className="text-sm font-semibold text-foreground">{category.label}</h4>
                    {category.required ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                        required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>

                  {uploaded ? (
                    <div className="mt-2 space-y-1">
                      <a
                        href={attachment.s3Url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                        title={attachment.fileName}
                      >
                        {attachment.fileName}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} • {attachment.contentType}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Not uploaded yet</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {uploaded ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      className="hidden"
                      disabled={isUploading || isDeleting}
                      onChange={e => void handleUpload(e, category.id, attachmentKey)}
                    />
                  </label>
                  {uploaded ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isDeleting || isUploading}
                      onClick={() => (attachmentKey ? void handleDelete(attachmentKey) : undefined)}
                    >
                      {isDeleting ? '…' : 'Delete'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
