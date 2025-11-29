'use client'

import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  const handleConfirmDelete = async (row: ProductRow) => {
    setDeletingId(row.id)
    setConfirmDeleteId(null)
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
    <div className={clsx('space-y-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Product Catalog</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add and manage products that flow through your planning sheets
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {isAdding ? (
            <form
              className="flex w-full min-w-[260px] flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-md dark:border-white/10 dark:bg-white/5 dark:shadow-[0_14px_35px_rgba(1,18,32,0.45)] sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault()
                handleCreateProduct()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-left">
                  <span className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700 dark:text-cyan-200/80">SKU</span>
                  <input
                    value={creatingSku}
                    onChange={(event) => setCreatingSku(event.target.value)}
                    placeholder="e.g. CS-007"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#061d33]/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
                  />
                </label>
                <label className="flex flex-col gap-1 text-left">
                  <span className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700 dark:text-cyan-200/80">Product name</span>
                  <input
                    value={creatingName}
                    onChange={(event) => setCreatingName(event.target.value)}
                    placeholder="Amazon Choice Sample"
                    className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#061d33]/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  disabled={isCreating}
                  className="rounded-lg border border-slate-300 dark:border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 dark:text-slate-200 dark:hover:border-cyan-300/60 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-cyan-600 dark:bg-[#00c2b9] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white dark:text-[#002430] transition hover:bg-cyan-700 dark:bg-[#00a39e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? 'Adding…' : 'Add product'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center rounded-lg bg-cyan-600 dark:bg-[#00c2b9] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white dark:text-[#002430] shadow-md dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)] transition hover:bg-cyan-700 dark:bg-[#00a39e]"
            >
              New product
            </button>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-300 dark:border-white/12 bg-white dark:bg-white/5">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-white/10 text-sm text-slate-900 dark:text-slate-100">
          <thead className="bg-slate-100 dark:bg-white/5 text-xs uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-100/80">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">SKU</th>
              <th className="px-4 py-3 text-left font-semibold">Product</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center">
                  <div className="mx-auto max-w-sm space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5">
                      <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">No products yet</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Click &ldquo;New product&rdquo; to add your first SKU to the planning catalog.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isEditing = editingId === row.id
                const isSaving = savingId === row.id
                const isDeletingRow = deletingId === row.id
                const isConfirmingDelete = confirmDeleteId === row.id
                return (
                  <tr key={row.id} className="bg-white/5 transition hover:bg-white/10">
                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editDraftSku}
                          onChange={(event) => setEditDraftSku(event.target.value)}
                          className="w-full rounded-lg border border-cyan-400/50 bg-white dark:bg-[#061d33]/95 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                        />
                      ) : (
                        <span className="font-semibold tracking-wide text-slate-900 dark:text-white/90">{row.sku || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isEditing ? (
                        <input
                          value={editDraftName}
                          onChange={(event) => setEditDraftName(event.target.value)}
                          className="w-full rounded-lg border border-cyan-400/50 bg-white dark:bg-[#061d33]/95 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                        />
                      ) : (
                        <span className="text-slate-900 dark:text-slate-100/90">{row.name || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Remove {row.name}?</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(row)}
                            disabled={isDeletingRow}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white transition enabled:hover:bg-rose-700 dark:bg-rose-600 dark:enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeletingRow ? 'Removing…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-200 transition hover:border-slate-500 hover:text-slate-900 dark:hover:border-white/40 dark:hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(row)}
                                disabled={isSaving}
                                className="rounded-lg bg-cyan-600 dark:bg-[#00c2b9] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white dark:text-[#002430] transition enabled:hover:bg-cyan-700 dark:enabled:hover:bg-[#00a39e] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-200 transition hover:border-cyan-500 hover:text-cyan-700 dark:hover:border-cyan-300/60 dark:hover:text-white"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(row)}
                                className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-200 transition hover:border-cyan-500 hover:text-cyan-700 dark:hover:border-cyan-300/60 dark:hover:text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(row.id)}
                                className="rounded-lg border border-rose-400/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 transition enabled:hover:border-rose-500 enabled:hover:bg-rose-50 enabled:hover:text-rose-700 dark:text-rose-400 dark:enabled:hover:bg-rose-950/30 dark:enabled:hover:text-rose-300"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
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
