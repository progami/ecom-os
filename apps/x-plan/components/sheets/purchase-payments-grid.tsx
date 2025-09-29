'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import Flatpickr from 'react-flatpickr'
import 'flatpickr/dist/themes/light.css'
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

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function toIsoDateString(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDateFromIso(iso: string | null | undefined): string {
  return iso ?? ''
}

function deriveIsoWeek(iso: string | null | undefined): string {
  if (!iso) return ''
  const [yearStr, monthStr, dayStr] = iso.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return String(week)
}

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
      const display = formatDisplayDateFromIso(typeof value === 'string' ? value : null)
      td.textContent = display
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

function finishEditingSafely(hot: Handsontable) {
  const core = hot as unknown as {
    finishEditing?: (restoreOriginalValue?: boolean) => void
    getPlugin?: (key: string) => unknown
    getActiveEditor?: () => { close?: () => void; finishEditing?: (restore?: boolean) => void } | undefined
  }

  if (typeof core.finishEditing === 'function') {
    try {
      core.finishEditing(false)
      return
    } catch (error) {
      if (error instanceof TypeError) {
        // fall through to alternate strategies
      } else {
        throw error
      }
    }
  }

  const editorManager = core.getPlugin?.('editorManager') as
    | {
        finishEditing?: (restoreOriginalValue?: boolean) => void
        closeAll?: () => void
        getActiveEditor?: () => { close?: () => void; finishEditing?: (restore?: boolean) => void } | undefined
      }
    | undefined

  if (editorManager) {
    if (typeof editorManager.finishEditing === 'function') {
      editorManager.finishEditing(false)
      return
    }
    if (typeof editorManager.closeAll === 'function') {
      editorManager.closeAll()
      return
    }
  }

  const activeEditor = editorManager?.getActiveEditor?.() ?? core.getActiveEditor?.()
  if (activeEditor) {
    if (typeof activeEditor.finishEditing === 'function') {
      activeEditor.finishEditing(false)
      return
    }
    activeEditor.close?.()
  }
}

function normalizeNumeric(value: unknown) {
  return formatNumericInput(value, 2)
}

function normalizePercent(value: unknown) {
  return formatPercentInput(value, 4)
}

export function PurchasePaymentsGrid({ payments, activeOrderId, onSelectOrder, onAddPayment, onRowsChange, onSynced, isLoading, orderSummaries, summaryLine }: PurchasePaymentsGridProps) {
  const [isClient, setIsClient] = useState(false)
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, PaymentUpdate>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

  // Rely on React data prop updates; avoid forcing loadData which can clobber in-flight edits

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
        if (onSynced) onSynced()
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
            disabled={!activeOrderId || isLoading}
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
            const [rowIndex, prop, _oldValue, newValue] = change as [number, any, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as PurchasePaymentRow | null
            if (!record) continue
          if (!pendingRef.current.has(record.id)) {
            pendingRef.current.set(record.id, { id: record.id, values: {} })
          }
          const entry = pendingRef.current.get(record.id)
          if (!entry) continue
          // Column accessor already updated the row; just persist the iso
          if (typeof prop === 'function') {
            const iso = record.dueDateIso ?? toIsoDateString(newValue)
            if (iso) {
              const formatted = formatDisplayDateFromIso(iso)
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
              const formatted = formatDisplayDateFromIso(nextIso)
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
          } else if (NUMERIC_FIELDS.includes(prop)) {
              const normalizedAmount = normalizeNumeric(newValue)
              entry.values[prop] = normalizedAmount
              record[prop] = normalizedAmount
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
            } else {
              entry.values[prop] = String(newValue ?? '')
            }
          }
          flush()
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
          className="xplan-date-overlay rounded-md border border-slate-300 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Flatpickr
            options={{ dateFormat: 'Y-m-d', defaultDate: picker.value || undefined, inline: true, clickOpens: false }}
            onChange={(dates) => {
              const date = dates && dates[0]
              const iso = date ? toIsoDateString(date) : ''
              const hot = hotRef.current
              if (!hot) return
              const row = hot.getSourceDataAtRow(picker.row) as PurchasePaymentRow | null
              if (row) {
                const week = deriveIsoWeek(iso)
                // Update grid immediately
                hot.setDataAtRowProp(picker.row, 'dueDateIso', iso ?? '', 'user')
                hot.setDataAtRowProp(picker.row, 'dueDateSource', iso ? 'USER' : 'SYSTEM', 'derived-update')
                hot.setDataAtRowProp(picker.row, 'dueDate', formatDisplayDateFromIso(iso), 'derived-update')
                hot.setDataAtRowProp(picker.row, 'weekNumber', week, 'derived-update')
                // Persist immediately (no debounce)
                const payload = [{ id: row.id, values: { dueDate: iso ?? '', dueDateSource: iso ? 'USER' : 'SYSTEM', weekNumber: week } }]
                fetch('/api/v1/x-plan/purchase-order-payments', {
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
          className="xplan-date-overlay rounded-md border border-slate-300 bg-white p-2 shadow-md dark:border-slate-700 dark:bg-slate-900"
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
                const iso = toIsoDateString(target.value)
                const hot = hotRef.current
                if (!hot) return
                const rowIdx = keyEditor.row
                const row = hot.getSourceDataAtRow(rowIdx) as PurchasePaymentRow | null
                const week = deriveIsoWeek(iso)
                hot.setDataAtRowProp(rowIdx, 'dueDateIso', iso ?? '', 'user')
                hot.setDataAtRowProp(rowIdx, 'dueDateSource', iso ? 'USER' : 'SYSTEM', 'derived-update')
                hot.setDataAtRowProp(rowIdx, 'dueDate', formatDisplayDateFromIso(iso), 'derived-update')
                hot.setDataAtRowProp(rowIdx, 'weekNumber', week, 'derived-update')
                if (row) {
                  const payload = [{ id: row.id, values: { dueDate: iso ?? '', dueDateSource: iso ? 'USER' : 'SYSTEM', weekNumber: week } }]
                  fetch('/api/v1/x-plan/purchase-order-payments', {
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
