'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Boxes, Edit2, Loader2, Plus, RefreshCw } from '@/lib/lucide-icons'

interface SkuOption {
  id: string
  skuCode: string
  description: string
  isActive: boolean
}

interface BatchRow {
  id: string
  batchCode: string
  description: string | null
  productionDate: string | null
  expiryDate: string | null
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface BatchFormState {
  batchCode: string
  description: string
  productionDate: string
  expiryDate: string
  storageCartonsPerPallet: string
  shippingCartonsPerPallet: string
  isActive: boolean
}

function buildBatchFormState(batch?: BatchRow | null): BatchFormState {
  return {
    batchCode: batch?.batchCode ?? '',
    description: batch?.description ?? '',
    productionDate: batch?.productionDate ? batch.productionDate.slice(0, 10) : '',
    expiryDate: batch?.expiryDate ? batch.expiryDate.slice(0, 10) : '',
    storageCartonsPerPallet: batch?.storageCartonsPerPallet?.toString() ?? '',
    shippingCartonsPerPallet: batch?.shippingCartonsPerPallet?.toString() ?? '',
    isActive: batch?.isActive ?? true,
  }
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export default function BatchesPanel() {
  const [skus, setSkus] = useState<SkuOption[]>([])
  const [skusLoading, setSkusLoading] = useState(false)
  const [selectedSkuId, setSelectedSkuId] = useState<string>('')
  const [includeInactiveBatches, setIncludeInactiveBatches] = useState(false)

  const [batches, setBatches] = useState<BatchRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [batchSearch, setBatchSearch] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchRow | null>(null)
  const [formState, setFormState] = useState<BatchFormState>(() => buildBatchFormState())

  const [confirmDeactivate, setConfirmDeactivate] = useState<BatchRow | null>(null)

  const selectedSku = useMemo(
    () => skus.find((sku) => sku.id === selectedSkuId) ?? null,
    [skus, selectedSkuId]
  )

  const fetchSkus = useCallback(async () => {
    try {
      setSkusLoading(true)
      const response = await fetch('/api/skus?includeInactive=true', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load SKUs')
      }
      const data = await response.json()
      const rows: SkuOption[] = Array.isArray(data) ? data : []
      setSkus(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load SKUs')
    } finally {
      setSkusLoading(false)
    }
  }, [])

  const fetchBatches = useCallback(async () => {
    if (!selectedSkuId) {
      setBatches([])
      return
    }

    try {
      setBatchesLoading(true)
      const params = new URLSearchParams()
      if (includeInactiveBatches) params.set('includeInactive', 'true')
      const response = await fetch(`/api/skus/${encodeURIComponent(selectedSkuId)}/batches?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load batches')
      }

      const payload = await response.json()
      const rows: BatchRow[] = Array.isArray(payload?.batches) ? payload.batches : []
      setBatches(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load batches')
      setBatches([])
    } finally {
      setBatchesLoading(false)
    }
  }, [includeInactiveBatches, selectedSkuId])

  useEffect(() => {
    fetchSkus()
  }, [fetchSkus])

  useEffect(() => {
    void fetchBatches()
  }, [fetchBatches])

  const filteredBatches = useMemo(() => {
    const term = batchSearch.trim().toLowerCase()
    if (!term) return batches
    return batches.filter((batch) => {
      return (
        batch.batchCode.toLowerCase().includes(term) ||
        (batch.description ?? '').toLowerCase().includes(term)
      )
    })
  }, [batchSearch, batches])

  const openCreate = () => {
    setEditingBatch(null)
    setFormState(buildBatchFormState())
    setIsModalOpen(true)
  }

  const openEdit = (batch: BatchRow) => {
    setEditingBatch(batch)
    setFormState(buildBatchFormState(batch))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setEditingBatch(null)
    setFormState(buildBatchFormState())
  }

  const submitBatch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedSkuId) {
      toast.error('Select a SKU first')
      return
    }
    if (isSubmitting) return

    const storage = parsePositiveInt(formState.storageCartonsPerPallet)
    const shipping = parsePositiveInt(formState.shippingCartonsPerPallet)

    setIsSubmitting(true)
    try {
      const payload = {
        batchCode: formState.batchCode.trim(),
        description: formState.description.trim() ? formState.description.trim() : null,
        productionDate: formState.productionDate ? formState.productionDate : null,
        expiryDate: formState.expiryDate ? formState.expiryDate : null,
        storageCartonsPerPallet: storage,
        shippingCartonsPerPallet: shipping,
        isActive: formState.isActive,
      }

      const endpoint = editingBatch
        ? `/api/skus/${encodeURIComponent(selectedSkuId)}/batches/${encodeURIComponent(editingBatch.id)}`
        : `/api/skus/${encodeURIComponent(selectedSkuId)}/batches`
      const method = editingBatch ? 'PATCH' : 'POST'

      const response = await fetchWithCSRF(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to save batch')
      }

      toast.success(editingBatch ? 'Batch updated' : 'Batch created')
      closeModal()
      await fetchBatches()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save batch')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deactivateBatch = async (batch: BatchRow) => {
    if (!selectedSkuId) return
    try {
      const response = await fetchWithCSRF(
        `/api/skus/${encodeURIComponent(selectedSkuId)}/batches/${encodeURIComponent(batch.id)}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to deactivate batch')
      }

      toast.success('Batch deactivated')
      await fetchBatches()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate batch')
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted-foreground">Batches</h3>
          <p className="text-xs text-muted-foreground">
            Batch defaults apply to receiving (storage/shipping cartons per pallet).
          </p>
        </div>

        <Button onClick={openCreate} className="gap-2" disabled={!selectedSkuId}>
          <Plus className="h-4 w-4" />
          New Batch
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Label htmlFor="batch-sku-select">SKU</Label>
          <select
            id="batch-sku-select"
            value={selectedSkuId}
            onChange={(event) => setSelectedSkuId(event.target.value)}
            className="mt-1 w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={skusLoading}
          >
            <option value="">{skusLoading ? 'Loading SKUs…' : 'Select SKU…'}</option>
            {skus.map((sku) => (
              <option key={sku.id} value={sku.id}>
                {sku.skuCode} {sku.isActive ? '' : '(inactive)'} — {sku.description}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full max-w-sm">
          <Label htmlFor="batch-search">Search</Label>
          <Input
            id="batch-search"
            value={batchSearch}
            onChange={(event) => setBatchSearch(event.target.value)}
            placeholder="Search batch code or description"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeInactiveBatches}
            onChange={(event) => setIncludeInactiveBatches(event.target.checked)}
          />
          Include inactive
        </label>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSkus} disabled={skusLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchBatches} disabled={batchesLoading || !selectedSkuId}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-soft">
        {!selectedSku ? (
          <div className="p-10">
            <EmptyState
              icon={Boxes}
              title="Select a SKU"
              description="Pick a SKU to view and manage its batches and default pallet configs."
            />
          </div>
        ) : batchesLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Boxes}
              title={batchSearch ? 'No batches found' : 'No batches yet'}
              description={
                batchSearch
                  ? 'Clear your search or create a new batch.'
                  : 'Create a batch to set default cartons-per-pallet values for receiving.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Batch</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-left font-semibold">Production</th>
                  <th className="px-3 py-2 text-left font-semibold">Expiry</th>
                  <th className="px-3 py-2 text-right font-semibold">Storage C/P</th>
                  <th className="px-3 py-2 text-right font-semibold">Shipping C/P</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="odd:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{batch.batchCode}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{batch.description ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(batch.productionDate)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(batch.expiryDate)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {batch.storageCartonsPerPallet ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {batch.shippingCartonsPerPallet ?? '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge
                        className={
                          batch.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }
                      >
                        {batch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(batch)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDeactivate(batch)}
                          disabled={!batch.isActive}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingBatch ? 'Edit Batch' : 'New Batch'}
                </h2>
                <p className="text-xs text-muted-foreground">{selectedSku ? selectedSku.skuCode : ''}</p>
              </div>
              <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Close
              </Button>
            </div>

            <form onSubmit={submitBatch} className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="batchCode">Batch Code</Label>
                  <Input
                    id="batchCode"
                    value={formState.batchCode}
                    onChange={(event) => setFormState((prev) => ({ ...prev, batchCode: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="batchDescription">Description</Label>
                  <Input
                    id="batchDescription"
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="productionDate">Production Date</Label>
                  <Input
                    id="productionDate"
                    type="date"
                    value={formState.productionDate}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, productionDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formState.expiryDate}
                    onChange={(event) => setFormState((prev) => ({ ...prev, expiryDate: event.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="storageCartonsPerPallet">Storage Cartons / Pallet</Label>
                  <Input
                    id="storageCartonsPerPallet"
                    type="number"
                    min={1}
                    value={formState.storageCartonsPerPallet}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, storageCartonsPerPallet: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="shippingCartonsPerPallet">Shipping Cartons / Pallet</Label>
                  <Input
                    id="shippingCartonsPerPallet"
                    type="number"
                    min={1}
                    value={formState.shippingCartonsPerPallet}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, shippingCartonsPerPallet: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-6">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(event) => setFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Active
                </label>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </span>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDeactivate !== null}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={() => {
          if (!confirmDeactivate) return
          void deactivateBatch(confirmDeactivate)
        }}
        title="Deactivate batch?"
        message={confirmDeactivate ? `Deactivate ${confirmDeactivate.batchCode}?` : ''}
        confirmText="Deactivate"
        type="warning"
      />
    </div>
  )
}
