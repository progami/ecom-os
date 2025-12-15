'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react-wrapper'
import Handsontable from 'handsontable'
import Flatpickr from 'react-flatpickr'
import 'flatpickr/dist/themes/light.css'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { finishEditingSafely } from '@/lib/handsontable'
import { deriveIsoWeek, formatDateDisplay, toIsoDate } from '@/lib/utils/dates'
import {
  dateValidator,
  formatNumericInput,
  formatPercentInput,
  numericValidator,
  parseNumericInput,
} from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'

registerAllModules()

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export type PurchasePaymentRow = {
  id: string
  purchaseOrderId: string
  orderCode: string
  category: string
  label: string
  weekNumber: string
  paymentIndex: number
  dueDate: string
  dueDateValue?: Date | null
  dueDateIso: string | null
  dueDateDefault: string
  dueDateDefaultIso: string | null
  dueDateSource: 'SYSTEM' | 'USER'
  percentage: string
  amountExpected: string
  amountPaid: string
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
  onRemovePayment?: (paymentId: string) => Promise<void> | void
  onRowsChange?: (rows: PurchasePaymentRow[]) => void
  onSynced?: () => void
  isLoading?: boolean
  orderSummaries?: Map<string, PaymentSummary>
  summaryLine?: string | null
}

const HEADERS = ['PO', 'Invoice', 'Week', 'Due Date', 'Percent', 'Expected $', 'Paid $']

const COLUMNS: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', readOnly: true, className: 'cell-readonly' },
  { data: 'label', readOnly: true, className: 'cell-readonly' },
  { data: 'weekNumber', readOnly: true, className: 'cell-readonly text-center', width: 70 },
  {
    data: 'dueDateIso',
    editor: false,
    className: 'cell-editable',
    renderer: (instance, td, row, col, prop, value) => {
      const iso = typeof value === 'string' ? value : null
      td.textContent = iso ? formatDateDisplay(iso, dateFormatter) : ''
      return td
    },
  },
  { data: 'percentage', type: 'numeric', numericFormat: { pattern: '0.00%' }, readOnly: true, className: 'cell-readonly' },
  {
    data: 'amountExpected',
    type: 'numeric',
    numericFormat: { pattern: '$0,0.00' },
    readOnly: true,
    className: 'cell-readonly text-right',
  },
  {
    data: 'amountPaid',
    type: 'numeric',
    numericFormat: { pattern: '$0,0.00' },
    className: 'cell-editable',
    validator: numericValidator,
    allowInvalid: false,
  },
]

const NUMERIC_FIELDS: Array<keyof PurchasePaymentRow> = ['amountPaid']
type NumericField = (typeof NUMERIC_FIELDS)[number]

function normalizeNumeric(value: unknown) {
  return formatNumericInput(value, 2)
}

function normalizePercent(value: unknown) {
  return formatPercentInput(value, 4)
}

