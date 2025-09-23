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

export type PurchasePaymentRow = {
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
  values: Partial<Record<keyof PurchasePaymentRow, string>>
}

interface PurchasePaymentsGridProps {
  payments: PurchasePaymentRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  onAddPayment?: () => void
  onRowsChange?: (rows: PurchasePaymentRow[]) => void
  isLoading?: boolean
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

const NUMERIC_FIELDS: Array<keyof PurchasePaymentRow> = ['percentage', 'amount']

function normalizeNumeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function PurchasePaymentsGrid({ payments, activeOrderId, onSelectOrder, onAddPayment, onRowsChange, isLoading }: PurchasePaymentsGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, PaymentUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const data = useMemo(() => {
    const scoped = activeOrderId ? payments.filter((payment) => payment.purchaseOrderId === activeOrderId) : payments
    return scoped.map((payment) => ({ ...payment }))
  }, [activeOrderId, payments])

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
        if (onRowsChange && hotRef.current) {
          const updated = (hotRef.current.getSourceData() as PurchasePaymentRow[]).map((row) => ({ ...row }))
          onRowsChange(updated)
        }
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
        <div className="flex items-center gap-2 text-xs">
          <GridLegend hint="Edit payout schedule per PO." />
          <button
            onClick={onAddPayment}
            disabled={!activeOrderId || isLoading}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
          >
            Add Payment
          </button>
        </div>
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
        cells={(row) => {
          const props: Handsontable.CellProperties = {}
          const record = data[row]
          if (record && activeOrderId && record.purchaseOrderId === activeOrderId) {
            props.className = props.className ? `${props.className} row-active` : 'row-active'
          }
          return props
        }}
        afterSelectionEnd={(row) => {
          if (!onSelectOrder) return
          const record = data[row]
          if (record) onSelectOrder(record.purchaseOrderId)
        }}
        afterChange={(changes, source) => {
          if (!changes || source === 'loadData') return
          const hot = hotRef.current
          if (!hot) return
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof PurchasePaymentRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as PurchasePaymentRow | null
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
