'use client'

import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { withAppBasePath } from '@/lib/base-path'

interface ProductSetupGridProps {
  products: Array<{ id: string; sku: string; name: string }>
  className?: string
}

type ProductRow = {
  id: string
  sku: string
  name: string
}

function normalizeProducts(products: ProductSetupGridProps['products']): ProductRow[] {
  return products
    .map((product) => ({
      id: product.id,
      sku: product.sku ?? '',
      name: product.name ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function ProductSetupGrid({ products, className }: ProductSetupGridProps) {
  const initialRows = useMemo(() => normalizeProducts(products), [products])
  const [rows, setRows] = useState<ProductRow[]>(initialRows)
  const [creatingSku, setCreatingSku] = useState('')
  const [creatingName, setCreatingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraftSku, setEditDraftSku] = useState('')
  const [editDraftName, setEditDraftName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setRows(normalizeProducts(products))
  }, [products])

  const resetCreateForm = () => {
    setCreatingSku('')
    setCreatingName('')
  }

  const handleCreateProduct = async () => {
    const sku = creatingSku.trim()
    const name = creatingName.trim()
    if (!sku || !name) {
      toast.error('Enter both a SKU and product name')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, name }),
      })
      if (!response.ok) throw new Error('Failed to create product')
      const payload = await response.json()
      const created: ProductRow = {
        id: payload.product.id,
        sku: payload.product.sku ?? '',
        name: payload.product.name ?? '',
      }
      setRows((previous) => normalizeProducts([...previous, created]))
      resetCreateForm()
      setIsAdding(false)
      toast.success('Product added')
    } catch (error) {
      console.error(error)
      toast.error('Unable to add product')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancelCreate = () => {
    if (isCreating) return
    resetCreateForm()
    setIsAdding(false)
  }

  const handleStartEdit = (row: ProductRow) => {
    setEditingId(row.id)
    setEditDraftSku(row.sku)
    setEditDraftName(row.name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditDraftSku('')
    setEditDraftName('')
    setSavingId(null)
  }

  const handleSaveEdit = async (row: ProductRow) => {
    const nextSku = editDraftSku.trim()
    const nextName = editDraftName.trim()
    if (!nextSku || !nextName) {
      toast.error('Enter both a SKU and product name')
      return
    }
    if (nextSku === row.sku && nextName === row.name) {
      handleCancelEdit()
      return
    }

    setSavingId(row.id)
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/products'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: row.id, values: { sku: nextSku, name: nextName } }] }),
      })
      if (!response.ok) throw new Error('Failed to save product')
      setRows((previous) =>
        normalizeProducts(
          previous.map((item) =>
            item.id === row.id
              ? { ...item, sku: nextSku, name: nextName }
              : item
          )
        )
      )
      toast.success('Product updated')
      handleCancelEdit()
    } catch (error) {
      console.error(error)
      toast.error('Unable to update product')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (row: ProductRow) => {
    setDeletingId(row.id)
    try {
      const response = await fetch(withAppBasePath('/api/v1/x-plan/products'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [row.id] }),
      })
      if (!response.ok) throw new Error('Failed to delete product')
      setRows((previous) => previous.filter((item) => item.id !== row.id))
      toast.success('Product removed')
    } catch (error) {
      console.error(error)
      toast.error('Unable to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Product Catalog</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage products for your planning sheets
          </p>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <th className="w-32 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                SKU
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Product Name
              </th>
              <th className="w-24 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {isAdding && (
              <tr className="bg-cyan-50/50 dark:bg-cyan-900/10">
                <td className="px-4 py-3">
                  <input
                    value={creatingSku}
                    onChange={(event) => setCreatingSku(event.target.value)}
                    placeholder="SKU"
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    value={creatingName}
                    onChange={(event) => setCreatingName(event.target.value)}
                    placeholder="Product name"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleCreateProduct()
                      if (event.key === 'Escape') handleCancelCreate()
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleCreateProduct}
                      disabled={isCreating}
                      className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelCreate}
                      disabled={isCreating}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !isAdding ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No products yet. Click "Add Product" to get started.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isEditing = editingId === row.id
                const isSaving = savingId === row.id
                const isDeleting = deletingId === row.id

                return (
                  <tr key={row.id} className="bg-white dark:bg-transparent">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editDraftSku}
                          onChange={(event) => setEditDraftSku(event.target.value)}
                          className="w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-cyan-500/50 dark:bg-white/5 dark:text-slate-100"
                        />
                      ) : (
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.sku}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editDraftName}
                          onChange={(event) => setEditDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSaveEdit(row)
                            if (event.key === 'Escape') handleCancelEdit()
                          }}
                          className="w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-cyan-500/50 dark:bg-white/5 dark:text-slate-100"
                        />
                      ) : (
                        <span className="text-sm text-slate-700 dark:text-slate-300">{row.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(row)}
                              disabled={isSaving}
                              className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(row)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={isDeleting}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
