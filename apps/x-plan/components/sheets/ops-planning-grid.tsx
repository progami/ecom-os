'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { dateValidator, formatNumericInput, numericValidator } from '@/components/sheets/validators'

registerAllModules()

export type OpsInputRow = {
  id: string
  productId: string
  orderCode: string
  poDate: string
  shipName: string
  containerNumber: string
  productName: string
  quantity: string
  pay1Date: string
  productionWeeks: string
  sourceWeeks: string
  oceanWeeks: string
  finalWeeks: string
  sellingPrice: string
  manufacturingCost: string
  freightCost: string
  tariffRate: string
  tacosPercent: string
  fbaFee: string
  referralRate: string
  storagePerMonth: string
  status: string
  notes: string
}

interface OpsPlanningGridProps {
  rows: OpsInputRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  onRowsChange?: (rows: OpsInputRow[]) => void
  onCreateOrder?: () => void
  onDeleteOrder?: (orderId: string) => void
  disableCreate?: boolean
  disableDelete?: boolean
}

const COLUMN_HEADERS = [
  'PO Code',
  'PO Date',
  'Ship',
  'Container #',
  'Prod. (wk)',
  'Source (wk)',
  'Ocean (wk)',
  'Final (wk)',
  'Notes',
]

const COLUMN_SETTINGS: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', className: 'cell-editable', width: 150 },
  {
    data: 'poDate',
    type: 'date',
    dateFormat: 'MMM D YYYY',
    correctFormat: true,
    className: 'cell-editable',
    width: 150,
    validator: dateValidator,
    allowInvalid: false,
  },
  {
    data: 'shipName',
    type: 'text',
    className: 'cell-editable',
    width: 160,
  },
  {
    data: 'containerNumber',
    type: 'text',
    className: 'cell-editable',
    width: 160,
  },
  {
    data: 'productionWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
    validator: numericValidator,
    allowInvalid: false,
  },
  {
    data: 'sourceWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
    validator: numericValidator,
    allowInvalid: false,
  },
  {
    data: 'oceanWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
    validator: numericValidator,
    allowInvalid: false,
  },
  {
    data: 'finalWeeks',
    type: 'numeric',
    numericFormat: { pattern: '0.00' },
    className: 'cell-editable text-right',
    width: 120,
    validator: numericValidator,
    allowInvalid: false,
  },
  { data: 'notes', className: 'cell-editable', width: 200 },
]

const NUMERIC_PRECISION: Partial<Record<keyof OpsInputRow, number>> = {
  quantity: 0,
  productionWeeks: 2,
  sourceWeeks: 2,
  oceanWeeks: 2,
  finalWeeks: 2,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  tariffRate: 4,
  tacosPercent: 4,
  fbaFee: 2,
  referralRate: 4,
  storagePerMonth: 2,
}

const NUMERIC_FIELDS = new Set<keyof OpsInputRow>([
  'quantity',
  'productionWeeks',
  'sourceWeeks',
  'oceanWeeks',
  'finalWeeks',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffRate',
  'tacosPercent',
  'fbaFee',
  'referralRate',
  'storagePerMonth',
])
const DATE_FIELDS = new Set<keyof OpsInputRow>(['poDate', 'pay1Date'])

function normalizeNumeric(value: unknown, fractionDigits = 2) {
  return formatNumericInput(value, fractionDigits)
}

export function OpsPlanningGrid({
  rows,
  activeOrderId,
  onSelectOrder,
  onRowsChange,
  onCreateOrder,
  onDeleteOrder,
  disableCreate,
  disableDelete,
}: OpsPlanningGridProps) {
  const [isClient, setIsClient] = useState(false)
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, { id: string; values: Record<string, string> }>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const data = useMemo(() => rows, [rows])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values())
      if (payload.length === 0) return
      pendingRef.current.clear()
      try {
        const response = await fetch('/api/v1/x-plan/purchase-orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update purchase orders')
        toast.success('PO inputs saved')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save purchase order inputs')
      }
    }, 500)
  }

  const handleDeleteClick = () => {
    if (!onDeleteOrder || !activeOrderId || disableDelete) return
    onDeleteOrder(activeOrderId)
  }

  if (!isClient) {
    return (
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            PO table
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage purchase order timing and status; the highlighted row stays in sync with the detail view.
          </p>
        </div>
        {(onCreateOrder || onDeleteOrder) && (
          <div className="flex flex-wrap gap-2">
            {onCreateOrder ? (
              <button
                type="button"
                onClick={onCreateOrder}
                disabled={Boolean(disableCreate)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
              >
                Add purchase order
              </button>
            ) : null}
            {onDeleteOrder ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={Boolean(disableDelete) || !activeOrderId}
                className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600 transition enabled:hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:text-rose-300 dark:enabled:hover:bg-rose-500/10"
              >
                Remove selected
              </button>
            ) : null}
          </div>
        )}
      </div>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        columns={COLUMN_SETTINGS}
        colHeaders={COLUMN_HEADERS}
        stretchH="all"
        className="x-plan-hot"
        rowHeaders={false}
        height="auto"
        dropdownMenu
        filters
        cells={(row) => {
          const meta = {} as Handsontable.CellMeta
          const record = data[row]
          if (record && activeOrderId && record.id === activeOrderId) {
            meta.className = meta.className ? `${meta.className} row-active` : 'row-active'
          }
          return meta
        }}
        afterSelectionEnd={(row) => {
          if (!onSelectOrder) return
          const record = data[row]
          if (record) onSelectOrder(record.id)
        }}
        afterChange={(changes, rawSource) => {
          if (!changes || rawSource === 'loadData') return
          const hot = hotRef.current
          if (!hot) return

          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof OpsInputRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as OpsInputRow | null
            if (!record) continue

            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue

            if (NUMERIC_FIELDS.has(prop)) {
              const precision = NUMERIC_PRECISION[prop] ?? 2
              const normalized = normalizeNumeric(newValue, precision)
              entry.values[prop] = normalized
              record[prop] = normalized as OpsInputRow[typeof prop]
            } else if (DATE_FIELDS.has(prop)) {
              const value = newValue ? String(newValue) : ''
              entry.values[prop] = value
              record[prop] = value as OpsInputRow[typeof prop]
            } else {
              const value = newValue == null ? '' : String(newValue)
              entry.values[prop] = value
              record[prop] = value as OpsInputRow[typeof prop]
            }
          }

          if (onRowsChange) {
            const updated = (hot.getSourceData() as OpsInputRow[]).map((row) => ({ ...row }))
            onRowsChange(updated)
          }

          flush()
        }}
      />
    </section>
  )
}
