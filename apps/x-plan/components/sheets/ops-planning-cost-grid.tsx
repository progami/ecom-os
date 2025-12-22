'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react-wrapper'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import { toast } from 'sonner'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { useHandsontableThemeName } from '@/hooks/useHandsontableThemeName'
import { finishEditingSafely } from '@/lib/handsontable'
import { formatNumericInput, formatPercentInput, numericValidator, sanitizeNumeric } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'
import { Info } from 'lucide-react'

registerAllModules()

export type OpsBatchRow = {
  id: string
  purchaseOrderId: string
  orderCode: string
  batchCode?: string
  productId: string
  productName: string
  quantity: string
  sellingPrice: string
  manufacturingCost: string
  freightCost: string
  tariffRate: string
  tacosPercent: string
  fbaFee: string
  referralRate: string
  storagePerMonth: string
}

interface OpsPlanningCostGridProps {
  rows: OpsBatchRow[]
  activeOrderId?: string | null
  activeBatchId?: string | null
  onSelectOrder?: (orderId: string) => void
  onSelectBatch?: (batchId: string) => void
  onRowsChange?: (rows: OpsBatchRow[]) => void
  onAddBatch?: () => void
  onDeleteBatch?: () => void
  disableAdd?: boolean
  disableDelete?: boolean
  products: Array<{ id: string; name: string }>
  onSync?: () => void
}

const COST_HEADERS = [
  'PO Code',
  'Product',
  'Qty',
  'Sell $',
  'Mfg $',
  'Freight $',
  'Tariff %',
  'TACoS %',
  'FBA $',
  'Referral %',
  'Storage $',
]

const NUMERIC_FIELDS = [
  'quantity',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'fbaFee',
  'storagePerMonth',
] as const
type NumericField = (typeof NUMERIC_FIELDS)[number]
const NUMERIC_PRECISION: Record<NumericField, number> = {
  quantity: 0,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  fbaFee: 2,
  storagePerMonth: 2,
}

const PERCENT_FIELDS = ['tariffRate', 'tacosPercent', 'referralRate'] as const
type PercentField = (typeof PERCENT_FIELDS)[number]
const PERCENT_PRECISION: Record<PercentField, number> = {
  tariffRate: 2,
  tacosPercent: 2,
  referralRate: 2,
}

const NUMERIC_FIELD_SET = new Set<string>(NUMERIC_FIELDS)
const PERCENT_FIELD_SET = new Set<string>(PERCENT_FIELDS)
const ABSOLUTE_ENTRY_FIELDS: ReadonlySet<NumericField> = new Set()

const SERVER_FIELD_MAP: Partial<Record<keyof OpsBatchRow, string>> = {
  quantity: 'quantity',
  sellingPrice: 'overrideSellingPrice',
  manufacturingCost: 'overrideManufacturingCost',
  freightCost: 'overrideFreightCost',
  tariffRate: 'overrideTariffRate',
  tacosPercent: 'overrideTacosPercent',
  fbaFee: 'overrideFbaFee',
  referralRate: 'overrideReferralRate',
  storagePerMonth: 'overrideStoragePerMonth',
}

function isNumericField(field: keyof OpsBatchRow): field is NumericField {
  return NUMERIC_FIELD_SET.has(field as string)
}

function isPercentField(field: keyof OpsBatchRow): field is PercentField {
  return PERCENT_FIELD_SET.has(field as string)
}

function normalizeCurrency(value: unknown, fractionDigits = 2) {
  return formatNumericInput(value, fractionDigits)
}

function normalizePercent(value: unknown, fractionDigits = 4) {
  return formatPercentInput(value, fractionDigits)
}

function normalizeAbsoluteCurrency(value: unknown, fractionDigits: number, quantity: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const total = sanitizeNumeric(value)
  if (Number.isNaN(total)) {
    return ''
  }
  const qty = sanitizeNumeric(quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return total.toFixed(fractionDigits)
  }
  return (total / qty).toFixed(fractionDigits)
}

