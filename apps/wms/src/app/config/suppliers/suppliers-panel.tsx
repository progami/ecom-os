'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { Edit2, Loader2, Plus, Search, Trash2, Users } from '@/lib/lucide-icons'

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

interface SuppliersPanelProps {
  externalModalOpen?: boolean
  onExternalModalClose?: () => void
}

export default function SuppliersPanel({ externalModalOpen, onExternalModalClose }: SuppliersPanelProps) {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null)
  const [formState, setFormState] = useState<SupplierFormState>(() => buildSupplierFormState())

  const [confirmToggle, setConfirmToggle] = useState<{
    supplier: SupplierRow
    nextActive: boolean
  } | null>(null)

  const [confirmDelete, setConfirmDelete] = useState<SupplierRow | null>(null)

  // Handle external modal open trigger
  useEffect(() => {
    if (externalModalOpen) {
      setEditingSupplier(null)
      setFormState(buildSupplierFormState())
      setIsModalOpen(true)
    }
  }, [externalModalOpen])

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (showInactive) params.set('includeInactive', 'true')
    return params.toString()
  }, [showInactive, searchTerm])

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
      if (!showInactive && !supplier.isActive) return false
      if (!term) return true
      return (
        supplier.name.toLowerCase().includes(term) ||
        (supplier.contactName ?? '').toLowerCase().includes(term) ||
        (supplier.email ?? '').toLowerCase().includes(term)
      )
    })
  }, [searchTerm, suppliers, showInactive])

  const totals = useMemo(() => {
    const active = suppliers.filter((s) => s.isActive).length
    const inactive = suppliers.length - active
    return { active, inactive }
  }, [suppliers])

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
    onExternalModalClose?.()
  }

  const submitSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!formState.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!formState.contactName.trim()) {
      toast.error('Contact name is required')
      return
    }
    if (!formState.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!formState.phone.trim()) {
      toast.error('Phone is required')
      return
    }
    if (!formState.address.trim()) {
      toast.error('Address is required')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: formState.name.trim(),
        contactName: formState.contactName.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        address: formState.address.trim(),
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

  const deleteSupplier = async (supplier: SupplierRow) => {
    try {
      const response = await fetchWithCSRF(`/api/suppliers?id=${encodeURIComponent(supplier.id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to delete supplier')
      }

      toast.success('Supplier deleted')
      await fetchSuppliers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete supplier')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-semibold text-slate-900">Supplier Directory</h2>
            </div>
            <p className="text-sm text-slate-600">Manage supplier information and contacts</p>
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
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search suppliers..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
              />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
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
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Users className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-base font-semibold text-slate-900">
                {searchTerm || showInactive ? 'No suppliers found' : 'No suppliers yet'}
              </p>
              <p className="text-sm text-slate-500">
                {searchTerm
                  ? 'Clear your search or create a new supplier.'
                  : 'Create suppliers for consistent SKU defaults and purchase orders.'}
              </p>
            </div>
            {!searchTerm && !showInactive && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                New Supplier
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{supplier.name}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {supplier.contactName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{supplier.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{supplier.phone ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        className={
                          supplier.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }
                      >
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDelete(supplier)}
                          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="w-full max-w-2xl overflow-hidden rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
              </h2>
              <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Close
              </Button>
            </div>

            <form onSubmit={submitSupplier} className="space-y-6 p-6 bg-white rounded-b-lg">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="supplier-name">Name</Label>
                  <input
                    id="supplier-name"
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-contact">Contact Name</Label>
                  <input
                    id="supplier-contact"
                    value={formState.contactName}
                    onChange={(event) => setFormState((prev) => ({ ...prev, contactName: event.target.value }))}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-email">Email</Label>
                  <input
                    id="supplier-email"
                    type="email"
                    value={formState.email}
                    onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supplier-phone">Phone</Label>
                  <input
                    id="supplier-phone"
                    value={formState.phone}
                    onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 transition-shadow"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="supplier-address">Address</Label>
                  <Textarea
                    id="supplier-address"
                    value={formState.address}
                    onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                    required
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
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
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

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return
          void deleteSupplier(confirmDelete)
        }}
        title="Delete supplier?"
        message={
          confirmDelete
            ? `Delete ${confirmDelete.name}? This is permanent and only allowed when there are no references.`
            : ''
        }
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}
