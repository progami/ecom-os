'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'

registerAllModules()

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

type ColumnMeta = Record<string, { productId: string; field: string }>
type NestedHeaderCell = string | { label: string; colspan: number; rowspan?: number }
const editableMetrics = new Set(['actualSales', 'forecastSales'])

type SalesUpdate = {
  productId: string
  weekNumber: number
  values: Record<string, string>
}

interface SalesPlanningGridProps {
  rows: SalesRow[]
  columnMeta: ColumnMeta
  nestedHeaders: NestedHeaderCell[][]
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
  stockWarningWeeks: number
}

function normalizeEditableValue(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function SalesPlanningGrid({ rows, columnMeta, nestedHeaders, columnKeys, productOptions, stockWarningWeeks }: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, SalesUpdate>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [focusProductId, setFocusProductId] = useState<string>('ALL')
  const warningThreshold = Number.isFinite(stockWarningWeeks) ? stockWarningWeeks : Number.POSITIVE_INFINITY

  const data = useMemo(() => rows, [rows])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const columns: Handsontable.ColumnSettings[] = useMemo(() => {
    const base: Handsontable.ColumnSettings[] = [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly' },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly' },
    ]
    for (const key of columnKeys) {
      const meta = columnMeta[key]
      if (!meta) {
        base.push({ data: key, readOnly: true, className: 'cell-readonly' })
        continue
      }
      base.push({
        data: key,
        type: 'numeric',
        numericFormat: editableMetrics.has(meta.field) ? { pattern: '0,0.00' } : { pattern: '0.00' },
        readOnly: !editableMetrics.has(meta.field),
        className: editableMetrics.has(meta.field) ? 'cell-editable' : 'cell-readonly',
      })
    }
    return base
  }, [columnMeta, columnKeys])

  const hiddenColumns = useMemo(() => {
    if (focusProductId === 'ALL') return []
    const hidden: number[] = []
    const offset = 2
    columnKeys.forEach((key, index) => {
      const meta = columnMeta[key]
      if (!meta) return
      if (meta.productId !== focusProductId) {
        hidden.push(index + offset)
      }
    })
    return hidden
  }, [columnKeys, columnMeta, focusProductId])

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values())
      if (payload.length === 0) return
      pendingRef.current.clear()
      try {
        const response = await fetch('/api/v1/x-plan/sales-weeks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update sales planning')
        toast.success('Sales planning updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save sales planning changes')
      }
    }, 600)
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            3. Sales planning
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use the focus filter to isolate one SKU while keeping weekly totals intact.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Focus SKU</span>
          <select
            value={focusProductId}
            onChange={(event) => setFocusProductId(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Show all</option>
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={false}
        columns={columns}
        nestedHeaders={nestedHeaders}
        stretchH="all"
        className="x-plan-hot"
        height="auto"
        rowHeaders={false}
        dropdownMenu
        filters
        hiddenColumns={{ columns: hiddenColumns, indicators: true }}
        cells={(row, col) => {
          const cell: Handsontable.CellMeta = {}
          const offset = 2
          if (col >= offset) {
            const key = columnKeys[col - offset]
            const meta = columnMeta[key]
            if (meta?.field === 'stockWeeks') {
              const record = data[row]
              const rawValue = record?.[key]
              const numeric = rawValue ? Number(rawValue) : Number.NaN
              if (!Number.isNaN(numeric) && numeric <= warningThreshold) {
                cell.className = cell.className ? `${cell.className} cell-warning` : 'cell-warning'
              }
            }
          }
          return cell
        }}
        afterChange={(changes, source) => {
          if (!changes || source === 'loadData') return
          const hot = hotRef.current
          if (!hot) return
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, string, any, any]
            const meta = columnMeta[prop]
            if (!meta || !editableMetrics.has(meta.field)) continue
            const record = hot.getSourceDataAtRow(rowIndex) as SalesRow | null
            if (!record) continue
            const key = `${meta.productId}-${record.weekNumber}`
            if (!pendingRef.current.has(key)) {
              pendingRef.current.set(key, {
                productId: meta.productId,
                weekNumber: Number(record.weekNumber),
                values: {},
              })
            }
            const entry = pendingRef.current.get(key)
            if (!entry) continue
            entry.values[meta.field] = normalizeEditableValue(newValue)
          }
          flush()
        }}
      />
    </div>
  )
}
