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

type PaymentRow = {
  id: string
  purchaseOrderId: string
  orderCode: string
  paymentIndex: number
  dueDate: string
  percentage: string
  amount: string
  status: string
}

type PaymentUpdate = {
  id: string
  values: Partial<Record<keyof PaymentRow, string>>
}

interface PurchasePaymentsGridProps {
  payments: PaymentRow[]
}

const HEADERS = ['PO', '#', 'Due Date', 'Percent', 'Amount', 'Status']

const COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', readOnly: true, className: 'cell-readonly' },
  { data: 'paymentIndex', readOnly: true, className: 'cell-readonly' },
  { data: 'dueDate', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'percentage', type: 'numeric', numericFormat: { pattern: '0.00%' }, className: 'cell-editable' },
  { data: 'amount', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, className: 'cell-editable' },
  {
    data: 'status',
    type: 'dropdown',
    source: ['pending', 'scheduled', 'paid', 'cancelled'],
    className: 'cell-editable',
  },
]

const NUMERIC_FIELDS: Array<keyof PaymentRow> = ['percentage', 'amount']

function normalizeNumeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function PurchasePaymentsGrid({ payments }: PurchasePaymentsGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, PaymentUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const data = useMemo(() => payments.map((payment) => ({ ...payment })), [payments])

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
        const res = await fetch('/api/v1/cross-plan/purchase-order-payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!res.ok) throw new Error('Failed to update payments')
        toast.success('Payment schedule updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to update payment schedule')
      }
    }, 400)
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Supplier Payments</h2>
        <GridLegend hint="Add additional payments in the spreadsheet or upcoming form flow." />
      </div>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={HEADERS}
        columns={COLUMNS}
        rowHeaders={false}
        height="auto"
        stretchH="all"
        className="cross-plan-hot"
        dropdownMenu
        filters
        afterChange={(changes, source) => {
          if (!changes || source === 'loadData') return
          const hot = hotRef.current
          if (!hot) return
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof PaymentRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as PaymentRow | null
            if (!record) continue
            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue
            if (prop === 'dueDate') {
              entry.values[prop] = newValue ?? ''
            } else if (NUMERIC_FIELDS.includes(prop)) {
              entry.values[prop] = normalizeNumeric(newValue)
            } else {
              entry.values[prop] = String(newValue ?? '')
            }
          }
          flush()
        }}
      />
    </div>
  )
}
