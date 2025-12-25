'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Edit2, Loader2, Package2, Plus, Search } from '@/lib/lucide-icons'

interface SkuBatchRow {
  id: string
  batchCode: string
  description: string | null
  productionDate: string | null
  expiryDate: string | null
  packSize: number | null
  unitsPerCarton: number | null
  material: string | null
  unitDimensionsCm: string | null
  unitLengthCm: number | string | null
  unitWidthCm: number | string | null
  unitHeightCm: number | string | null
  unitWeightKg: number | string | null
  cartonDimensionsCm: string | null
  cartonLengthCm: number | string | null
  cartonWidthCm: number | string | null
  cartonHeightCm: number | string | null
  cartonWeightKg: number | string | null
  packagingType: string | null
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

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
  unitLengthCm: number | string | null
  unitWidthCm: number | string | null
  unitHeightCm: number | string | null
  unitWeightKg: number | string | null
  unitsPerCarton: number
  cartonDimensionsCm: string | null
  cartonLengthCm: number | string | null
  cartonWidthCm: number | string | null
  cartonHeightCm: number | string | null
  cartonWeightKg: number | string | null
  packagingType: string | null
  isActive: boolean
  _count?: { inventoryTransactions: number }
  batches?: SkuBatchRow[]
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
  defaultSupplierId: string
  secondarySupplierId: string
  isActive: boolean
}

function buildFormState(sku?: SkuRow | null): SkuFormState {
  return {
    skuCode: sku?.skuCode ?? '',
    description: sku?.description ?? '',
    asin: sku?.asin ?? '',
    defaultSupplierId: sku?.defaultSupplierId ?? '',
    secondarySupplierId: sku?.secondarySupplierId ?? '',
    isActive: sku?.isActive ?? true,
  }
}

interface SkusPanelProps {
  externalModalOpen?: boolean
  onExternalModalClose?: () => void
}

export default function SkusPanel({ externalModalOpen, onExternalModalClose }: SkusPanelProps) {
  const router = useRouter()
  const [skus, setSkus] = useState<SkuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSku, setEditingSku] = useState<SkuRow | null>(null)
  const [formState, setFormState] = useState<SkuFormState>(() => buildFormState())

  const [confirmToggle, setConfirmToggle] = useState<{
    sku: SkuRow
    nextActive: boolean
  } | null>(null)

  // Handle external modal open trigger
  useEffect(() => {
    if (externalModalOpen) {
      setEditingSku(null)
      setFormState(buildFormState(null))
      setIsModalOpen(true)
    }
  }, [externalModalOpen])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (showInactive) params.set('includeInactive', 'true')
    return params.toString()
  }, [searchTerm, showInactive])

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
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : []
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
    return skus.filter(sku => {
      if (!showInactive && !sku.isActive) return false
      if (!term) return true

      return (
        sku.skuCode.toLowerCase().includes(term) ||
        sku.description.toLowerCase().includes(term) ||
        (sku.asin ?? '').toLowerCase().includes(term)
      )
    })
  }, [skus, searchTerm, showInactive])

  const totals = useMemo(() => {
    const active = skus.filter(s => s.isActive).length
    const inactive = skus.length - active
    return { active, inactive }
  }, [skus])

  const openCreate = () => {
    setEditingSku(null)
    setFormState(buildFormState(null))
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
    setFormState(buildFormState(null))
    onExternalModalClose?.()
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

    const skuCode = formState.skuCode.trim()
    const description = formState.description.trim()
    const asinValue = formState.asin.trim() ? formState.asin.trim() : null

    if (!skuCode) {
      toast.error('SKU code is required')
      return
    }

    if (!description) {
      toast.error('Description is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        skuCode,
        asin: asinValue,
        description,
        defaultSupplierId: formState.defaultSupplierId ? formState.defaultSupplierId : null,
        secondarySupplierId: formState.secondarySupplierId ? formState.secondarySupplierId : null,
        isActive: formState.isActive,
      }

      let endpoint = '/api/skus'
      let method: 'POST' | 'PATCH' = 'POST'

      if (editingSku) {
        endpoint = `/api/skus?id=${encodeURIComponent(editingSku.id)}`
        method = 'PATCH'
      }

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
      setFormState(buildFormState(null))
      onExternalModalClose?.()
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
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Package2 className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-semibold text-slate-900">SKU Catalog</h2>
            </div>
            <p className="text-sm text-slate-600">Manage product SKUs and their specifications</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
              {totals.active} active
            </Badge>
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-medium">
              {totals.inactive} inactive
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-4 bg-slate-50/50 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search SKUs..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={event => setShowInactive(event.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              Show inactive
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Package2 className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-base font-semibold text-slate-900">
                {searchTerm || showInactive ? 'No SKUs found' : 'No SKUs yet'}
              </p>
              <p className="text-sm text-slate-500">
                {searchTerm
                  ? 'Clear your search or create a new SKU.'
                  : 'Create your first SKU to start receiving inventory.'}
              </p>
            </div>
            {!searchTerm && !showInactive && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                New SKU
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">ASIN</th>
                  <th className="px-4 py-3 text-right font-semibold">Txns</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkus.map(sku => {
                  return (
                    <tr key={sku.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/config/products/batches?skuId=${encodeURIComponent(sku.id)}`
                            )
                          }
                          className="text-cyan-700 hover:underline"
                        >
                          {sku.skuCode}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {sku.description}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {sku.asin ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {sku._count?.inventoryTransactions ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={
                            sku.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }
                        >
                          {sku.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/50">
          <div className="flex h-full w-full items-start justify-center overflow-y-auto p-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingSku ? 'Edit SKU' : 'New SKU'}
                </h2>
                <div className="flex items-center gap-3">
                  {editingSku ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        closeModal()
                        router.push(
                          `/config/products/batches?skuId=${encodeURIComponent(editingSku.id)}`
                        )
                      }}
                      disabled={isSubmitting}
                    >
                      View Batches
                    </Button>
                  ) : null}
                  <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                    Close
                  </Button>
                </div>
              </div>

              <form onSubmit={submitSku} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-6 overflow-y-auto p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="skuCode">SKU Code</Label>
                      <Input
                        id="skuCode"
                        value={formState.skuCode}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, skuCode: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="asin">ASIN</Label>
                      <Input
                        id="asin"
                        value={formState.asin}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, asin: event.target.value }))
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formState.description}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, description: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="defaultSupplierId">Default Supplier</Label>
                      <select
                        id="defaultSupplierId"
                        value={formState.defaultSupplierId}
                        onChange={event =>
                          setFormState(prev => ({ ...prev, defaultSupplierId: event.target.value }))
                        }
                        className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        disabled={suppliersLoading}
                      >
                        <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                        {suppliers
                          .filter(supplier => supplier.isActive)
                          .map(supplier => (
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
                        onChange={event =>
                          setFormState(prev => ({
                            ...prev,
                            secondarySupplierId: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        disabled={suppliersLoading}
                      >
                        <option value="">{suppliersLoading ? 'Loading…' : 'None'}</option>
                        {suppliers
                          .filter(supplier => supplier.isActive)
                          .map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      {editingSku ? (
                        <>
                          Batch-specific specs (pack size, units/carton, dimensions, weights,
                          packaging) are managed per batch. Click the SKU code (or use View Batches)
                          to view or edit batches.
                        </>
                      ) : (
                        <>
                          A default batch is created automatically. Configure pack specs,
                          dimensions, and cartons-per-pallet on the Batches page after creating the
                          SKU.
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={event =>
                        setFormState(prev => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Active
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeModal}
                      disabled={isSubmitting}
                    >
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
    </div>
  )
}
