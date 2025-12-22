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
import { Edit2, Loader2, Package2, Plus, Search } from '@/lib/lucide-icons'
import { SkuBatchesModal } from './sku-batches-modal'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
]

interface SkuRow {
  id: string
  skuCode: string
  description: string
  asin: string | null
  packSize: number | null
  defaultSupplierId?: string | null
  secondarySupplierId?: string | null
  material: string | null
  unitDimensionsCm: string | null
  unitWeightKg: number | null
  unitsPerCarton: number
  cartonDimensionsCm: string | null
  cartonWeightKg: number | null
  packagingType: string | null
  isActive: boolean
  _count?: { inventoryTransactions: number }
}

interface SupplierOption {
  id: string
  name: string
  isActive: boolean
}

interface SkuFormState {
  skuCode: string
  description: string
  asin: string
  packSize: string
  defaultSupplierId: string
  secondarySupplierId: string
  material: string
  unitDimensionsCm: string
  unitWeightKg: string
  unitsPerCarton: string
  cartonDimensionsCm: string
  cartonWeightKg: string
  packagingType: string
  isActive: boolean
}

function buildFormState(sku?: SkuRow | null): SkuFormState {
  return {
    skuCode: sku?.skuCode ?? '',
    description: sku?.description ?? '',
    asin: sku?.asin ?? '',
    packSize: sku?.packSize?.toString() ?? '1',
    defaultSupplierId: sku?.defaultSupplierId ?? '',
    secondarySupplierId: sku?.secondarySupplierId ?? '',
    material: sku?.material ?? '',
    unitDimensionsCm: sku?.unitDimensionsCm ?? '',
    unitWeightKg: sku?.unitWeightKg?.toString() ?? '',
    unitsPerCarton: sku?.unitsPerCarton?.toString() ?? '1',
    cartonDimensionsCm: sku?.cartonDimensionsCm ?? '',
    cartonWeightKg: sku?.cartonWeightKg?.toString() ?? '',
    packagingType: sku?.packagingType ?? '',
    isActive: sku?.isActive ?? true,
  }
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export default function SkusPanel() {
  const [skus, setSkus] = useState<SkuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE')
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [batchesSku, setBatchesSku] = useState<SkuRow | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSku, setEditingSku] = useState<SkuRow | null>(null)
  const [formState, setFormState] = useState<SkuFormState>(() => buildFormState())

  const [confirmToggle, setConfirmToggle] = useState<{
    sku: SkuRow
    nextActive: boolean
  } | null>(null)

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (statusFilter !== 'ACTIVE') params.set('includeInactive', 'true')
    return params.toString()
  }, [searchTerm, statusFilter])

  const fetchSkus = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/skus?${buildQuery()}`, { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load SKUs')
      }

      const data = await response.json()
      const rows: SkuRow[] = Array.isArray(data) ? data : []
      setSkus(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load SKUs')
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    fetchSkus()
  }, [fetchSkus])

  const fetchSuppliers = useCallback(async () => {
    try {
      setSuppliersLoading(true)
      const response = await fetch('/api/suppliers', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load suppliers')
      }

      const payload = await response.json()
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setSuppliers(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load suppliers')
      setSuppliers([])
    } finally {
      setSuppliersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const filteredSkus = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return skus.filter((sku) => {
      if (statusFilter === 'ACTIVE' && !sku.isActive) return false
      if (statusFilter === 'INACTIVE' && sku.isActive) return false
      if (!term) return true

      return (
        sku.skuCode.toLowerCase().includes(term) ||
        sku.description.toLowerCase().includes(term) ||
        (sku.asin ?? '').toLowerCase().includes(term)
      )
    })
  }, [skus, searchTerm, statusFilter])

  const openCreate = () => {
    setEditingSku(null)
    setFormState(buildFormState())
    setIsModalOpen(true)
  }

  const openEdit = (sku: SkuRow) => {
    setEditingSku(sku)
    setFormState(buildFormState(sku))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setEditingSku(null)
    setFormState(buildFormState())
  }

  const submitSku = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    if (
      formState.defaultSupplierId &&
      formState.secondarySupplierId &&
      formState.defaultSupplierId === formState.secondarySupplierId
    ) {
      toast.error('Default and secondary supplier must be different')
      return
    }

    const packSize = parsePositiveInt(formState.packSize)
    const unitsPerCarton = parsePositiveInt(formState.unitsPerCarton)
    if (!packSize) {
      toast.error('Pack size must be a positive integer')
      return
    }
    if (!unitsPerCarton) {
      toast.error('Units per carton must be a positive integer')
      return
    }

    const unitWeightKg = parseOptionalNumber(formState.unitWeightKg)
    if (unitWeightKg !== undefined && !parsePositiveNumber(formState.unitWeightKg)) {
      toast.error('Unit weight must be a positive number')
      return
    }

    const cartonWeightKg = parseOptionalNumber(formState.cartonWeightKg)
    if (cartonWeightKg !== undefined && !parsePositiveNumber(formState.cartonWeightKg)) {
      toast.error('Carton weight must be a positive number')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        skuCode: formState.skuCode.trim(),
        asin: formState.asin.trim() ? formState.asin.trim() : null,
        description: formState.description.trim(),
        packSize,
        defaultSupplierId: formState.defaultSupplierId ? formState.defaultSupplierId : null,
        secondarySupplierId: formState.secondarySupplierId ? formState.secondarySupplierId : null,
        material: formState.material.trim() ? formState.material.trim() : null,
        unitDimensionsCm: formState.unitDimensionsCm.trim() ? formState.unitDimensionsCm.trim() : null,
        unitWeightKg: unitWeightKg ?? null,
        unitsPerCarton,
        cartonDimensionsCm: formState.cartonDimensionsCm.trim()
          ? formState.cartonDimensionsCm.trim()
          : null,
        cartonWeightKg: cartonWeightKg ?? null,
        packagingType: formState.packagingType.trim() ? formState.packagingType.trim() : null,
        isActive: formState.isActive,
      }

      const endpoint = editingSku ? `/api/skus?id=${encodeURIComponent(editingSku.id)}` : '/api/skus'
      const method = editingSku ? 'PATCH' : 'POST'
      const response = await fetchWithCSRF(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to save SKU')
      }

      toast.success(editingSku ? 'SKU updated' : 'SKU created')
      setIsModalOpen(false)
      setEditingSku(null)
      setFormState(buildFormState())
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save SKU')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSkuActive = async (sku: SkuRow, nextActive: boolean) => {
    try {
      const response = await fetchWithCSRF(`/api/skus?id=${encodeURIComponent(sku.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update SKU')
      }

      toast.success(nextActive ? 'SKU activated' : 'SKU deactivated')
      await fetchSkus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update SKU')
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-muted-foreground">SKUs</h3>
            <p className="text-xs text-muted-foreground">
              Showing {filteredSkus.length.toLocaleString()} SKU{filteredSkus.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New SKU
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="relative w-full max-w-sm">
            <label htmlFor="sku-search" className="sr-only">
              Search SKUs
            </label>
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="sku-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by SKU, description, ASIN"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-white p-1">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={statusFilter === filter.value ? 'default' : 'ghost'}
                  className="px-3 py-1 text-xs"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={fetchSkus} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Package2}
              title={searchTerm || statusFilter !== 'ALL' ? 'No SKUs found' : 'No SKUs yet'}
              description={
                searchTerm || statusFilter !== 'ALL'
                  ? 'Adjust filters or clear your search.'
                  : 'Create your first SKU to start receiving inventory.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-left font-semibold">ASIN</th>
                  <th className="px-3 py-2 text-right font-semibold">Pack</th>
                  <th className="px-3 py-2 text-right font-semibold">Units/Carton</th>
                  <th className="px-3 py-2 text-right font-semibold">Txns</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => (
                  <tr key={sku.id} className="odd:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{sku.skuCode}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{sku.description}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{sku.asin ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {sku.packSize ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {sku.unitsPerCarton}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {sku._count?.inventoryTransactions ?? 0}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge
                        className={
                          sku.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }
                      >
                        {sku.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setBatchesSku(sku)}>
                          Batches
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(sku)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmToggle({ sku, nextActive: !sku.isActive })}
                        >
                          {sku.isActive ? 'Deactivate' : 'Activate'}
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
          <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingSku ? 'Edit SKU' : 'New SKU'}</h2>
              <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Close
              </Button>
            </div>

            <form onSubmit={submitSku} className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="skuCode">SKU Code</Label>
                  <Input
                    id="skuCode"
                    value={formState.skuCode}
                    onChange={(event) => setFormState((prev) => ({ ...prev, skuCode: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="asin">ASIN</Label>
                  <Input
                    id="asin"
                    value={formState.asin}
                    onChange={(event) => setFormState((prev) => ({ ...prev, asin: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="defaultSupplierId">Default Supplier</Label>
                  <select
                    id="defaultSupplierId"
                    value={formState.defaultSupplierId}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, defaultSupplierId: event.target.value }))
                    }
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={suppliersLoading}
                  >
                    <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                    {suppliers
                      .filter((supplier) => supplier.isActive)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="secondarySupplierId">Secondary Supplier</Label>
                  <select
                    id="secondarySupplierId"
                    value={formState.secondarySupplierId}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, secondarySupplierId: event.target.value }))
                    }
                    className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={suppliersLoading}
                  >
                    <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                    {suppliers
                      .filter((supplier) => supplier.isActive)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="packSize">Pack Size</Label>
                  <Input
                    id="packSize"
                    type="number"
                    min={1}
                    value={formState.packSize}
                    onChange={(event) => setFormState((prev) => ({ ...prev, packSize: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unitsPerCarton">Units per Carton</Label>
                  <Input
                    id="unitsPerCarton"
                    type="number"
                    min={1}
                    value={formState.unitsPerCarton}
                    onChange={(event) => setFormState((prev) => ({ ...prev, unitsPerCarton: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    value={formState.material}
                    onChange={(event) => setFormState((prev) => ({ ...prev, material: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="packagingType">Packaging Type</Label>
                  <Input
                    id="packagingType"
                    value={formState.packagingType}
                    onChange={(event) => setFormState((prev) => ({ ...prev, packagingType: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unitDimensionsCm">Unit Dimensions (cm)</Label>
                  <Input
                    id="unitDimensionsCm"
                    value={formState.unitDimensionsCm}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, unitDimensionsCm: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unitWeightKg">Unit Weight (kg)</Label>
                  <Input
                    id="unitWeightKg"
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={formState.unitWeightKg}
                    onChange={(event) => setFormState((prev) => ({ ...prev, unitWeightKg: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cartonDimensionsCm">Carton Dimensions (cm)</Label>
                  <Input
                    id="cartonDimensionsCm"
                    value={formState.cartonDimensionsCm}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, cartonDimensionsCm: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cartonWeightKg">Carton Weight (kg)</Label>
                  <Input
                    id="cartonWeightKg"
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={formState.cartonWeightKg}
                    onChange={(event) => setFormState((prev) => ({ ...prev, cartonWeightKg: event.target.value }))}
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
        isOpen={confirmToggle !== null}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => {
          if (!confirmToggle) return
          void toggleSkuActive(confirmToggle.sku, confirmToggle.nextActive)
        }}
        title={confirmToggle?.nextActive ? 'Activate SKU?' : 'Deactivate SKU?'}
        message={
          confirmToggle
            ? `${confirmToggle.nextActive ? 'Activate' : 'Deactivate'} ${confirmToggle.sku.skuCode}?`
            : ''
        }
        confirmText={confirmToggle?.nextActive ? 'Activate' : 'Deactivate'}
        type={confirmToggle?.nextActive ? 'info' : 'warning'}
      />

      <SkuBatchesModal
        isOpen={batchesSku !== null}
        onClose={() => setBatchesSku(null)}
        sku={
          batchesSku
            ? { id: batchesSku.id, skuCode: batchesSku.skuCode, description: batchesSku.description }
            : null
        }
      />
    </div>
  )
}