export function OpsPlanningCostGrid({
  rows,
  activeOrderId,
  activeBatchId,
  onSelectOrder,
  onSelectBatch,
  onRowsChange,
  onAddBatch,
  onDeleteBatch,
  disableAdd,
  disableDelete,
  products,
  onSync,
}: OpsPlanningCostGridProps) {
  const [isClient, setIsClient] = useState(false)
  const themeName = useHandsontableThemeName()
  const hotRef = useRef<Handsontable | null>(null)
  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string | null> }>) => {
      if (payload.length === 0) return
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/purchase-orders/batches'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update batch cost overrides')
        toast.success('Batch cost saved')
        onSync?.()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save batch costs')
      }
    },
    [onSync],
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string | null> }
  >({
    debounceMs: 500,
    onFlush: handleFlush,
  })

  const data = useMemo(() => rows, [rows])
  const productOptions = useMemo(() => products.map((product) => ({ id: product.id, name: product.name })), [products])

  const columns = useMemo<Handsontable.ColumnSettings[]>(
    () => [
      { data: 'orderCode', readOnly: true, className: 'cell-readonly', width: 140 },
      {
        data: 'productName',
        type: 'dropdown',
        source: productOptions.map((option) => option.name),
        allowInvalid: productOptions.length === 0,
        className: 'cell-editable',
        width: 200,
      },
      {
        data: 'quantity',
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        className: 'cell-editable text-right',
        width: 110,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'sellingPrice',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable text-right',
        width: 120,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'manufacturingCost',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable text-right',
        width: 120,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'freightCost',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable text-right',
        width: 120,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'tariffRate',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        className: 'cell-editable text-right',
        width: 110,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'tacosPercent',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        className: 'cell-editable text-right',
        width: 110,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'fbaFee',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable text-right',
        width: 110,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'referralRate',
        type: 'numeric',
        numericFormat: { pattern: '0.00%' },
        className: 'cell-editable text-right',
        width: 110,
        validator: numericValidator,
        allowInvalid: false,
      },
      {
        data: 'storagePerMonth',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        className: 'cell-editable text-right',
        width: 120,
        validator: numericValidator,
        allowInvalid: false,
      },
    ],
    [productOptions]
  )

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors handled inside handleFlush
      })
    }
  }, [flushNow])

  useEffect(() => {
    setIsClient(true)
    const handlePointerDown = (event: PointerEvent) => {
      const hot = hotRef.current
      if (!hot) return
      const root = hot.rootElement
      if (root && !root.contains(event.target as Node)) {
        finishEditingSafely(hot)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [])

  if (!isClient) {
    return (
      <section className="space-y-3">
        <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-[#0c2537]" />
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            Batch Table
          </h2>
          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200/80">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/70 text-cyan-700 dark:border-cyan-300/40 dark:text-cyan-200">
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
            Values display per-unit. Enter total freight, manufacturing, or storage costs and we’ll normalize them by the batch quantity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddBatch ? (
            <button
              type="button"
              onClick={onAddBatch}
              disabled={Boolean(disableAdd)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add batch
            </button>
          ) : null}
          {onDeleteBatch ? (
            <button
              type="button"
              onClick={onDeleteBatch}
              disabled={Boolean(disableDelete) || !activeBatchId}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
            >
              Remove batch
            </button>
          ) : null}
        </div>
      </header>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        themeName={themeName}
        columns={columns}
        colHeaders={COST_HEADERS}
        stretchH="all"
        className="x-plan-hot"
        undo
        rowHeaders={false}
        height="auto"
        dropdownMenu
        filters
        cells={(row) => {
          const meta = {} as Handsontable.CellMeta
          const record = data[row]
          if (record && activeOrderId && record.purchaseOrderId === activeOrderId) {
            meta.className = meta.className ? `${meta.className} row-active` : 'row-active'
          }
          if (record && activeBatchId && record.id === activeBatchId) {
            meta.className = meta.className ? `${meta.className} row-active` : 'row-active'
          }
          return meta
        }}
        afterSelectionEnd={(row) => {
          const record = data[row]
          if (!record) return
          onSelectOrder?.(record.purchaseOrderId)
          onSelectBatch?.(record.id)
        }}
        afterChange={(changes, rawSource) => {
          if (!changes || rawSource === 'loadData') return
          const hot = hotRef.current
          if (!hot) return

          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof OpsBatchRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as OpsBatchRow | null
            if (!record) continue

            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue

            if (prop === 'productName') {
              const selected = productOptions.find((option) => option.name === newValue)
              if (!selected) {
                toast.error('Select a valid product')
                continue
              }
              entry.values.productId = selected.id
              record.productId = selected.id
              record.productName = selected.name
            } else if (prop === 'quantity') {
              const normalized = normalizeCurrency(newValue, NUMERIC_PRECISION.quantity)
              const serverKey = SERVER_FIELD_MAP[prop]
              if (serverKey) {
                entry.values[serverKey] = normalized === '' ? null : normalized
              }
              record.quantity = normalized
            } else if (isNumericField(prop)) {
              const precision = NUMERIC_PRECISION[prop]
              const normalized = normalizeCurrency(newValue, precision)
              const serverKey = SERVER_FIELD_MAP[prop]
              if (serverKey) {
                entry.values[serverKey] = normalized === '' ? null : normalized
              }
              record[prop] = normalized
            } else if (isPercentField(prop)) {
              const precision = PERCENT_PRECISION[prop]
              const normalized = normalizePercent(newValue, precision)
              const serverKey = SERVER_FIELD_MAP[prop]
              if (serverKey) {
                entry.values[serverKey] = normalized === '' ? null : normalized
              }
              record[prop] = normalized
            }
          }

          if (onRowsChange && hotRef.current) {
            const updated = (hotRef.current.getSourceData() as OpsBatchRow[]).map((row) => ({ ...row }))
            onRowsChange(updated)
          }

          scheduleFlush()
        }}
      />
    </section>
  )
}
