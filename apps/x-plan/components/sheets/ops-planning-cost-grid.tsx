'use client'

import { useEffect, useMemo, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import type { OpsInputRow } from '@/components/sheets/ops-planning-grid'

registerAllModules()

type NormalizedProductOption = { id: string; sku: string; name: string }

interface OpsPlanningCostGridProps {
  rows: OpsInputRow[]
  products: Array<{ id: string; sku?: string | null; name: string }>
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  onRowsChange?: (rows: OpsInputRow[]) => void
}

const COST_HEADERS = [
  'PO Code',
  'SKU',
  'Product',
  'Sell $',
  'Mfg $',
  'Freight $',
  'Tariff %',
  'TACoS %',
  'FBA $',
  'Referral %',
  'Storage $',
]

const NUMERIC_PRECISION: Record<string, number> = {
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  fbaFee: 2,
  storagePerMonth: 2,
}

const PERCENT_PRECISION: Record<string, number> = {
  tariffRate: 4,
  tacosPercent: 4,
  referralRate: 4,
}

function normalizeCurrency(value: unknown, fractionDigits = 2) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(fractionDigits)
}

function normalizePercent(value: unknown, fractionDigits = 4) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  const base = numeric > 1 ? numeric / 100 : numeric
  return base.toFixed(fractionDigits)
}

export function OpsPlanningCostGrid({ rows, products, activeOrderId, onSelectOrder, onRowsChange }: OpsPlanningCostGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, { id: string; values: Record<string, string> }>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const data = useMemo(() => rows, [rows])
  const productOptions = useMemo<NormalizedProductOption[]>(
    () =>
      products
        .map((product) => ({
          id: product.id,
          sku: product.sku?.trim() ?? '',
          name: product.name,
        }))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [products]
  )
  const skuChoices = useMemo(() => {
    const choices = productOptions.map((option) => option.sku).filter((sku) => sku.length > 0)
    if (rows.some((row) => !row.productSku)) {
      choices.unshift('')
    }
    return choices
  }, [productOptions, rows])
  const productBySku = useMemo(() => new Map(productOptions.map((option) => [option.sku, option])), [productOptions])
  const columns = useMemo<Handsontable.ColumnSettings[]>(
    () => [
      { data: 'orderCode', readOnly: true, className: 'cell-readonly', width: 140 },
      {
        data: 'productSku',
        type: 'dropdown',
        source: skuChoices,
        allowInvalid: false,
        strict: true,
        className: 'cell-editable',
        width: 140,
      },
      { data: 'productName', readOnly: true, className: 'cell-readonly', width: 200 },
      { data: 'sellingPrice', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable text-right', width: 120 },
      { data: 'manufacturingCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable text-right', width: 120 },
      { data: 'freightCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable text-right', width: 120 },
      { data: 'tariffRate', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable text-right', width: 110 },
      { data: 'tacosPercent', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable text-right', width: 110 },
      { data: 'fbaFee', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable text-right', width: 110 },
      { data: 'referralRate', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable text-right', width: 110 },
      { data: 'storagePerMonth', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable text-right', width: 120 },
    ],
    [skuChoices]
  )

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
        toast.success('Cost overrides saved')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save cost overrides')
      }
    }, 500)
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Batch Cost Overrides
          </h2>
        </div>
      </header>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        columns={columns}
        colHeaders={COST_HEADERS}
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
            const [rowIndex, prop, oldValue, newValue] = change as [number, keyof OpsInputRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as OpsInputRow | null
            if (!record) continue

            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue

            if (prop === 'productSku') {
              const sku = typeof newValue === 'string' ? newValue.trim() : ''
              if (!sku.length) {
                record.productSku = typeof oldValue === 'string' ? oldValue : record.productSku
                continue
              }
              const product = productBySku.get(sku)
              if (!product) {
                toast.error('Select a valid SKU')
                record.productSku = typeof oldValue === 'string' ? oldValue : record.productSku
                continue
              }
              entry.values.productId = product.id
              record.productId = product.id
              record.productSku = product.sku
              record.productName = product.name
              continue
            }

            if (prop in NUMERIC_PRECISION) {
              const precision = NUMERIC_PRECISION[prop as keyof typeof NUMERIC_PRECISION]
              const normalized = normalizeCurrency(newValue, precision)
              entry.values[prop] = normalized
              record[prop] = normalized as OpsInputRow[typeof prop]
            } else if (prop in PERCENT_PRECISION) {
              const precision = PERCENT_PRECISION[prop as keyof typeof PERCENT_PRECISION]
              const normalized = normalizePercent(newValue, precision)
              entry.values[prop] = normalized
              record[prop] = normalized as OpsInputRow[typeof prop]
            }
          }

          if (onRowsChange && hotRef.current) {
            const updated = (hotRef.current.getSourceData() as OpsInputRow[]).map((row) => ({ ...row }))
            onRowsChange(updated)
          }

          flush()
        }}
      />
    </section>
  )
}
