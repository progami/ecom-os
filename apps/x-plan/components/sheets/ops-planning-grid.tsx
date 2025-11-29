'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { toIsoDate } from '@/lib/utils/dates'
import { dateValidator, formatNumericInput, numericValidator } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'

registerAllModules()

export type OpsInputRow = {
  id: string
  productId: string
  orderCode: string
  poDate: string
  productionComplete: string
  sourceDeparture: string
  portEta: string
  availableDate: string
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

const BASE_HEADERS = [
  'PO Code',
  'PO Date',
  'Ship',
  'Container #',
  'Prod.',
  'Source',
  'Ocean',
  'Final',
  'Notes',
]

function addWeeks(base: Date, weeks: number): Date {
  const ms = base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000
  return new Date(ms)
}

function parseWeeks(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const COLUMN_SETTINGS_BASE: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', className: 'cell-editable', width: 150 },
  {
    data: 'poDate',
    type: 'date',
    dateFormat: 'YYYY-MM-DD',
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
  tariffRate: 2,
  tacosPercent: 2,
  fbaFee: 2,
  referralRate: 2,
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
const DATE_FIELDS = new Set<keyof OpsInputRow>([
  'poDate',
  'pay1Date',
  'productionComplete',
  'sourceDeparture',
  'portEta',
  'availableDate',
])

const STAGE_CONFIG = [
  { weeksKey: 'productionWeeks', overrideKey: 'productionComplete' },
  { weeksKey: 'sourceWeeks', overrideKey: 'sourceDeparture' },
  { weeksKey: 'oceanWeeks', overrideKey: 'portEta' },
  { weeksKey: 'finalWeeks', overrideKey: 'availableDate' },
] as const

type StageWeeksKey = (typeof STAGE_CONFIG)[number]['weeksKey']
type StageOverrideKey = (typeof STAGE_CONFIG)[number]['overrideKey']

const STAGE_OVERRIDE_FIELDS: Record<StageWeeksKey, StageOverrideKey> = STAGE_CONFIG.reduce(
  (map, item) => {
    map[item.weeksKey] = item.overrideKey
    return map
  },
  {} as Record<StageWeeksKey, StageOverrideKey>
)

function recomputeStageDates(
  record: OpsInputRow,
  entry: { values: Record<string, string | null> }
) {
  let working: OpsInputRow | null = null

  for (const stage of STAGE_CONFIG) {
    const baseRecord: OpsInputRow = working ?? record
    const end = resolveStageEnd(baseRecord, stage.weeksKey)
    const iso = end ? toIsoDate(end) ?? '' : ''
    const target = baseRecord[stage.overrideKey]
    if (target !== iso) {
      working = { ...baseRecord, [stage.overrideKey]: iso as OpsInputRow[StageOverrideKey] }
      entry.values[stage.overrideKey] = iso
    }
  }

  if (working) {
    Object.assign(record, working)
  }
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveStageStart(row: OpsInputRow, stage: StageWeeksKey): Date | null {
  const index = STAGE_CONFIG.findIndex((item) => item.weeksKey === stage)
  if (index <= 0) {
    return parseIsoDate(row.poDate)
  }
  const previous = STAGE_CONFIG[index - 1]
  const override = parseIsoDate(row[previous.overrideKey])
  if (override) return override
  const previousStart = resolveStageStart(row, previous.weeksKey)
  if (!previousStart) return null
  const previousWeeks = parseWeeks(row[previous.weeksKey])
  if (previousWeeks == null) return null
  return addWeeks(previousStart, previousWeeks)
}

function resolveStageEnd(row: OpsInputRow, stage: StageWeeksKey): Date | null {
  const override = parseIsoDate(row[STAGE_OVERRIDE_FIELDS[stage]])
  if (override) return override
  const start = resolveStageStart(row, stage)
  if (!start) return null
  const weeks = parseWeeks(row[stage])
  if (weeks == null) return null
  return addWeeks(start, weeks)
}

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
  const [stageMode, setStageMode] = useState<'weeks' | 'dates'>('weeks')
  const hotRef = useRef<Handsontable | null>(null)
  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string> }>) => {
      if (payload.length === 0) return
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/purchase-orders'), {
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
    },
    [],
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string> }
  >({
    debounceMs: 500,
    onFlush: handleFlush,
  })

  const data = useMemo(() => rows, [rows])

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const handleDeleteClick = () => {
    if (!onDeleteOrder || !activeOrderId || disableDelete) return
    onDeleteOrder(activeOrderId)
  }

  const columns = useMemo<Handsontable.ColumnSettings[]>(() => {
    if (stageMode === 'weeks') return COLUMN_SETTINGS_BASE
    const cols = COLUMN_SETTINGS_BASE.map((column) => ({ ...column }))
    const makeStageAccessor = (field: keyof OpsInputRow): Handsontable.ColumnSettings => ({
      data: ((rawRow: Handsontable.RowObject, value?: any) => {
        const row = rawRow as OpsInputRow
        const stageField = field as StageWeeksKey
        const overrideField = STAGE_OVERRIDE_FIELDS[stageField]
        if (value === undefined) {
          const endDate = resolveStageEnd(row, stageField)
          return toIsoDate(endDate) ?? ''
        }

        const iso = toIsoDate(value)
        const entry = pendingRef.current.get(row.id) ?? { id: row.id, values: {} }

        if (!iso) {
          row[overrideField] = '' as OpsInputRow[StageOverrideKey]
          entry.values[overrideField] = ''
          pendingRef.current.set(row.id, entry)
          scheduleFlush()
          return ''
        }

        const picked = new Date(`${iso}T00:00:00Z`)
        const stageStart = resolveStageStart(row, stageField)
        if (stageStart) {
          const diffDays = (picked.getTime() - stageStart.getTime()) / (24 * 60 * 60 * 1000)
          const weeks = diffDays / 7
          const normalized = formatNumericInput(weeks, 2)
          row[field] = normalized as any
          entry.values[field as string] = normalized
        }

        row[overrideField] = iso as OpsInputRow[StageOverrideKey]
        entry.values[overrideField] = iso
        pendingRef.current.set(row.id, entry)
        scheduleFlush()
        return iso
      }) as Handsontable.ColumnSettings['data'],
      type: 'date',
      dateFormat: 'YYYY-MM-DD',
      correctFormat: true,
      className: 'cell-editable',
      width: 150,
      validator: dateValidator,
      allowInvalid: false,
    })

    cols[4] = makeStageAccessor('productionWeeks')
    cols[5] = makeStageAccessor('sourceWeeks')
    cols[6] = makeStageAccessor('oceanWeeks')
    cols[7] = makeStageAccessor('finalWeeks')
    return cols
  }, [stageMode, pendingRef, scheduleFlush])

  const headers = useMemo(() => {
    if (stageMode === 'weeks') return ['PO Code','PO Date','Ship','Container #','Prod. (wk)','Source (wk)','Ocean (wk)','Final (wk)','Notes']
    return ['PO Code','PO Date','Ship','Container #','Prod. (date)','Source (date)','Ocean (date)','Final (date)','Notes']
  }, [stageMode])

  const handleColHeader = (col: number, TH: HTMLTableCellElement) => {
    if (col < 4 || col > 7) return
    Handsontable.dom.empty(TH)
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'x-plan-header-toggle'
    btn.textContent = stageMode === 'weeks' ? `${BASE_HEADERS[col]} (wk)` : `${BASE_HEADERS[col]} (date)`
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setStageMode((prev) => (prev === 'weeks' ? 'dates' : 'weeks'))
    })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    TH.appendChild(btn)
  }

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors logged in handleFlush
      })
    }
  }, [flushNow])

  if (!isClient) {
    return (
      <section className="space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-[#0c2537]" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            PO Table
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-200/80">
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
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
              >
                Add purchase order
              </button>
            ) : null}
            {onDeleteOrder ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={Boolean(disableDelete) || !activeOrderId}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
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
        columns={columns}
        colHeaders={headers}
        afterGetColHeader={(col, TH) => handleColHeader(col as number, TH as HTMLTableCellElement)}
        stretchH="all"
        className="x-plan-hot"
        rowHeaders={false}
        height="auto"
        undo
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
          const dirtyStageRows = new Set<string>()

          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof OpsInputRow | ((row: OpsInputRow, value?: any) => any), any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as OpsInputRow | null
            if (!record) continue

            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue

            if (typeof prop === 'function') {
              // handled inside accessor
              continue
            }

            if (NUMERIC_FIELDS.has(prop)) {
              const precision = NUMERIC_PRECISION[prop] ?? 2
              const normalized = normalizeNumeric(newValue, precision)
              entry.values[prop] = normalized
              record[prop] = normalized as OpsInputRow[typeof prop]
              if ((prop as string) in STAGE_OVERRIDE_FIELDS) {
                const overrideField = STAGE_OVERRIDE_FIELDS[prop as StageWeeksKey]
                entry.values[overrideField] = ''
                record[overrideField] = '' as OpsInputRow[StageOverrideKey]
                dirtyStageRows.add(record.id)
              }
            } else if (DATE_FIELDS.has(prop)) {
              const value = newValue ? String(newValue) : ''
              entry.values[prop] = value
              record[prop] = value as OpsInputRow[typeof prop]
              if (prop === 'poDate') {
                dirtyStageRows.add(record.id)
              }
            } else {
              const value = newValue == null ? '' : String(newValue)
              entry.values[prop] = value
              record[prop] = value as OpsInputRow[typeof prop]
            }
          }

          if (dirtyStageRows.size > 0) {
            for (const rowId of dirtyStageRows) {
              const sourceData = hot.getSourceData() as OpsInputRow[]
              const rowIndex = sourceData.findIndex((r: OpsInputRow) => r.id === rowId)
              if (rowIndex === -1) continue
              const record = sourceData[rowIndex] as OpsInputRow | null
              const entry = pendingRef.current.get(rowId)
              if (record && entry) {
                recomputeStageDates(record, entry as { values: Record<string, string | null> })
              }
            }
          }

          if (onRowsChange) {
            const updated = (hot.getSourceData() as OpsInputRow[]).map((row) => ({ ...row }))
            onRowsChange(updated)
          }

          scheduleFlush()
        }}
      />
    </section>
  )
}
