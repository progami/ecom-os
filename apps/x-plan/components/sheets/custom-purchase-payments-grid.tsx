'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import Flatpickr from 'react-flatpickr'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { usePersistentState } from '@/hooks/usePersistentState'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'
import {
  planningWeekDateIsoForWeekNumber,
  weekLabelForIsoDate,
  weekNumberForYearWeekLabel,
  type PlanningWeekConfig,
} from '@/lib/calculations/planning-week'
import { formatDateDisplay, toIsoDate } from '@/lib/utils/dates'
import { formatNumericInput, sanitizeNumeric } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'
import '@/styles/custom-table.css'

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
  values: Partial<Record<string, string>>
}

export interface PaymentSummary {
  plannedAmount: number
  plannedPercent: number
  actualAmount: number
  actualPercent: number
  remainingAmount: number
  remainingPercent: number
}

interface CustomPurchasePaymentsGridProps {
  payments: PurchasePaymentRow[]
  activeOrderId?: string | null
  activeYear?: number | null
  planningWeekConfig?: PlanningWeekConfig | null
  scrollKey?: string | null
  onSelectOrder?: (orderId: string) => void
  onAddPayment?: () => void
  onRemovePayment?: (paymentId: string) => Promise<void> | void
  onRowsChange?: (rows: PurchasePaymentRow[]) => void
  onSynced?: () => void
  isLoading?: boolean
  orderSummaries?: Map<string, PaymentSummary>
  summaryLine?: string | null
}

type ColumnDef = {
  key: keyof PurchasePaymentRow
  header: string
  headerWeeks?: string
  headerDates?: string
  width: number
  type: 'text' | 'numeric' | 'percent' | 'date' | 'currency' | 'schedule'
  editable: boolean
  precision?: number
}

const COLUMNS: ColumnDef[] = [
  { key: 'orderCode', header: 'PO Code', width: 120, type: 'text', editable: false },
  { key: 'label', header: 'Invoice', width: 140, type: 'text', editable: false },
  {
    key: 'weekNumber',
    header: 'Week',
    headerWeeks: 'Week',
    headerDates: 'Due Date',
    width: 130,
    type: 'schedule',
    editable: true,
  },
  { key: 'percentage', header: 'Percent', width: 90, type: 'percent', editable: false, precision: 2 },
  { key: 'amountExpected', header: 'Expected $', width: 110, type: 'currency', editable: false, precision: 2 },
  { key: 'amountPaid', header: 'Paid $', width: 110, type: 'currency', editable: true, precision: 2 },
]

type ScheduleMode = 'weeks' | 'dates'

function normalizeNumeric(value: unknown, fractionDigits = 2): string {
  return formatNumericInput(value, fractionDigits)
}

function validateNumeric(value: string): boolean {
  if (!value || value.trim() === '') return true
  const parsed = sanitizeNumeric(value)
  return !Number.isNaN(parsed)
}

function parseNumericInput(value: string | null | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[$,%]/g, '').trim()
  const num = parseFloat(cleaned)
  return Number.isNaN(num) ? null : num
}

function parseWeekNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

function getHeaderLabel(column: ColumnDef, scheduleMode: ScheduleMode): string {
  if (column.type === 'schedule') {
    return scheduleMode === 'weeks'
      ? column.headerWeeks ?? column.header
      : column.headerDates ?? column.header
  }
  return column.header
}

function getCellEditValue(row: PurchasePaymentRow, column: ColumnDef, scheduleMode: ScheduleMode): string {
  if (column.type === 'schedule') {
    return scheduleMode === 'weeks' ? row.weekNumber : row.dueDateIso ?? ''
  }

  if (column.type === 'date') {
    const raw = row[column.key]
    return raw === null || raw === undefined ? '' : String(raw)
  }

  const raw = row[column.key]
  return raw === null || raw === undefined ? '' : String(raw)
}

