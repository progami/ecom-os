'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import {
  dateValidator,
  formatNumericInput,
  formatPercentInput,
  numericValidator,
  parseNumericInput,
} from '@/components/sheets/validators'

registerAllModules()

export type PurchasePaymentRow = {
  id: string
  purchaseOrderId: string
  orderCode: string
  category: string
  label: string
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

export interface PaymentSummary {
  plannedAmount: number
  plannedPercent: number
  actualAmount: number
  actualPercent: number
  remainingAmount: number
  remainingPercent: number
}

interface PurchasePaymentsGridProps {
  payments: PurchasePaymentRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  onAddPayment?: () => void
  onRowsChange?: (rows: PurchasePaymentRow[]) => void
  isLoading?: boolean
  orderSummaries?: Map<string, PaymentSummary>
  summaryLine?: string | null
}

const HEADERS = ['PO', 'Invoice', '#', 'Due Date', 'Percent', 'Amount', 'Status']

const COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', readOnly: true, className: 'cell-readonly' },
  { data: 'label', readOnly: true, className: 'cell-readonly' },
  { data: 'paymentIndex', readOnly: true, className: 'cell-readonly' },
  {
    data: 'dueDate',
    type: 'date',
    dateFormat: 'MMM D YYYY',
    correctFormat: true,
    className: 'cell-editable',
    validator: dateValidator,
    allowInvalid: false,
  },
  { data: 'percentage', type: 'numeric', numericFormat: { pattern: '0.00%' }, readOnly: true, className: 'cell-readonly' },
  {
    data: 'amount',
    type: 'numeric',
    numericFormat: { pattern: '$0,0.00' },
    className: 'cell-editable',
    validator: numericValidator,
    allowInvalid: false,
  },
  {
    data: 'status',
    type: 'dropdown',
    source: ['pending', 'scheduled', 'paid', 'cancelled'],
    className: 'cell-editable',
  },
]

const NUMERIC_FIELDS: Array<keyof PurchasePaymentRow> = ['amount']

function normalizeNumeric(value: unknown) {
  return formatNumericInput(value, 2)
}

function normalizePercent(value: unknown) {
  return formatPercentInput(value, 4)
}

export function PurchasePaymentsGrid({ payments, activeOrderId, onSelectOrder, onAddPayment, onRowsChange, isLoading, orderSummaries, summaryLine }: PurchasePaymentsGridProps) {
  const [isClient, setIsClient] = useState(false)
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, PaymentUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const data = useMemo(() => {
    const scoped = activeOrderId ? payments.filter((payment) => payment.purchaseOrderId === activeOrderId) : payments
    return scoped.map((payment) => ({ ...payment }))
  }, [activeOrderId, payments])

  const summary = activeOrderId ? orderSummaries?.get(activeOrderId) : undefined

  const isFullyAllocated = useMemo(() => {
    if (!summary) return false
    const amountTolerance = Math.max(summary.plannedAmount * 0.001, 0.01)
    const percentTolerance = Math.max(summary.plannedPercent * 0.001, 0.001)
    const amountCleared = summary.plannedAmount > 0 && summary.remainingAmount <= amountTolerance
    const percentCleared = summary.plannedPercent > 0 && summary.remainingPercent <= percentTolerance
    return amountCleared || percentCleared
  }, [summary])

  const computedSummaryLine = useMemo(() => {
    if (!summary) return null
    const parts: string[] = []
    parts.push(`Plan ${summary.plannedAmount.toFixed(2)}`)
    if (summary.plannedAmount > 0) {
      const paidPercent = Math.max(summary.actualPercent * 100, 0).toFixed(1)
      parts.push(`Paid ${summary.actualAmount.toFixed(2)} (${paidPercent}%)`)
      if (summary.remainingAmount > 0.01) {
        parts.push(`Remaining ${summary.remainingAmount.toFixed(2)}`)
      } else if (summary.remainingAmount < -0.01) {
        parts.push(`Cleared (+$${Math.abs(summary.remainingAmount).toFixed(2)})`)
      } else {
        parts.push('Cleared')
      }
    } else {
      parts.push(`Paid ${summary.actualAmount.toFixed(2)}`)
    }
    return parts.join(' • ')
  }, [summary])

  const summaryText = summaryLine ?? computedSummaryLine

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
        const res = await fetch('/api/v1/x-plan/purchase-order-payments', {
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

  if (!isClient) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Payments
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {summaryText && <span>{summaryText}</span>}
          <button
            onClick={() => {
              if (onAddPayment) void onAddPayment()
            }}
            disabled={!activeOrderId || isLoading || isFullyAllocated}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:enabled:hover:bg-slate-800"
          >
            Add payment
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
        className="x-plan-hot"
        dropdownMenu
        filters
        cells={(row) => {
          const meta = {} as Handsontable.CellMeta
          const record = data[row]
          if (record && activeOrderId && record.purchaseOrderId === activeOrderId) {
            meta.className = meta.className ? `${meta.className} row-active` : 'row-active'
          }
          return meta
        }}
        afterSelectionEnd={(row) => {
          if (!onSelectOrder) return
          const record = data[row]
          if (record) onSelectOrder(record.purchaseOrderId)
        }}
        afterChange={(changes, rawSource) => {
          const source = String(rawSource)
          if (!changes || source === 'loadData' || source === 'derived-update') return
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
              const normalizedAmount = normalizeNumeric(newValue)
              entry.values[prop] = normalizedAmount
              const plannedAmount = orderSummaries?.get(record.purchaseOrderId)?.plannedAmount ?? 0
              const numericAmount = parseNumericInput(normalizedAmount) ?? 0
              if (plannedAmount > 0 && Number.isFinite(numericAmount)) {
                const amountTolerance = Math.max(plannedAmount * 0.001, 0.01)
                const totalAmount = (hot.getSourceData() as PurchasePaymentRow[])
                  .filter((row) => row.purchaseOrderId === record.purchaseOrderId)
                  .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

                if (totalAmount > plannedAmount + amountTolerance) {
                  const previousAmountString = _oldValue == null || _oldValue === '' ? '0.00' : normalizeNumeric(_oldValue)
                  entry.values.amount = previousAmountString
                  const previousPercent = normalizePercent(
                    plannedAmount > 0 ? Number(previousAmountString ?? 0) / plannedAmount : 0
                  )
                  entry.values.percentage = previousPercent
                  hot.setDataAtRowProp(rowIndex, 'amount', previousAmountString, 'derived-update')
                  hot.setDataAtRowProp(rowIndex, 'percentage', previousPercent, 'derived-update')
                  toast.error('Payments exceed the PO total. Adjust amounts before adding more.')
                  continue
                }

                const derivedPercent = numericAmount / plannedAmount
                const normalizedPercent = normalizePercent(derivedPercent)
                entry.values.percentage = normalizedPercent
                hot.setDataAtRowProp(rowIndex, 'percentage', normalizedPercent, 'derived-update')
              }
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
