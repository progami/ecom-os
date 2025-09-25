'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'

registerAllModules()

type ProductOption = { id: string; sku: string; name: string }

type SalesTermRow = {
  id: string
  productId: string
  productSku: string
  productName: string
  startDate: string
  endDate: string
  sellingPrice: number
  tacosPercent: number
  fbaFee: number
  referralRate: number
  storagePerMonth: number
}

type SalesTermUpdate = { id: string; values: Partial<Record<keyof SalesTermRow, string>> }

interface ProductSalesTermsGridProps {
  terms: SalesTermRow[]
  products: ProductOption[]
}

const COLUMN_HEADERS = [
  'SKU',
  'Product',
  'Start Date',
  'End Date',
  'Selling Price',
  'TACoS %',
  'FBA Fee',
  'Referral %',
  'Storage/Mo',
]

const NUMERIC_FIELD_KEYS = ['sellingPrice', 'tacosPercent', 'fbaFee', 'referralRate', 'storagePerMonth'] as const
type NumericFieldKey = (typeof NUMERIC_FIELD_KEYS)[number]
const NUMERIC_FIELDS = new Set<NumericFieldKey>(NUMERIC_FIELD_KEYS)

const DATE_FIELD_KEYS = ['startDate', 'endDate'] as const
type DateFieldKey = (typeof DATE_FIELD_KEYS)[number]
const DATE_FIELDS = new Set<DateFieldKey>(DATE_FIELD_KEYS)