export function PurchasePaymentsGrid({
  payments,
  activeOrderId,
  onSelectOrder,
  onAddPayment,
  onRemovePayment,
  onRowsChange,
  onSynced,
  isLoading,
  orderSummaries,
  summaryLine,
}: PurchasePaymentsGridProps) {
  const [isClient, setIsClient] = useState(false)
  const hotRef = useRef<Handsontable | null>(null)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const handleFlush = useCallback(
    async (payload: PaymentUpdate[]) => {
      if (payload.length === 0) return
      try {
        const res = await fetch(withAppBasePath('/api/v1/x-plan/purchase-order-payments'), {
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
        onSynced?.()
      } catch (error) {
        console.error(error)
        toast.error('Unable to update payment schedule')
      }
    },
    [onRowsChange, onSynced],
  )

  const { pendingRef, scheduleFlush } = useMutationQueue<string, PaymentUpdate>({
    debounceMs: 400,
    onFlush: handleFlush,
  })
  const [picker, setPicker] = useState<{ row: number; left: number; top: number; value: string } | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const [keyEditor, setKeyEditor] = useState<{ row: number; left: number; top: number; value: string } | null>(null)
  const keyEditorRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!picker) return
    const handleOutside = (ev: MouseEvent) => {
      const target = ev.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setPicker(null)
      }
    }
    const handleEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPicker(null)
    }
    document.addEventListener('mousedown', handleOutside, true)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside, true)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [picker])

  useEffect(() => {
    if (keyEditor && keyEditorRef.current) {
      keyEditorRef.current.focus()
      keyEditorRef.current.select()
    }
  }, [keyEditor])

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

  const data = useMemo(() => {
    const scoped = activeOrderId ? payments.filter((payment) => payment.purchaseOrderId === activeOrderId) : payments
    return scoped.map((payment) => {
      const iso = payment.dueDateIso
      const value = iso ? new Date(`${iso}T00:00:00.000Z`) : null
      return { ...payment, dueDateValue: value }
    })
  }, [activeOrderId, payments])

  const summary = activeOrderId ? orderSummaries?.get(activeOrderId) : undefined

  useEffect(() => {
    setSelectedPaymentId(null)
  }, [activeOrderId])

  useEffect(() => {
    if (!selectedPaymentId) return
    const stillExists = payments.some((payment) => payment.id === selectedPaymentId)
    if (!stillExists) setSelectedPaymentId(null)
  }, [payments, selectedPaymentId])

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

  if (!isClient) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
          Payments
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-200/80">
          {summaryText && <span>{summaryText}</span>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedPaymentId || !onRemovePayment) return
                setIsRemoving(true)
                Promise.resolve(onRemovePayment(selectedPaymentId))
                  .then(() => setSelectedPaymentId(null))
                  .catch((error) => {
                    console.error(error)
                    toast.error('Unable to delete payment')
                  })
                  .finally(() => setIsRemoving(false))
              }}
              disabled={!selectedPaymentId || isLoading || isRemoving}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 shadow-sm transition enabled:hover:border-red-400 enabled:hover:bg-red-50 enabled:hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/40 dark:bg-transparent dark:text-red-200 dark:enabled:hover:border-red-300/70 dark:enabled:hover:bg-red-500/10"
            >
              Remove payment
            </button>
            <button
              type="button"
              onClick={() => {
                if (onAddPayment) void onAddPayment()
              }}
              disabled={!activeOrderId || isLoading}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add payment
            </button>
          </div>
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
        undo
        height="auto"
        stretchH="all"
        className="x-plan-hot"
        dropdownMenu
        filters
        contextMenu={{
          items: {
            delete_payment: {
              name: 'Delete payment',
              callback: (_, selection) => {
                if (!onRemovePayment || !selection || selection.length === 0) return
                const hot = hotRef.current
                if (!hot) return
                const rowIndex = selection[0].start.row
                const record = hot.getSourceDataAtRow(rowIndex) as PurchasePaymentRow | null
                if (!record?.id) return
                setIsRemoving(true)
                Promise.resolve(onRemovePayment(record.id))
                  .then(() => {
                    setSelectedPaymentId((previous) => (previous === record.id ? null : previous))
                  })
                  .catch((error) => {
                    console.error(error)
                    toast.error('Unable to delete payment')
                  })
                  .finally(() => setIsRemoving(false))
              },
            },
            sep1: '---------',
            ...Handsontable.plugins.ContextMenu.DEFAULT_ITEMS,
          },
        }}
        cells={(row) => {
          const meta = {} as Handsontable.CellMeta
          const record = data[row]
          if (record && activeOrderId && record.purchaseOrderId === activeOrderId) {
            meta.className = meta.className ? `${meta.className} row-active` : 'row-active'
          }
          return meta
        }}
        afterSelectionEnd={(row) => {
          const record = data[row]
          if (record) {
            onSelectOrder?.(record.purchaseOrderId)
            setSelectedPaymentId(record.id)
          } else {
            setSelectedPaymentId(null)
          }
        }}
        afterOnCellMouseDown={(_, coords) => {
          const hot = hotRef.current
          if (!hot) return
          const prop = hot.colToProp(coords.col)
          if (prop !== 'dueDateIso') return
          const td = hot.getCell(coords.row, coords.col)
          if (!td) return
          const rect = td.getBoundingClientRect()
          const iso = (hot.getSourceDataAtRow(coords.row) as PurchasePaymentRow)?.dueDateIso ?? ''
          setPicker({ row: coords.row, left: rect.left, top: rect.bottom + 4, value: iso })
        }}
        beforeKeyDown={(event) => {
          const hot = hotRef.current
          if (!hot) return
          const sel: any = hot.getSelectedLast()
          if (!sel) return
          let row = -1
          let col = -1
          if (Array.isArray(sel)) {
            if (sel.length >= 2 && typeof sel[0] === 'number') {
              row = sel[0]
              col = sel[1]
            } else if (Array.isArray(sel[0])) {
              const last = sel[sel.length - 1]
              row = last[0]
              col = last[1]
            }
          } else if (typeof sel === 'object' && sel !== null) {
            if (typeof sel.row === 'number' && typeof sel.col === 'number') {
              row = sel.row
              col = sel.col
            } else if (typeof sel.startRow === 'number' && typeof sel.startCol === 'number') {
              row = sel.startRow
              col = sel.startCol
            }
          }
          if (row < 0 || col < 0) return
          const prop = hot.colToProp(col)
          if (prop !== 'dueDateIso') return

          const td = hot.getCell(row, col)
          if (!td) return
          const rect = td.getBoundingClientRect()
          const record = hot.getSourceDataAtRow(row) as PurchasePaymentRow | null
          const iso = record?.dueDateIso ?? ''
          const key = (event as KeyboardEvent).key

          if (key === 'Enter' || key === ' ' || key === 'F2') {
            setPicker({ row, left: rect.left, top: rect.bottom + 4, value: iso })
            event.preventDefault()
            return
          }
          if (/^[0-9]$/.test(key) || key === '-' || key === 'Backspace' || key === 'Delete') {
            setKeyEditor({ row, left: rect.left, top: rect.bottom + 4, value: iso })
            event.preventDefault()
            return
          }
        }}
        // No pre-normalization; the column accessor handles mapping.
        afterChange={(changes, rawSource) => {
          const source = String(rawSource)
          if (!changes || source === 'loadData' || source === 'derived-update') return
          const hot = hotRef.current
          if (!hot) return
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [
              number,
              keyof PurchasePaymentRow | ((row: PurchasePaymentRow, value?: any) => any),
              any,
              any
            ]
            const record = hot.getSourceDataAtRow(rowIndex) as PurchasePaymentRow | null
            if (!record) continue
          if (!pendingRef.current.has(record.id)) {
            pendingRef.current.set(record.id, { id: record.id, values: {} })
          }
          const entry = pendingRef.current.get(record.id)
          if (!entry) continue
          // Column accessor already updated the row; just persist the iso
          if (typeof prop === 'function') {
            const iso = record.dueDateIso ?? toIsoDate(newValue)
            if (iso) {
              const formatted = iso ? formatDateDisplay(iso, dateFormatter) : ''
              const week = deriveIsoWeek(iso)
              entry.values.dueDate = iso
              entry.values.dueDateSource = 'USER'
              record.dueDate = formatted
              record.dueDateIso = iso
              record.dueDateSource = 'USER'
              entry.values.weekNumber = week
              record.weekNumber = week
              hot.setDataAtRowProp(rowIndex, 'dueDateSource', 'USER', 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'dueDateIso', iso, 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'dueDate', formatted, 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'weekNumber', week, 'derived-update')
              if (onRowsChange && hotRef.current) {
                const snapshot = (hot.getSourceData() as PurchasePaymentRow[]).map((row) => ({ ...row }))
                onRowsChange(snapshot)
              }
            } else if (newValue == null || String(newValue).trim() === '') {
              const nextIso = record.dueDateDefaultIso
              const formatted = nextIso ? formatDateDisplay(nextIso, dateFormatter) : ''
              const week = deriveIsoWeek(nextIso)
              entry.values.dueDate = nextIso ?? ''
              entry.values.dueDateDefault = nextIso ?? ''
              entry.values.dueDateSource = 'SYSTEM'
              record.dueDate = formatted
              record.dueDateIso = nextIso ?? null
              record.dueDateSource = 'SYSTEM'
              record.dueDateDefault = formatted
              record.dueDateDefaultIso = nextIso ?? null
              record.weekNumber = week
              hot.setDataAtRowProp(rowIndex, 'dueDateSource', 'SYSTEM', 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'dueDateIso', nextIso ?? null, 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'dueDateDefaultIso', nextIso ?? null, 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'dueDateDefault', formatted, 'derived-update')
              hot.setDataAtRowProp(rowIndex, 'weekNumber', week, 'derived-update')
              if (onRowsChange && hotRef.current) {
                const snapshot = (hot.getSourceData() as PurchasePaymentRow[]).map((row) => ({ ...row }))
                onRowsChange(snapshot)
              }
            } else {
              // Unknown format from editor—ignore rather than reverting
              continue
            }
            continue
          } else if (typeof prop === 'string' && NUMERIC_FIELDS.includes(prop as NumericField)) {
              const numericKey = prop as NumericField
              const normalizedAmount = normalizeNumeric(newValue)
              entry.values[numericKey] = normalizedAmount
              ;((record as unknown) as Record<NumericField, string>)[numericKey] = normalizedAmount
              const plannedAmount = orderSummaries?.get(record.purchaseOrderId)?.plannedAmount ?? 0
              const numericAmount = parseNumericInput(normalizedAmount) ?? 0
              if (plannedAmount > 0 && Number.isFinite(numericAmount)) {
                const amountTolerance = Math.max(plannedAmount * 0.001, 0.01)
                const totalAmount = (hot.getSourceData() as PurchasePaymentRow[])
                  .filter((row) => row.purchaseOrderId === record.purchaseOrderId)
                  .reduce((sum, row) => sum + (parseNumericInput(row.amountPaid) ?? 0), 0)

                if (totalAmount > plannedAmount + amountTolerance) {
                  const previousAmountString =
                    _oldValue == null || _oldValue === '' ? record.amountPaid : normalizeNumeric(_oldValue)
                  entry.values.amountPaid = previousAmountString
                  const previousPercent = normalizePercent(
                    plannedAmount > 0 ? (parseNumericInput(previousAmountString) ?? 0) / plannedAmount : 0
                  )
                  entry.values.percentage = previousPercent
                  hot.setDataAtRowProp(rowIndex, 'amountPaid', previousAmountString, 'derived-update')
                  hot.setDataAtRowProp(rowIndex, 'percentage', previousPercent, 'derived-update')
                  toast.error('Amount paid exceeds the expected total. Adjust the values before continuing.')
                  continue
                }

                const derivedPercent = numericAmount / plannedAmount
                const normalizedPercent = normalizePercent(derivedPercent)
                entry.values.percentage = normalizedPercent
                hot.setDataAtRowProp(rowIndex, 'percentage', normalizedPercent, 'derived-update')
              }
            } else if (typeof prop === 'string') {
              const stringValue = String(newValue ?? '')
              entry.values[prop] = stringValue
              ;(record as Record<string, unknown>)[prop] = stringValue
            }
          }
          scheduleFlush()
          if (onRowsChange && hotRef.current) {
            const snapshot = (hot.getSourceData() as PurchasePaymentRow[]).map((row) => ({ ...row }))
            onRowsChange(snapshot)
          }
        }}
      />
      {picker ? (
        <div
          ref={pickerRef}
          style={{ position: 'fixed', left: picker.left, top: picker.top, zIndex: 9999 }}
          className="xplan-date-overlay rounded-md border border-slate-200 bg-white p-2 shadow-md dark:border-[#0b3a52] dark:bg-[#0a1f35]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Flatpickr
            options={{ dateFormat: 'Y-m-d', defaultDate: picker.value || undefined, inline: true, clickOpens: false }}
            onChange={(dates: Date[]) => {
              const date = dates && dates[0]
              const iso = date ? toIsoDate(date) : ''
              const hot = hotRef.current
              if (!hot) return
              const row = hot.getSourceDataAtRow(picker.row) as PurchasePaymentRow | null
              if (row) {
                const week = deriveIsoWeek(iso)
                // Update grid immediately
                hot.setDataAtRowProp(picker.row, 'dueDateIso', iso ?? '', 'user')
                hot.setDataAtRowProp(picker.row, 'dueDateSource', iso ? 'USER' : 'SYSTEM', 'derived-update')
                hot.setDataAtRowProp(picker.row, 'dueDate', iso ? formatDateDisplay(iso, dateFormatter) : '', 'derived-update')
                hot.setDataAtRowProp(picker.row, 'weekNumber', week, 'derived-update')
                // Persist immediately (no debounce)
                const payload = [{ id: row.id, values: { dueDate: iso ?? '', dueDateSource: iso ? 'USER' : 'SYSTEM', weekNumber: week } }]
                fetch(withAppBasePath('/api/v1/x-plan/purchase-order-payments'), {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: payload }),
                }).then(() => {
                  if (onRowsChange && hotRef.current) {
                    const snapshot = (hotRef.current.getSourceData() as PurchasePaymentRow[]).map((r) => ({ ...r }))
                    onRowsChange(snapshot)
                  }
                }).catch(() => {})
              }
              setPicker(null)
            }}
          />
        </div>
      ) : null}

      {keyEditor ? (
        <div
          style={{ position: 'fixed', left: keyEditor.left, top: keyEditor.top, zIndex: 9999 }}
          className="xplan-date-overlay rounded-md border border-slate-200 bg-white p-2 shadow-md dark:border-[#0b3a52] dark:bg-[#0a1f35]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={keyEditorRef}
            type="text"
            placeholder="YYYY-MM-DD"
            defaultValue={keyEditor.value}
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setKeyEditor(null)
                return
              }
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement
                const iso = toIsoDate(target.value)
                const hot = hotRef.current
                if (!hot) return
                const rowIdx = keyEditor.row
                const row = hot.getSourceDataAtRow(rowIdx) as PurchasePaymentRow | null
                const week = deriveIsoWeek(iso)
                hot.setDataAtRowProp(rowIdx, 'dueDateIso', iso ?? '', 'user')
                hot.setDataAtRowProp(rowIdx, 'dueDateSource', iso ? 'USER' : 'SYSTEM', 'derived-update')
                hot.setDataAtRowProp(rowIdx, 'dueDate', iso ? formatDateDisplay(iso, dateFormatter) : '', 'derived-update')
                hot.setDataAtRowProp(rowIdx, 'weekNumber', week, 'derived-update')
                if (row) {
                  const payload = [{ id: row.id, values: { dueDate: iso ?? '', dueDateSource: iso ? 'USER' : 'SYSTEM', weekNumber: week } }]
                  fetch(withAppBasePath('/api/v1/x-plan/purchase-order-payments'), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates: payload }),
                  }).then(() => {
                    if (onRowsChange && hotRef.current) {
                      const snapshot = (hotRef.current.getSourceData() as PurchasePaymentRow[]).map((r) => ({ ...r }))
                      onRowsChange(snapshot)
                    }
                  }).catch(() => {})
                }
                setKeyEditor(null)
              }
            }}
            onBlur={() => setKeyEditor(null)}
          />
        </div>
      ) : null}
    </div>
  )
}
