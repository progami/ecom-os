'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

registerAllModules()

type ProductRow = {
  id: string
  sku: string
  name: string
}

type ProductUpdate = {
  id: string
  values: Partial<Record<keyof ProductRow, string>>
}

interface ProductSetupGridProps {
  products: Array<{ id: string; sku: string; name: string }>
}

const COLUMN_HEADERS = ['SKU', 'Product Name']

const COLUMN_SETTINGS: Handsontable.ColumnSettings[] = [
  { data: 'sku', type: 'text', className: 'cell-editable htLeft' },
  { data: 'name', type: 'text', className: 'cell-editable htLeft' },
]

const EDITABLE_FIELDS = new Set<keyof ProductRow>(['sku', 'name'])

function mapProductToRow(product: ProductSetupGridProps['products'][number]): ProductRow {
  return {
    id: product.id,
    sku: product.sku ?? '',
    name: product.name ?? '',
  }
}

export function ProductSetupGrid({ products }: ProductSetupGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const dataRef = useRef<ProductRow[]>(products.map(mapProductToRow))
  const pendingUpdatesRef = useRef<Map<string, ProductUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()

  useEffect(() => {
    dataRef.current = products.map(mapProductToRow)
    if (hotRef.current) {
      hotRef.current.loadData(dataRef.current)
    }
  }, [products])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const queueFlush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingUpdatesRef.current.values())
      if (payload.length === 0) return
      pendingUpdatesRef.current.clear()
      try {
        const res = await fetch('/api/v1/x-plan/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!res.ok) throw new Error('Failed to save updates')
        toast.success('Product setup updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save product changes')
      }
    }, 400)
  }

  const handleAddProduct = async () => {
    const sku = window.prompt('Enter SKU')
    const name = window.prompt('Enter product name')
    const nextSku = sku?.trim() ?? ''
    const nextName = name?.trim() ?? ''
    if (!nextSku || !nextName) {
      toast.error('Enter both a SKU and product name')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/v1/x-plan/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: nextSku, name: nextName }),
      })
      if (!res.ok) throw new Error('Failed to create product')
      const json = await res.json()
      const created = mapProductToRow(json.product)
      const updated = [...dataRef.current, created].sort((a, b) => a.name.localeCompare(b.name))
      dataRef.current = updated
      if (hotRef.current) {
        hotRef.current.loadData(updated)
        const rowIndex = updated.findIndex((row) => row.id === created.id)
        if (rowIndex >= 0) hotRef.current.selectCell(rowIndex, 0)
      }
      setSelectedProductId(created.id)
      toast.success('Product added')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Unable to add product')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedProductId) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/v1/x-plan/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [selectedProductId] }),
      })
      if (!res.ok) throw new Error('Failed to delete product')
      pendingUpdatesRef.current.delete(selectedProductId)
      const remaining = dataRef.current.filter((row) => row.id !== selectedProductId)
      dataRef.current = remaining
      if (hotRef.current) {
        hotRef.current.loadData(remaining)
      }
      setSelectedProductId(null)
      toast.success('Product removed')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Unable to delete product')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSelection = (_row: number, _col: number, row2: number) => {
    const record = dataRef.current[row2]
    setSelectedProductId(record?.id ?? null)
  }

  const hasProducts = dataRef.current.length > 0

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">Catalogue</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Product setup</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage the SKU roster that powers Ops, Sales, and Finance planning.</p>
        </div>
        <button
          type="button"
          onClick={handleAddProduct}
          disabled={isCreating}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
        >
          {isCreating ? 'Adding…' : '+ Add SKU'}
        </button>
      </header>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={!selectedProductId || isDeleting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-rose-300 dark:enabled:hover:bg-rose-900/20"
        >
          {isDeleting ? 'Removing…' : 'Delete selected'}
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800">
        {isClient ? (
          <HotTable
            ref={(instance) => {
              hotRef.current = instance?.hotInstance ?? null
            }}
            data={dataRef.current}
            licenseKey="non-commercial-and-evaluation"
            colHeaders={COLUMN_HEADERS}
            columns={COLUMN_SETTINGS}
            rowHeaders={false}
            height="auto"
            stretchH="all"
            className="x-plan-hot"
            dropdownMenu
            filters
            afterGetColHeader={(col, TH) => {
              if (col <= 1) TH.classList.add('htLeft')
            }}
            afterSelection={handleSelection}
            afterDeselect={() => setSelectedProductId(null)}
            afterChange={(changes, source) => {
              const changeSource = String(source)
              if (!changes || changeSource === 'loadData') return
              const rows = dataRef.current

              for (const change of changes) {
                const [rowIndex, propKey, _oldValue, newValue] = change as [number, keyof ProductRow, any, any]
                if (!EDITABLE_FIELDS.has(propKey)) continue
                const record = rows[rowIndex]
                if (!record) continue

                const trimmed = typeof newValue === 'string' ? newValue.trim() : ''
                if (!trimmed) {
                  if (hotRef.current) {
                    hotRef.current.setDataAtRowProp(rowIndex, propKey, record[propKey], 'loadData')
                  }
                  continue
                }

                if (!pendingUpdatesRef.current.has(record.id)) {
                  pendingUpdatesRef.current.set(record.id, { id: record.id, values: {} })
                }
                const entry = pendingUpdatesRef.current.get(record.id)
                if (!entry) continue

                entry.values[propKey] = trimmed
                record[propKey] = trimmed
                if (hotRef.current) {
                  hotRef.current.setDataAtRowProp(rowIndex, propKey, trimmed, 'loadData')
                }
              }

              queueFlush()
            }}
          />
        ) : (
          <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" aria-hidden />
        )}
        {hasProducts ? null : (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Add your first SKU to start planning.</p>
        )}
      </div>
    </section>
  )
}