function toCellValue(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeIsoDate(value: string | null | undefined) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function mapTerm(term: SalesTermRow): SalesTermRow {
  return { ...term }
}

export function ProductSalesTermsGrid({ terms, products }: ProductSalesTermsGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const dataRef = useRef<SalesTermRow[]>(terms.map(mapTerm))
  const pendingUpdatesRef = useRef<Map<string, SalesTermUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const skipNextDeselectRef = useRef(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    dataRef.current = terms.map(mapTerm)
    if (hotRef.current) {
      hotRef.current.loadData(dataRef.current)
    }
  }, [terms])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const productChoices = useMemo(() => {
    const choices = products.map((product) => product.sku).filter((sku) => sku.length > 0)
    if (choices.length > 0) {
      choices.unshift('')
    }
    return choices
  }, [products])

  const productBySku = useMemo(() => new Map(products.map((product) => [product.sku, product])), [products])

  const queueFlush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingUpdatesRef.current.values())
      if (payload.length === 0) return
      pendingUpdatesRef.current.clear()
      try {
        const response = await fetch('/api/v1/x-plan/product-sales-terms', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update sales terms')
        toast.success('Sales terms updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to update sales terms')
      } finally {
        flushTimeoutRef.current = null
      }
    }, 400)
  }

  const handleAddTerm = async () => {
    const sku = window.prompt('Enter SKU for the new sales term')
    const normalizedSku = sku?.trim() ?? ''
    if (!normalizedSku) {
      toast.error('Enter a valid SKU')
      return
    }
    const product = productBySku.get(normalizedSku)
    if (!product) {
      toast.error('Unknown SKU')
      return
    }

    const startInput = window.prompt('Enter start date (YYYY-MM-DD)')
    const startDate = normalizeIsoDate(startInput)
    if (!startDate) {
      toast.error('Enter a valid start date')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/v1/x-plan/product-sales-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, startDate }),
      })
      if (!response.ok) throw new Error('Failed to create sales term')
      const json = await response.json()
      const created: SalesTermRow = {
        id: json.term.id,
        productId: json.term.productId,
        productSku: product.sku,
        productName: product.name,
        startDate: normalizeIsoDate(json.term.startDate) ?? startDate,
        endDate: normalizeIsoDate(json.term.endDate),
        sellingPrice: Number(json.term.sellingPrice ?? 0),
        tacosPercent: Number(json.term.tacosPercent ?? 0),
        fbaFee: Number(json.term.fbaFee ?? 0),
        referralRate: Number(json.term.referralRate ?? 0),
        storagePerMonth: Number(json.term.storagePerMonth ?? 0),
      }
      const updated = [...dataRef.current, created].sort((a, b) => a.startDate.localeCompare(b.startDate))
      dataRef.current = updated
      if (hotRef.current) {
        hotRef.current.loadData(updated)
        const rowIndex = updated.findIndex((row) => row.id === created.id)
        if (rowIndex >= 0) hotRef.current.selectCell(rowIndex, 0)
      }
      setSelectedId(created.id)
      toast.success('Sales term added')
    } catch (error) {
      console.error(error)
      toast.error('Unable to add sales term')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedId) return
    setIsDeleting(true)
    try {
      const response = await fetch('/api/v1/x-plan/product-sales-terms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [selectedId] }),
      })
      if (!response.ok) throw new Error('Failed to delete sales term')
      pendingUpdatesRef.current.delete(selectedId)
      const remaining = dataRef.current.filter((row) => row.id !== selectedId)
      dataRef.current = remaining
      if (hotRef.current) {
        hotRef.current.loadData(remaining)
      }
      setSelectedId(null)
      toast.success('Sales term removed')
    } catch (error) {
      console.error(error)
      toast.error('Unable to delete sales term')
    } finally {
      setIsDeleting(false)
    }
  }

  const preserveSelectionForDelete = (event: MouseEvent<HTMLButtonElement>) => {
    skipNextDeselectRef.current = true
    event.preventDefault()
  }

  const columns = useMemo<Handsontable.ColumnSettings[]>(
    () => [
      {
        data: 'productSku',
        type: 'dropdown',
        source: productChoices,
        allowInvalid: false,
        strict: true,
        className: 'cell-editable htLeft',
        width: 140,
      },
      { data: 'productName', readOnly: true, className: 'cell-readonly htLeft', width: 200 },
      {
        data: 'startDate',
        type: 'date',
        dateFormat: 'YYYY-MM-DD',
        correctFormat: true,
        className: 'cell-editable htLeft',
        width: 140,
      },
      {
        data: 'endDate',
        type: 'date',
        dateFormat: 'YYYY-MM-DD',
        correctFormat: true,
        className: 'cell-editable htLeft',
        width: 140,
      },
      {
        data: 'sellingPrice',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable htRight',
        width: 140,
      },
      {
        data: 'tacosPercent',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        className: 'cell-editable htRight',
        width: 120,
      },
      {
        data: 'fbaFee',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable htRight',
        width: 120,
      },
      {
        data: 'referralRate',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        className: 'cell-editable htRight',
        width: 120,
      },
      {
        data: 'storagePerMonth',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable htRight',
        width: 140,
      },
    ],
    [productChoices]
  )

  const synchronizeProduct = (row: SalesTermRow) => {
    const product = productBySku.get(row.productSku)
    if (!product) {
      row.productId = ''
      row.productName = ''
      return row
    }
    row.productId = product.id
    row.productName = product.name
    return row
  }

  if (!isClient) return null

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">Sales</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Selling terms</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track price, fee, and advertising assumptions with effective dates per SKU.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddTerm}
          disabled={isCreating || products.length === 0}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
        >
          {isCreating ? 'Adding…' : '+ Add term'}
        </button>
      </header>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleDeleteSelected}
          onMouseDown={preserveSelectionForDelete}
          disabled={!selectedId || isDeleting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-rose-600 transition enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-rose-300 dark:enabled:hover:bg-rose-900/20"
        >
          {isDeleting ? 'Removing…' : 'Delete selected'}
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800">
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={dataRef.current}
          licenseKey="non-commercial-and-evaluation"
          colHeaders={COLUMN_HEADERS}
          columns={columns}
          rowHeaders={false}
          height="auto"
          stretchH="all"
          className="x-plan-hot"
          dropdownMenu
          filters
          afterSelection={(row, _col, row2) => {
            if (skipNextDeselectRef.current) {
              skipNextDeselectRef.current = false
              return
            }
            const record = dataRef.current[row2]
            setSelectedId(record?.id ?? null)
          }}
          afterDeselect={() => {
            if (skipNextDeselectRef.current) {
              skipNextDeselectRef.current = false
              return
            }
            setSelectedId(null)
          }}
          afterChange={(changes, source) => {
            const changeSource = String(source)
            if (!changes || changeSource === 'loadData') return
            const rows = dataRef.current
            for (const change of changes) {
              const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof SalesTermRow, any, any]
              const record = rows[rowIndex]
              if (!record) continue

              if (prop === 'productSku') {
                record.productSku = toCellValue(newValue)
                synchronizeProduct(record)
                pendingUpdatesRef.current.set(record.id, {
                  id: record.id,
                  values: {
                    productId: record.productId,
                  },
                })
                continue
              }

              if (DATE_FIELDS.has(prop as DateFieldKey)) {
                const key = prop as DateFieldKey
                const normalized = normalizeIsoDate(toCellValue(newValue))
                record[key] = normalized
                const update = pendingUpdatesRef.current.get(record.id) ?? { id: record.id, values: {} }
                update.values[key] = normalized
                pendingUpdatesRef.current.set(record.id, update)
                continue
              }

              if (NUMERIC_FIELDS.has(prop as NumericFieldKey)) {
                const key = prop as NumericFieldKey
                const numeric = Number(newValue)
                record[key] = Number.isNaN(numeric) ? 0 : numeric
                const update = pendingUpdatesRef.current.get(record.id) ?? { id: record.id, values: {} }
                update.values[key] = toCellValue(newValue)
                pendingUpdatesRef.current.set(record.id, update)
                continue
              }
            }
            queueFlush()
          }}
          afterGetColHeader={(col, TH) => {
            if (col === 0 || col === 1) {
              TH.classList.add('htLeft')
            } else {
              TH.classList.add('htRight')
            }
          }}
        />
      </div>
    </section>
  )
}
