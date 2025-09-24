'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'

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
  const [newProductSku, setNewProductSku] = useState('')
  const [newProductName, setNewProductName] = useState('')

  useEffect(() => {
    dataRef.current = products.map(mapProductToRow)
    if (hotRef.current) {
      hotRef.current.loadData(dataRef.current)
    }
  }, [products])

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

  const handleAddProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const sku = newProductSku.trim()
    const name = newProductName.trim()
    if (!sku || !name) {
      toast.error('Enter both a SKU and product name')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/v1/x-plan/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, name }),
      })
      if (!res.ok) throw new Error('Failed to create product')
      const json = await res.json()
      const created = mapProductToRow(json.product)
      const updated = [...dataRef.current, created]
      dataRef.current = updated
      if (hotRef.current) {
        hotRef.current.loadData(updated)
        hotRef.current.selectCell(updated.length - 1, 0)
      }
      setSelectedProductId(created.id)
      setNewProductSku('')
      setNewProductName('')
      toast.success('Product added')
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

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Product catalogue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add SKUs and keep their names in sync — downstream sheets pick up the latest list automatically.
          </p>
        </div>
        <form onSubmit={handleAddProduct} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={newProductSku}
            onChange={(event) => setNewProductSku(event.target.value)}
            placeholder="SKU"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500"
          />
          <input
            value={newProductName}
            onChange={(event) => setNewProductName(event.target.value)}
            placeholder="Product name"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
          >
            {isCreating ? 'Adding…' : 'Add SKU'}
          </button>
        </form>
      </div>
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
    </section>
  )
}
