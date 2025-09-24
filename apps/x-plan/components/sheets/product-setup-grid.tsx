'use client'

import { useEffect, useMemo, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { GridLegend } from '@/components/grid-legend'

registerAllModules()

type ProductRow = {
  id: string
  name: string
  sellingPrice: string
  manufacturingCost: string
  freightCost: string
  tariffRate: string
  tacosPercent: string
  fbaFee: string
  amazonReferralRate: string
  storagePerMonth: string
  landedCost: string
  grossContribution: string
  grossMarginPercent: string
}

type ProductUpdate = {
  id: string
  values: Partial<Record<keyof ProductRow, string>>
}

interface ProductSetupGridProps {
  products: Array<ProductRow>
}

const COLUMN_HEADERS = [
  'Product',
  'Selling Price',
  'Manufacturing',
  'Freight',
  'Tariff %',
  'TACoS %',
  'FBA Fee',
  'Referral %',
  'Storage/Mo',
  'Landed Cost',
  'Gross Contribution',
  'Gross Margin %',
]

const COLUMN_CONFIG: Handsontable.ColumnSettings[] = [
  { data: 'name', readOnly: true, className: 'cell-readonly' },
  { data: 'sellingPrice', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'manufacturingCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'freightCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'tariffRate', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable' },
  { data: 'tacosPercent', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable' },
  { data: 'fbaFee', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'amazonReferralRate', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable' },
  { data: 'storagePerMonth', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'landedCost', readOnly: true, className: 'cell-readonly', type: 'numeric', numericFormat: { pattern: '$0,0.00' } },
  { data: 'grossContribution', readOnly: true, className: 'cell-readonly', type: 'numeric', numericFormat: { pattern: '$0,0.00' } },
  { data: 'grossMarginPercent', readOnly: true, className: 'cell-readonly', type: 'numeric', numericFormat: { pattern: '0.00%' } },
]

const NUMERIC_FIELDS: Array<keyof ProductRow> = [
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffRate',
  'tacosPercent',
  'fbaFee',
  'amazonReferralRate',
  'storagePerMonth',
]

const DERIVED_FIELDS: Array<keyof ProductRow> = ['landedCost', 'grossContribution', 'grossMarginPercent']

function normalizeNumeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

function parseNumeric(value: string) {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? 0 : numeric
}

function recalculateDerived(row: ProductRow) {
  const price = parseNumeric(row.sellingPrice)
  const manufacturing = parseNumeric(row.manufacturingCost)
  const freight = parseNumeric(row.freightCost)
  const tariffRate = parseNumeric(row.tariffRate)
  const tacosRate = parseNumeric(row.tacosPercent)
  const fba = parseNumeric(row.fbaFee)
  const storage = parseNumeric(row.storagePerMonth)

  const tariffCost = price * tariffRate
  const advertising = price * tacosRate
  const landedCost = manufacturing + freight + tariffCost + fba + storage
  const grossContribution = price - landedCost - advertising
  const marginPercent = price === 0 ? 0 : grossContribution / price

  row.landedCost = landedCost.toFixed(2)
  row.grossContribution = grossContribution.toFixed(2)
  row.grossMarginPercent = marginPercent.toFixed(4)
}

export function ProductSetupGrid({ products }: ProductSetupGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingUpdatesRef = useRef<Map<string, ProductUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const data = useMemo<ProductRow[]>(() => products.map((product) => ({ ...product })), [products])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

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
        toast.error('Unable to save product updates')
      }
    }, 500)
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product Pricing & Costs</h2>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={COLUMN_HEADERS}
        columns={COLUMN_CONFIG}
        rowHeaders={false}
        height="auto"
        stretchH="all"
        className="x-plan-hot"
        dropdownMenu
        filters
        afterGetColHeader={(col, TH) => {
          if (col === 0) TH.classList.add('htLeft')
        }}
        afterChange={(changes, source) => {
          const changeSource = String(source)
          if (!changes || changeSource === 'loadData' || changeSource === 'derived-update') return
          const hot = hotRef.current
          if (!hot) return
          const rowsRef = hot.getSourceData() as ProductRow[]
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof ProductRow, any, any]
            if (newValue === undefined) continue
            const record = rowsRef[rowIndex]
            if (!record) continue
            if (DERIVED_FIELDS.includes(prop)) continue
            if (!pendingUpdatesRef.current.has(record.id)) {
              pendingUpdatesRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingUpdatesRef.current.get(record.id)
            if (!entry) continue
            entry.values[prop] = NUMERIC_FIELDS.includes(prop) ? normalizeNumeric(newValue) : String(newValue ?? '')
            const updatedRow = {
              ...record,
              [prop]: entry.values[prop],
            }
            recalculateDerived(updatedRow)
            hot.setDataAtRowProp(rowIndex, 'landedCost', updatedRow.landedCost, 'derived-update')
            hot.setDataAtRowProp(rowIndex, 'grossContribution', updatedRow.grossContribution, 'derived-update')
            hot.setDataAtRowProp(rowIndex, 'grossMarginPercent', updatedRow.grossMarginPercent, 'derived-update')
            Object.assign(record, updatedRow)
          }
          queueFlush()
        }}
      />
    </section>
  )
}
