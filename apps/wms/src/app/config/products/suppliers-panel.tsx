'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Edit2, Loader2, Plus, RefreshCw, Users } from '@/lib/lucide-icons'

interface SupplierRow {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SuppliersResponse {
  data: SupplierRow[]
  count: number
}

interface SupplierFormState {
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  notes: string
  isActive: boolean
}

function buildSupplierFormState(supplier?: SupplierRow | null): SupplierFormState {
  return {
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
    isActive: supplier?.isActive ?? true,
  }
}

export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null)
  const [formState, setFormState] = useState<SupplierFormState>(() => buildSupplierFormState())

  const [confirmToggle, setConfirmToggle] = useState<{
    supplier: SupplierRow
    nextActive: boolean
  } | null>(null)

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (includeInactive) params.set('includeInactive', 'true')
    return params.toString()
  }, [includeInactive, searchTerm])

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/suppliers?${buildQuery()}`, { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load suppliers')
      }

      const payload = (await response.json()) as SuppliersResponse
      setSuppliers(Array.isArray(payload?.data) ? payload.data : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return suppliers.filter((supplier) => {
      if (!term) return true
      return (
        supplier.name.toLowerCase().includes(term) ||
        (supplier.contactName ?? '').toLowerCase().includes(term) ||
        (supplier.email ?? '').toLowerCase().includes(term)
      )
    })
  }, [searchTerm, suppliers])

  const openCreate = () => {
    setEditingSupplier(null)
    setFormState(buildSupplierFormState())
    setIsModalOpen(true)
  }

  const openEdit = (supplier: SupplierRow) => {
    setEditingSupplier(supplier)
    setFormState(buildSupplierFormState(supplier))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setEditingSupplier(null)
    setFormState(buildSupplierFormState())
  }

  const submitSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!formState.name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: formState.name.trim(),
        contactName: formState.contactName.trim() ? formState.contactName.trim() : null,
        email: formState.email.trim() ? formState.email.trim() : null,
        phone: formState.phone.trim() ? formState.phone.trim() : null,
        address: formState.address.trim() ? formState.address.trim() : null,
        notes: formState.notes.trim() ? formState.notes.trim() : null,
        isActive: formState.isActive,
      }

      const endpoint = editingSupplier
        ? `/api/suppliers?id=${encodeURIComponent(editingSupplier.id)}`
        : '/api/suppliers'
      const method = editingSupplier ? 'PATCH' : 'POST'
      const response = await fetchWithCSRF(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to save supplier')
      }

      toast.success(editingSupplier ? 'Supplier updated' : 'Supplier created')
      closeModal()
      await fetchSuppliers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save supplier')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleSupplierActive = async (supplier: SupplierRow, nextActive: boolean) => {
    try {
      const response = await fetchWithCSRF(`/api/suppliers?id=${encodeURIComponent(supplier.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update supplier')
      }

      toast.success(nextActive ? 'Supplier activated' : 'Supplier deactivated')
      await fetchSuppliers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update supplier')
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted-foreground">Suppliers</h3>
          <p className="text-xs text-muted-foreground">
            Showing {filteredSuppliers.length.toLocaleString()} supplier
            {filteredSuppliers.length === 1 ? '' : 's'}
          </p>
        </div>

        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Supplier
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <Label htmlFor="supplier-search">Search</Label>
          <Input
            id="supplier-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, contact, email"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Include inactive
        </label>

        <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-soft">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Users}
              title={searchTerm || includeInactive ? 'No suppliers found' : 'No suppliers yet'}
              description={
                searchTerm
                  ? 'Clear your search or create a new supplier.'
                  : 'Create suppliers here so ops can pick them consistently.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Contact</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Phone</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="odd:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{supplier.name}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {supplier.contactName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{supplier.email ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{supplier.phone ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge
                        className={
                          supplier.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }
                      >
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(supplier)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmToggle({ supplier, nextActive: !supplier.isActive })}
                        >
                          {supplier.isActive ? 'Deactivate' : 'Activate'}
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
              <h2 className="text-lg font-semibold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Close
              </Button>
            </div>

            <form onSubmit={submitSupplier} className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="supplier-name">Name</Label>
                  <Input
                    id="supplier-name"
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-contact">Contact Name</Label>
                  <Input
                    id="supplier-contact"
                    value={formState.contactName}
                    onChange={(event) => setFormState((prev) => ({ ...prev, contactName: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-email">Email</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    value={formState.email}
                    onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-phone">Phone</Label>
                  <Input
                    id="supplier-phone"
                    value={formState.phone}
                    onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="supplier-address">Address</Label>
                  <Textarea
                    id="supplier-address"
                    value={formState.address}
                    onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Optional"
                    rows={2}
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="supplier-notes">Notes</Label>
                  <Textarea
                    id="supplier-notes"
                    value={formState.notes}
                    onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional"
                    rows={3}
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
          void toggleSupplierActive(confirmToggle.supplier, confirmToggle.nextActive)
        }}
        title={confirmToggle?.nextActive ? 'Activate supplier?' : 'Deactivate supplier?'}
        message={
          confirmToggle
            ? `${confirmToggle.nextActive ? 'Activate' : 'Deactivate'} ${confirmToggle.supplier.name}?`
            : ''
        }
        confirmText={confirmToggle?.nextActive ? 'Activate' : 'Deactivate'}
        type={confirmToggle?.nextActive ? 'info' : 'warning'}
      />
    </div>
  )
}
