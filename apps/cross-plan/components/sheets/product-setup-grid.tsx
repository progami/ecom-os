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
}

type ProductUpdate = {
  id: string
  values: Partial<Record<keyof ProductRow, string>>
}

interface ProductSetupGridProps {
  products: Array<ProductRow>
}

const PRICING_HEADERS = ['Selling Price', 'Manufacturing', 'Freight']
const PRICING_COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'sellingPrice', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'manufacturingCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'freightCost', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
]

const PERCENT_HEADERS = ['Tariff Rate', 'TACoS %', 'Referral %']
const PERCENT_COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'tariffRate', type: 'numeric', numericFormat: { pattern: '0.000%' }, className: 'cell-editable' },
  { data: 'tacosPercent', type: 'numeric', numericFormat: { pattern: '0.000%' }, className: 'cell-editable' },
  { data: 'amazonReferralRate', type: 'numeric', numericFormat: { pattern: '0.000%' }, className: 'cell-editable' },
]

const OPERATIONS_HEADERS = ['FBA Fee', 'Storage/Mo']
const OPERATIONS_COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'fbaFee', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  { data: 'storagePerMonth', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
]

function buildData(products: ProductSetupGridProps['products']) {
  return products.map((product) => ({ ...product }))
}

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

function normalizeNumeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function ProductSetupGrid({ products }: ProductSetupGridProps) {
  const pricingRef = useRef<Handsontable | null>(null)
  const percentRef = useRef<Handsontable | null>(null)
  const operationsRef = useRef<Handsontable | null>(null)
  const pendingUpdatesRef = useRef<Map<string, ProductUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const data = useMemo<ProductRow[]>(() => buildData(products), [products])

  useEffect(() => {
    pricingRef.current?.loadData(data)
    percentRef.current?.loadData(data)
    operationsRef.current?.loadData(data)
  }, [data])

  const queueFlush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingUpdatesRef.current.values())
      if (payload.length === 0) return
      pendingUpdatesRef.current.clear()
      try {
        const res = await fetch('/api/v1/cross-plan/products', {
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

  const makeChangeHandler = (getTable: () => Handsontable | null) =>
    (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => {
      if (!changes || source === 'loadData') return
      const hot = getTable()
      if (!hot) return
      const rowsRef = hot.getSourceData() as ProductRow[]

      for (const change of changes) {
        const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof ProductRow, any, any]
        if (newValue === undefined) continue
        const record = rowsRef[rowIndex]
        if (!record) continue
        if (!pendingUpdatesRef.current.has(record.id)) {
          pendingUpdatesRef.current.set(record.id, { id: record.id, values: {} })
        }
        const entry = pendingUpdatesRef.current.get(record.id)
        if (!entry) continue
        entry.values[prop] = NUMERIC_FIELDS.includes(prop) ? normalizeNumeric(newValue) : String(newValue ?? '')
      }

      queueFlush()
    }

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product Pricing</h2>
        <GridLegend hint="Blue cells accept edits; changes sync within a moment." />
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pricing & COGS</h3>
          <HotTable
            ref={(instance) => {
              pricingRef.current = instance?.hotInstance ?? null
            }}
            data={data}
            licenseKey="non-commercial-and-evaluation"
            colHeaders={['Product', ...PRICING_HEADERS]}
            columns={[{ data: 'name', readOnly: true, className: 'cell-readonly' }, ...PRICING_COLUMNS]}
            rowHeaders={false}
            height="auto"
            stretchH="all"
            className="cross-plan-hot"
            dropdownMenu
            filters
            afterChange={makeChangeHandler(() => pricingRef.current)}
            afterGetColHeader={(col, TH) => {
              if (col === 0) TH.classList.add('htLeft')
            }}
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fees & Marketing</h3>
          <HotTable
            ref={(instance) => {
              percentRef.current = instance?.hotInstance ?? null
            }}
            data={data}
            licenseKey="non-commercial-and-evaluation"
            colHeaders={['Product', ...PERCENT_HEADERS]}
            columns={[{ data: 'name', readOnly: true, className: 'cell-readonly' }, ...PERCENT_COLUMNS]}
            rowHeaders={false}
            height="auto"
            stretchH="all"
            className="cross-plan-hot"
            dropdownMenu
            filters
            afterChange={makeChangeHandler(() => percentRef.current)}
            afterGetColHeader={(col, TH) => {
              if (col === 0) TH.classList.add('htLeft')
            }}
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fulfillment & Storage</h3>
          <HotTable
            ref={(instance) => {
              operationsRef.current = instance?.hotInstance ?? null
            }}
            data={data}
            licenseKey="non-commercial-and-evaluation"
            colHeaders={['Product', ...OPERATIONS_HEADERS]}
            columns={[{ data: 'name', readOnly: true, className: 'cell-readonly' }, ...OPERATIONS_COLUMNS]}
            rowHeaders={false}
            height="auto"
            stretchH="all"
            className="cross-plan-hot"
            dropdownMenu
            filters
            afterChange={makeChangeHandler(() => operationsRef.current)}
            afterGetColHeader={(col, TH) => {
              if (col === 0) TH.classList.add('htLeft')
            }}
          />
        </section>
      </div>
    </div>
  )
}
