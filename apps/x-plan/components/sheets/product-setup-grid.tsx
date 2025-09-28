'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface ProductSetupGridProps {
  products: Array<{ id: string; sku: string; name: string }>
}

type ProductRow = {
  id: string
  sku: string
  name: string
}

function formatNumeric(value: number | null | undefined, fractionDigits = 0) {
  if (value == null || Number.isNaN(value)) return ''.padEnd(fractionDigits > 0 ? fractionDigits + 2 : 0, '0')
  return Number(value).toFixed(fractionDigits)
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

export function ProductSetupGrid({ products }: ProductSetupGridProps) {
  const initialRows = useMemo(() => normalizeProducts(products), [products])
  const [rows, setRows] = useState<ProductRow[]>(initialRows)
  const [creatingSku, setCreatingSku] = useState('')
  const [creatingName, setCreatingName] = useState('')
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
      const response = await fetch('/api/v1/x-plan/products', {
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
      toast.success('Product added')
    } catch (error) {
      console.error(error)
      toast.error('Unable to add product')
    } finally {
      setIsCreating(false)
    }
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
      const response = await fetch('/api/v1/x-plan/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: row.id, values: { sku: nextSku, name: nextName } }] }),
      })
      if (!response.ok) throw new Error('Failed to save product')
      setRows((previous) =>
        normalizeProducts(
          previous.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  sku: nextSku,
                  name: nextName,
                }
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
    if (!window.confirm(`Remove ${row.name}?`)) return
    setDeletingId(row.id)
    try {
      const response = await fetch('/api/v1/x-plan/products', {
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
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">Catalogue</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Product roster</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Maintain the SKUs that fuel Ops, Sales, and Finance planning. Add products once and reuse the data everywhere—no year-specific copies required.
          </p>
        </div>
        <form
          className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:border-transparent sm:bg-transparent sm:p-0 lg:w-auto"
          onSubmit={(event) => {
            event.preventDefault()
            handleCreateProduct()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="new-sku" className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              SKU
            </label>
            <input
              id="new-sku"
              value={creatingSku}
              onChange={(event) => setCreatingSku(event.target.value)}
              placeholder="e.g. CS-007"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-600"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-name" className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Product name
            </label>
            <input
              id="new-name"
              value={creatingName}
              onChange={(event) => setCreatingName(event.target.value)}
              placeholder="Amazon Choice Sample"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-600"
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:enabled:hover:bg-slate-200"
          >
            {isCreating ? 'Adding…' : 'Add product'}
          </button>
        </form>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">SKU</th>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No products yet. Add your first SKU above to populate the planning catalogue.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isEditing = editingId === row.id
                const isSaving = savingId === row.id
                const isDeletingRow = deletingId === row.id
                return (
                  <tr key={row.id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editDraftSku}
                          onChange={(event) => setEditDraftSku(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-600"
                        />
                      ) : (
                        <span className="font-medium text-slate-700 dark:text-slate-200">{row.sku || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editDraftName}
                          onChange={(event) => setEditDraftName(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-600"
                        />
                      ) : (
                        <span className="text-slate-700 dark:text-slate-200">{row.name || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(row)}
                              disabled={isSaving}
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:enabled:hover:bg-slate-200"
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(row)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={isDeletingRow}
                              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600 transition enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:text-rose-300 dark:enabled:hover:bg-rose-500/10"
                            >
                              {isDeletingRow ? 'Removing…' : 'Delete'}
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
    </section>
  )
}
