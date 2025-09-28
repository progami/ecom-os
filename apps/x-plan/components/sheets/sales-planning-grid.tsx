'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatNumericInput, numericValidator } from '@/components/sheets/validators'

registerAllModules()

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

type ColumnMeta = Record<string, { productId: string; field: string }>
type NestedHeaderCell = string | { label: string; colspan?: number; rowspan?: number }
type HandsontableNestedHeaders = NonNullable<Handsontable.GridSettings['nestedHeaders']>
const editableMetrics = new Set(['actualSales', 'forecastSales'])

function isEditableMetric(field: string | undefined) {
  return Boolean(field && editableMetrics.has(field))
}

type SalesUpdate = {
  productId: string
  weekNumber: number
  values: Record<string, string>
}

type SalesPlanningFocusContextValue = {
  focusProductId: string
  setFocusProductId: (value: string) => void
}

const SalesPlanningFocusContext = createContext<SalesPlanningFocusContextValue | null>(null)

export function SalesPlanningFocusProvider({ children }: { children: ReactNode }) {
  const [focusProductId, setFocusProductId] = useState<string>('ALL')
  const value = useMemo(() => ({ focusProductId, setFocusProductId }), [focusProductId])
  return <SalesPlanningFocusContext.Provider value={value}>{children}</SalesPlanningFocusContext.Provider>
}

export function SalesPlanningFocusControl({ productOptions }: { productOptions: Array<{ id: string; name: string }> }) {
  const context = useContext(SalesPlanningFocusContext)
  if (!context) return null
  const { focusProductId, setFocusProductId } = context

  return (
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
  )
}

interface SalesPlanningGridProps {
  rows: SalesRow[]
  columnMeta: ColumnMeta
  nestedHeaders: NestedHeaderCell[][]
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
  stockWarningWeeks: number
}

export function SalesPlanningGrid({ rows, columnMeta, nestedHeaders, columnKeys, productOptions, stockWarningWeeks }: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, SalesUpdate>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusContext = useContext(SalesPlanningFocusContext)
  const [fallbackFocusProductId] = useState<string>('ALL')
  const focusProductId = focusContext?.focusProductId ?? fallbackFocusProductId
  const warningThreshold = Number.isFinite(stockWarningWeeks) ? stockWarningWeeks : Number.POSITIVE_INFINITY
  const router = useRouter()

  const data = useMemo(() => rows, [rows])

  useEffect(() => {
    if (!focusContext) return
    if (focusContext.focusProductId !== 'ALL' && !productOptions.some((option) => option.id === focusContext.focusProductId)) {
      focusContext.setFocusProductId('ALL')
    }
  }, [focusContext, productOptions])

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
        base.push({ data: key, readOnly: true, className: 'cell-readonly', editor: false })
        continue
      }
      const editable = isEditableMetric(meta.field)
      base.push({
        data: key,
        type: 'numeric',
        numericFormat: editable ? { pattern: '0,0.00' } : { pattern: '0.00' },
        readOnly: !editable,
        editor: editable ? Handsontable.editors.NumericEditor : false,
        className: editable ? 'cell-editable' : 'cell-readonly',
        validator: editable ? numericValidator : undefined,
        allowInvalid: false,
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

  const flush = useCallback(() => {
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
        router.refresh()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save sales planning changes')
      }
    }, 600)
  }, [router])

  return (
    <div className="space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          3. Sales planning
        </h2>
      </div>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={false}
        columns={columns}
        nestedHeaders={nestedHeaders as unknown as HandsontableNestedHeaders}
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
          if (col < offset) {
            return cell
          }
          const key = columnKeys[col - offset]
          const meta = columnMeta[key]
          const editable = isEditableMetric(meta?.field)
          cell.readOnly = !editable
          cell.className = editable ? 'cell-editable' : 'cell-readonly'

          if (meta?.field === 'stockWeeks') {
            const record = data[row]
            const rawValue = record?.[key]
            const numeric = rawValue ? Number(rawValue) : Number.NaN
            if (!Number.isNaN(numeric) && numeric <= warningThreshold) {
              cell.className = cell.className ? `${cell.className} cell-warning` : 'cell-warning'
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
            const formatted = formatNumericInput(newValue)
            entry.values[meta.field] = formatted
            record[prop] = formatted
          }
          flush()
        }}
      />
    </div>
  )
}