export function CustomPurchasePaymentsGrid({
  payments,
  activeOrderId,
  activeYear,
  planningWeekConfig,
  scrollKey,
  onSelectOrder,
  onAddPayment,
  onRemovePayment,
  onRowsChange,
  onSynced,
  isLoading,
  orderSummaries,
  summaryLine,
}: CustomPurchasePaymentsGridProps) {
  const [scheduleMode, setScheduleMode] = usePersistentState<ScheduleMode>(
    'xplan:ops:payments-schedule-mode',
    'dates'
  )
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof PurchasePaymentRow } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<PurchasePaymentRow[]>(payments)

  usePersistentScroll(scrollKey ?? null, true, () => tableScrollRef.current)

  useEffect(() => {
    rowsRef.current = payments
  }, [payments])

  const handleFlush = useCallback(
    async (payload: PaymentUpdate[]) => {
      if (payload.length === 0) return
      // Filter out items that no longer exist in the current payments
      const existingIds = new Set(payments.map((p) => p.id))
      const validPayload = payload.filter((item) => existingIds.has(item.id))
      if (validPayload.length === 0) return
      try {
        const res = await fetch(withAppBasePath('/api/v1/x-plan/purchase-order-payments'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: validPayload }),
        })
        if (!res.ok) throw new Error('Failed to update payments')
        toast.success('Payment schedule updated', { id: 'payment-updated' })
        onSynced?.()
      } catch (error) {
        console.error(error)
        toast.error('Unable to update payment schedule', { id: 'payment-error' })
      }
    },
    [onSynced, payments]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<string, PaymentUpdate>({
    debounceMs: 400,
    onFlush: handleFlush,
  })

  const flushNowRef = useRef(flushNow)
  useEffect(() => {
    flushNowRef.current = flushNow
  }, [flushNow])

  useEffect(() => {
    return () => {
      flushNowRef.current().catch(() => {})
    }
  }, []) // Only run cleanup on unmount

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  useEffect(() => {
    setSelectedPaymentId(null)
  }, [activeOrderId])

  useEffect(() => {
    if (!selectedPaymentId) return
    const stillExists = payments.some((payment) => payment.id === selectedPaymentId)
    if (!stillExists) setSelectedPaymentId(null)
  }, [payments, selectedPaymentId])

  // Scoped data based on active order
  const data = useMemo(() => {
    return activeOrderId ? payments.filter((p) => p.purchaseOrderId === activeOrderId) : payments
  }, [activeOrderId, payments])

  const summary = activeOrderId ? orderSummaries?.get(activeOrderId) : undefined

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

  const toggleScheduleMode = useCallback(() => {
    setIsDatePickerOpen(false)
    setEditingCell(null)
    setEditValue('')
    setScheduleMode((previous) => (previous === 'weeks' ? 'dates' : 'weeks'))
  }, [setScheduleMode])

  const startEditing = (rowId: string, colKey: keyof PurchasePaymentRow, currentValue: string) => {
    setIsDatePickerOpen(false)
    setEditingCell({ rowId, colKey })
    setEditValue(currentValue)
  }

  const cancelEditing = () => {
    setIsDatePickerOpen(false)
    setEditingCell(null)
    setEditValue('')
  }

  const commitEdit = useCallback((nextValue?: string) => {
    if (!editingCell) return

    const { rowId, colKey } = editingCell
    const row = rowsRef.current.find((r) => r.id === rowId)
    if (!row) {
      cancelEditing()
      return
    }

    const column = COLUMNS.find((c) => c.key === colKey)
    if (!column) {
      cancelEditing()
      return
    }

    let finalValue = nextValue ?? editValue

    // Validate and normalize based on column type
    if (column.type === 'currency') {
      if (!validateNumeric(finalValue)) {
        toast.error('Invalid number')
        cancelEditing()
        return
      }
      finalValue = normalizeNumeric(finalValue, column.precision ?? 2)
    } else if (column.type === 'schedule') {
      if (scheduleMode === 'dates') {
        if (!finalValue || finalValue.trim() === '') {
          finalValue = ''
        } else {
          const iso = toIsoDate(finalValue)
          if (!iso) {
            toast.error('Invalid date')
            cancelEditing()
            return
          }
          finalValue = iso
        }
      } else {
        if (!finalValue || finalValue.trim() === '') {
          finalValue = ''
        } else {
          const weekNumber = parseWeekNumber(finalValue)
          if (!weekNumber || weekNumber > 53) {
            toast.error('Invalid week number')
            cancelEditing()
            return
          }
          finalValue = String(weekNumber)
        }
      }
    }

    // Get the current value for comparison
    const currentValueStr =
      colKey === 'weekNumber' && column.type === 'schedule'
        ? scheduleMode === 'dates'
          ? row.dueDateIso ?? ''
          : row.weekNumber ?? ''
        : row[colKey] === null || row[colKey] === undefined
          ? ''
          : String(row[colKey])

    // Don't update if value hasn't changed
    if (currentValueStr === finalValue) {
      cancelEditing()
      return
    }

    // Prepare mutation entry
    if (!pendingRef.current.has(rowId)) {
      pendingRef.current.set(rowId, { id: rowId, values: {} })
    }
    const entry = pendingRef.current.get(rowId)!

    // Create updated row
    const updatedRow = { ...row }

    if (colKey === 'weekNumber') {
      if (scheduleMode === 'dates') {
        const iso = finalValue
        entry.values.dueDate = iso
        entry.values.dueDateSource = iso ? 'USER' : 'SYSTEM'
        updatedRow.dueDateIso = iso || null
        updatedRow.dueDate = iso ? formatDateDisplay(iso) : ''
        updatedRow.dueDateSource = iso ? 'USER' : 'SYSTEM'
        updatedRow.weekNumber = planningWeekConfig
          ? weekLabelForIsoDate(iso, planningWeekConfig)
          : row.weekNumber ?? ''
      } else {
        if (!finalValue || finalValue.trim() === '') {
          entry.values.dueDate = ''
          entry.values.dueDateSource = 'SYSTEM'
          updatedRow.dueDateIso = null
          updatedRow.dueDate = ''
          updatedRow.dueDateSource = 'SYSTEM'
          updatedRow.weekNumber = ''
        } else {
          if (!planningWeekConfig) {
            toast.error('Planning calendar unavailable')
            cancelEditing()
            return
          }
          const year = activeYear ?? new Date().getFullYear()
          const weekLabel = parseWeekNumber(finalValue)
          const globalWeekNumber = weekNumberForYearWeekLabel(year, weekLabel, planningWeekConfig)
          const iso = planningWeekDateIsoForWeekNumber(globalWeekNumber, planningWeekConfig)
          if (!iso) {
            toast.error('Invalid week number for selected year')
            cancelEditing()
            return
          }
          entry.values.dueDate = iso
          entry.values.dueDateSource = 'USER'
          updatedRow.dueDateIso = iso
          updatedRow.dueDate = formatDateDisplay(iso)
          updatedRow.dueDateSource = 'USER'
          updatedRow.weekNumber = finalValue
        }
      }
    } else if (colKey === 'amountPaid') {
      // Validate that amount doesn't exceed planned
      const plannedAmount = orderSummaries?.get(row.purchaseOrderId)?.plannedAmount ?? 0
      const numericAmount = parseNumericInput(finalValue) ?? 0

      if (plannedAmount > 0 && Number.isFinite(numericAmount)) {
        const amountTolerance = Math.max(plannedAmount * 0.001, 0.01)
        const otherPayments = rowsRef.current
          .filter((r) => r.purchaseOrderId === row.purchaseOrderId && r.id !== rowId)
          .reduce((sum, r) => sum + (parseNumericInput(r.amountPaid) ?? 0), 0)
        const totalAmount = otherPayments + numericAmount

        if (totalAmount > plannedAmount + amountTolerance) {
          toast.error('Amount paid exceeds the expected total. Adjust the values before continuing.')
          cancelEditing()
          return
        }

        // Derive percentage from amount
        const derivedPercent = numericAmount / plannedAmount
        const normalizedPercent = (derivedPercent * 100).toFixed(2) + '%'
        entry.values.percentage = String(derivedPercent)
        updatedRow.percentage = normalizedPercent
      }

      entry.values.amountPaid = finalValue
      updatedRow.amountPaid = finalValue
    }

    // Update rows
    const updatedRows = rowsRef.current.map((r) => (r.id === rowId ? updatedRow : r))
    rowsRef.current = updatedRows
    onRowsChange?.(updatedRows)

    scheduleFlush()
    cancelEditing()
  }, [
    activeYear,
    editingCell,
    editValue,
    pendingRef,
    scheduleFlush,
    onRowsChange,
    orderSummaries,
    planningWeekConfig,
    scheduleMode,
  ])

  const findNextEditableColumn = (startIndex: number, direction: 1 | -1): number => {
    let idx = startIndex + direction
    while (idx >= 0 && idx < COLUMNS.length) {
      if (COLUMNS[idx].editable) return idx
      idx += direction
    }
    return -1
  }

  const moveToCell = (rowIndex: number, colIndex: number) => {
    if (rowIndex < 0 || rowIndex >= data.length) return
    if (colIndex < 0 || colIndex >= COLUMNS.length) return
    const column = COLUMNS[colIndex]
    if (!column.editable) return
    const row = data[rowIndex]
    startEditing(row.id, column.key, getCellEditValue(row, column, scheduleMode))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
      // Move to next row, same column
      if (editingCell) {
        const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        if (currentRowIndex < data.length - 1) {
          moveToCell(currentRowIndex + 1, currentColIndex)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
        const nextColIndex = findNextEditableColumn(currentColIndex, e.shiftKey ? -1 : 1)

        if (nextColIndex !== -1) {
          moveToCell(currentRowIndex, nextColIndex)
        } else if (!e.shiftKey && currentRowIndex < data.length - 1) {
          const firstEditableColIndex = findNextEditableColumn(-1, 1)
          if (firstEditableColIndex !== -1) {
            moveToCell(currentRowIndex + 1, firstEditableColIndex)
          }
        } else if (e.shiftKey && currentRowIndex > 0) {
          const lastEditableColIndex = findNextEditableColumn(COLUMNS.length, -1)
          if (lastEditableColIndex !== -1) {
            moveToCell(currentRowIndex - 1, lastEditableColIndex)
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex - 1, currentColIndex)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex + 1, currentColIndex)
      }
    } else if (e.key === 'ArrowLeft') {
      const input = e.currentTarget
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
          const prevColIndex = findNextEditableColumn(currentColIndex, -1)
          if (prevColIndex !== -1) {
            moveToCell(currentRowIndex, prevColIndex)
          } else if (currentRowIndex > 0) {
            const lastEditableColIndex = findNextEditableColumn(COLUMNS.length, -1)
            if (lastEditableColIndex !== -1) {
              moveToCell(currentRowIndex - 1, lastEditableColIndex)
            }
          }
        }
      }
    } else if (e.key === 'ArrowRight') {
      const input = e.currentTarget
      const len = input.value.length
      if (input.selectionStart === len && input.selectionEnd === len) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = data.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
          const nextColIndex = findNextEditableColumn(currentColIndex, 1)
          if (nextColIndex !== -1) {
            moveToCell(currentRowIndex, nextColIndex)
          } else if (currentRowIndex < data.length - 1) {
            const firstEditableColIndex = findNextEditableColumn(-1, 1)
            if (firstEditableColIndex !== -1) {
              moveToCell(currentRowIndex + 1, firstEditableColIndex)
            }
          }
        }
      }
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const handleCellClick = (row: PurchasePaymentRow, column: ColumnDef) => {
    onSelectOrder?.(row.purchaseOrderId)
    setSelectedPaymentId(row.id)
    if (column.editable) {
      startEditing(row.id, column.key, getCellEditValue(row, column, scheduleMode))
    }
  }

  const handleCellBlur = () => {
    commitEdit()
  }

  const formatDisplayValue = (row: PurchasePaymentRow, column: ColumnDef): string => {
    if (column.type === 'schedule') {
      if (scheduleMode === 'dates') {
        return row.dueDateIso ? formatDateDisplay(row.dueDateIso) : ''
      }
      return row.weekNumber ?? ''
    }

    const value = row[column.key]
    if (value === null || value === undefined || value === '') return ''

    if (column.type === 'date') {
      const isoValue = typeof value === 'string' ? value : null
      return isoValue ? formatDateDisplay(isoValue) : ''
    }

    if (column.type === 'currency') {
      const num = sanitizeNumeric(String(value))
      if (Number.isNaN(num)) return String(value)
      return `$${num.toFixed(column.precision ?? 2)}`
    }

    if (column.type === 'percent') {
      const num = sanitizeNumeric(String(value))
      if (Number.isNaN(num)) return String(value)
      return `${(num * 100).toFixed(column.precision ?? 2)}%`
    }

    return String(value)
  }

  const renderCell = (row: PurchasePaymentRow, column: ColumnDef) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === column.key
    const displayValue = formatDisplayValue(row, column)
    const isScheduleDate = column.type === 'schedule' && scheduleMode === 'dates'

    const cellClasses = [
      column.editable ? 'ops-cell-editable' : 'ops-cell-readonly',
      column.type === 'currency' || column.type === 'percent' ? 'ops-cell-numeric' : '',
      column.type === 'date' || isScheduleDate ? 'ops-cell-date' : '',
      column.key === 'weekNumber' && !isScheduleDate ? 'text-center' : '',
    ]
      .filter(Boolean)
      .join(' ')

    if (isEditing) {
      return (
        <td
          key={column.key}
          className={cellClasses}
          style={{ width: column.width, minWidth: column.width }}
        >
	          {column.type === 'date' || isScheduleDate ? (
	            <Flatpickr
	              value={editValue}
	              options={{
	                dateFormat: 'Y-m-d',
	                allowInput: true,
	                disableMobile: true,
	                onOpen: () => setIsDatePickerOpen(true),
	                onClose: (_dates: Date[], dateStr: string) => {
	                  setIsDatePickerOpen(false)
	                  commitEdit(dateStr || editValue)
	                },
	              }}
	              onChange={(_dates: Date[], dateStr: string) => {
	                setEditValue(dateStr)
	              }}
	              render={(_props: any, handleNodeChange: (node: HTMLElement | null) => void) => (
	                <input
	                  ref={(node) => {
	                    handleNodeChange(node)
	                    inputRef.current = node as HTMLInputElement | null
	                  }}
	                  type="text"
	                  value={editValue}
	                  onChange={handleInputChange}
	                  onKeyDown={handleKeyDown}
	                  onBlur={() => {
	                    if (!isDatePickerOpen) {
	                      handleCellBlur()
	                    }
	                  }}
	                  className="ops-cell-input"
	                  placeholder="YYYY-MM-DD"
	                />
	              )}
	            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCellBlur}
              className="ops-cell-input"
            />
          )}
        </td>
      )
    }

    const showPlaceholder = (column.type === 'date' || isScheduleDate) && !displayValue
    const displayContent = showPlaceholder ? (
      <span className="ops-cell-placeholder">Click to select</span>
    ) : (
      displayValue
    )

    return (
      <td
        key={column.key}
        className={cellClasses}
        style={{ width: column.width, minWidth: column.width }}
        onClick={() => handleCellClick(row, column)}
      >
        <div className="ops-cell-display">{displayContent}</div>
      </td>
    )
  }

  const isRowActive = (row: PurchasePaymentRow): boolean => {
    if (selectedPaymentId && row.id === selectedPaymentId) return true
    if (!selectedPaymentId && activeOrderId && row.purchaseOrderId === activeOrderId) return true
    return false
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
          Payments
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-200/80">
          {summaryText && <span>{summaryText}</span>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onAddPayment) void onAddPayment()
              }}
              disabled={!activeOrderId || isLoading}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add Payment
            </button>
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
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:focus:ring-rose-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
            >
              Remove Payment
            </button>
          </div>
        </div>
      </header>

      <div className="ops-table-container">
        <div ref={tableScrollRef} className="ops-table-body-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
                    {column.type === 'schedule' ? (
                      <button
                        type="button"
                        className="ops-header-toggle"
                        title={`Click to switch to ${scheduleMode === 'weeks' ? 'date' : 'week'} input`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toggleScheduleMode()
                        }}
                      >
                        {getHeaderLabel(column, scheduleMode)}
                      </button>
                    ) : (
                      getHeaderLabel(column, scheduleMode)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="ops-table-empty">
                    {activeOrderId
                      ? 'No payments for this order. Click "Add Payment" to schedule one.'
                      : 'Select a purchase order above to view or add payments.'}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    className={isRowActive(row) ? 'row-active' : ''}
                    onClick={() => {
                      onSelectOrder?.(row.purchaseOrderId)
                      setSelectedPaymentId(row.id)
                    }}
                  >
                    {COLUMNS.map((column) => renderCell(row, column))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
