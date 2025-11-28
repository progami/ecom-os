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
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { toIsoDate, formatDateDisplay } from '@/lib/utils/dates'
import { formatNumericInput, sanitizeNumeric } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'
import '@/styles/custom-table.css'

export type OpsInputRow = {
  id: string
  productId: string
  orderCode: string
  poDate: string
  productionComplete: string
  sourceDeparture: string
  portEta: string
  availableDate: string
  shipName: string
  containerNumber: string
  productName: string
  quantity: string
  pay1Date: string
  productionWeeks: string
  sourceWeeks: string
  oceanWeeks: string
  finalWeeks: string
  sellingPrice: string
  manufacturingCost: string
  freightCost: string
  tariffRate: string
  tacosPercent: string
  fbaFee: string
  referralRate: string
  storagePerMonth: string
  status: string
  notes: string
}

interface CustomOpsPlanningGridProps {
  rows: OpsInputRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
  onRowsChange?: (rows: OpsInputRow[]) => void
  onCreateOrder?: () => void
  onDeleteOrder?: (orderId: string) => void
  disableCreate?: boolean
  disableDelete?: boolean
}

const STAGE_CONFIG = [
  { weeksKey: 'productionWeeks', overrideKey: 'productionComplete' },
  { weeksKey: 'sourceWeeks', overrideKey: 'sourceDeparture' },
  { weeksKey: 'oceanWeeks', overrideKey: 'portEta' },
  { weeksKey: 'finalWeeks', overrideKey: 'availableDate' },
] as const

type StageWeeksKey = (typeof STAGE_CONFIG)[number]['weeksKey']
type StageOverrideKey = (typeof STAGE_CONFIG)[number]['overrideKey']

const STAGE_OVERRIDE_FIELDS: Record<StageWeeksKey, StageOverrideKey> = STAGE_CONFIG.reduce(
  (map, item) => {
    map[item.weeksKey] = item.overrideKey
    return map
  },
  {} as Record<StageWeeksKey, StageOverrideKey>
)

const NUMERIC_PRECISION: Partial<Record<keyof OpsInputRow, number>> = {
  quantity: 0,
  productionWeeks: 2,
  sourceWeeks: 2,
  oceanWeeks: 2,
  finalWeeks: 2,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  tariffRate: 2,
  tacosPercent: 2,
  fbaFee: 2,
  referralRate: 2,
  storagePerMonth: 2,
}

const NUMERIC_FIELDS = new Set<keyof OpsInputRow>([
  'quantity',
  'productionWeeks',
  'sourceWeeks',
  'oceanWeeks',
  'finalWeeks',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffRate',
  'tacosPercent',
  'fbaFee',
  'referralRate',
  'storagePerMonth',
])

const DATE_FIELDS = new Set<keyof OpsInputRow>([
  'poDate',
  'pay1Date',
  'productionComplete',
  'sourceDeparture',
  'portEta',
  'availableDate',
])

function addWeeks(base: Date, weeks: number): Date {
  const ms = base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000
  return new Date(ms)
}

function parseWeeks(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveStageStart(row: OpsInputRow, stage: StageWeeksKey): Date | null {
  const index = STAGE_CONFIG.findIndex((item) => item.weeksKey === stage)
  if (index <= 0) {
    return parseIsoDate(row.poDate)
  }
  const previous = STAGE_CONFIG[index - 1]
  const override = parseIsoDate(row[previous.overrideKey])
  if (override) return override
  const previousStart = resolveStageStart(row, previous.weeksKey)
  if (!previousStart) return null
  const previousWeeks = parseWeeks(row[previous.weeksKey])
  if (previousWeeks == null) return null
  return addWeeks(previousStart, previousWeeks)
}

function resolveStageEnd(row: OpsInputRow, stage: StageWeeksKey): Date | null {
  const override = parseIsoDate(row[STAGE_OVERRIDE_FIELDS[stage]])
  if (override) return override
  const start = resolveStageStart(row, stage)
  if (!start) return null
  const weeks = parseWeeks(row[stage])
  if (weeks == null) return null
  return addWeeks(start, weeks)
}

function recomputeStageDates(
  record: OpsInputRow,
  entry: { values: Record<string, string | null> }
): OpsInputRow {
  let working = { ...record }

  for (const stage of STAGE_CONFIG) {
    const end = resolveStageEnd(working, stage.weeksKey)
    const iso = end ? toIsoDate(end) ?? '' : ''
    const target = working[stage.overrideKey]
    if (target !== iso) {
      working = { ...working, [stage.overrideKey]: iso as OpsInputRow[StageOverrideKey] }
      entry.values[stage.overrideKey] = iso
    }
  }

  return working
}

function normalizeNumeric(value: unknown, fractionDigits = 2): string {
  return formatNumericInput(value, fractionDigits)
}

function validateNumeric(value: string): boolean {
  if (!value || value.trim() === '') return true
  const parsed = sanitizeNumeric(value)
  return !Number.isNaN(parsed)
}

function validateDate(value: string): boolean {
  if (!value || value.trim() === '') return true
  const date = parseIsoDate(value)
  return date !== null
}

type ColumnDef = {
  key: keyof OpsInputRow
  header: string
  headerWeeks?: string
  headerDates?: string
  width: number
  type: 'text' | 'numeric' | 'date' | 'stage'
  editable?: boolean
  precision?: number
}

const COLUMNS: ColumnDef[] = [
  { key: 'orderCode', header: 'PO Code', width: 150, type: 'text', editable: true },
  { key: 'poDate', header: 'PO Date', width: 150, type: 'date', editable: true },
  { key: 'shipName', header: 'Ship', width: 160, type: 'text', editable: true },
  { key: 'containerNumber', header: 'Container #', width: 160, type: 'text', editable: true },
  {
    key: 'productionWeeks',
    header: 'Prod.',
    headerWeeks: 'Prod. (wk)',
    headerDates: 'Prod. (date)',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'sourceWeeks',
    header: 'Source',
    headerWeeks: 'Source (wk)',
    headerDates: 'Source (date)',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'oceanWeeks',
    header: 'Ocean',
    headerWeeks: 'Ocean (wk)',
    headerDates: 'Ocean (date)',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'finalWeeks',
    header: 'Final',
    headerWeeks: 'Final (wk)',
    headerDates: 'Final (date)',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  { key: 'notes', header: 'Notes', width: 200, type: 'text', editable: true },
]

export function CustomOpsPlanningGrid({
  rows,
  activeOrderId,
  onSelectOrder,
  onRowsChange,
  onCreateOrder,
  onDeleteOrder,
  disableCreate,
  disableDelete,
}: CustomOpsPlanningGridProps) {
  const [stageMode, setStageMode] = useState<'weeks' | 'dates'>('weeks')
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof OpsInputRow } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string> }>) => {
      if (payload.length === 0) return
      // Filter out items that no longer exist in the current rows
      const existingIds = new Set(rows.map((r) => r.id))
      const validPayload = payload.filter((item) => existingIds.has(item.id))
      if (validPayload.length === 0) return
      const url = withAppBasePath('/api/v1/x-plan/purchase-orders')
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: validPayload }),
        })
        if (!response.ok) {
          let errorMessage = 'Failed to update purchase orders'
          try {
            const text = await response.text()
            if (text) {
              const errorData = JSON.parse(text)
              if (errorData?.error) {
                errorMessage = errorData.error
              }
            }
          } catch (parseError) {
            // ignore parse error
          }
          toast.error(errorMessage, { duration: 5000, id: 'po-update-error' })
          return
        }
        toast.success('PO inputs saved', { id: 'po-inputs-saved' })
      } catch (error) {
        console.error('[CustomOpsPlanningGrid] Failed to update purchase orders:', error)
        toast.error('Unable to save purchase order inputs', { duration: 5000, id: 'po-update-error' })
      }
    },
    [rows]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string> }
  >({
    debounceMs: 500,
    onFlush: handleFlush,
  })

  // Use ref pattern to avoid cleanup running on every re-render
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

  const handleDeleteClick = () => {
    if (!onDeleteOrder || !activeOrderId || disableDelete) return
    onDeleteOrder(activeOrderId)
  }

  const startEditing = (rowId: string, colKey: keyof OpsInputRow, currentValue: string) => {
    setEditingCell({ rowId, colKey })
    setEditValue(currentValue)
  }

  const cancelEditing = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const commitEdit = useCallback(() => {
    if (!editingCell) return

    const { rowId, colKey } = editingCell
    const row = rows.find((r) => r.id === rowId)
    if (!row) {
      cancelEditing()
      return
    }

    const column = COLUMNS.find((c) => c.key === colKey)
    if (!column) {
      cancelEditing()
      return
    }

    let finalValue = editValue

    // Validate and normalize based on column type
    if (column.type === 'numeric' || (column.type === 'stage' && stageMode === 'weeks')) {
      if (!validateNumeric(finalValue)) {
        toast.error('Invalid number')
        cancelEditing()
        return
      }
      const precision = column.precision ?? NUMERIC_PRECISION[colKey] ?? 2
      finalValue = normalizeNumeric(finalValue, precision)
    } else if (column.type === 'date' || (column.type === 'stage' && stageMode === 'dates')) {
      if (!validateDate(finalValue)) {
        toast.error('Invalid date')
        cancelEditing()
        return
      }
    }

    // Don't update if value hasn't changed
    if (row[colKey] === finalValue) {
      cancelEditing()
      return
    }

    // Client-side validation for duplicate orderCode
    if (colKey === 'orderCode' && finalValue) {
      const isDuplicate = rows.some(
        (r) => r.id !== rowId && r.orderCode.toLowerCase() === finalValue.toLowerCase()
      )
      if (isDuplicate) {
        toast.warning(`Order code "${finalValue}" is already in use`, {
          description: 'Please choose a unique order code.',
          duration: 4000,
        })
        cancelEditing()
        return
      }
    }

    // Prepare mutation entry
    if (!pendingRef.current.has(rowId)) {
      pendingRef.current.set(rowId, { id: rowId, values: {} })
    }
    const entry = pendingRef.current.get(rowId)!

    // Handle stage columns in date mode
    if (column.type === 'stage' && stageMode === 'dates') {
      const stageField = colKey as StageWeeksKey
      const overrideField = STAGE_OVERRIDE_FIELDS[stageField]
      const iso = finalValue ? toIsoDate(finalValue) : ''

      if (!iso) {
        entry.values[overrideField] = ''
      } else {
        const picked = new Date(`${iso}T00:00:00Z`)
        const stageStart = resolveStageStart(row, stageField)
        if (stageStart) {
          const diffDays = (picked.getTime() - stageStart.getTime()) / (24 * 60 * 60 * 1000)
          const weeks = diffDays / 7
          const normalized = formatNumericInput(weeks, 2)
          entry.values[colKey] = normalized
        }
        entry.values[overrideField] = iso ?? ''
      }
    } else if (NUMERIC_FIELDS.has(colKey)) {
      entry.values[colKey] = finalValue

      // Clear override if weeks changed
      if ((colKey as string) in STAGE_OVERRIDE_FIELDS) {
        const overrideField = STAGE_OVERRIDE_FIELDS[colKey as StageWeeksKey]
        entry.values[overrideField] = ''
      }
    } else if (DATE_FIELDS.has(colKey)) {
      entry.values[colKey] = finalValue
    } else {
      entry.values[colKey] = finalValue
    }

    // Create updated row
    let updatedRow = { ...row }
    for (const [key, val] of Object.entries(entry.values)) {
      updatedRow[key as keyof OpsInputRow] = val as any
    }

    // Recompute stage dates if necessary
    const needsStageRecompute =
      colKey === 'poDate' || (colKey as string) in STAGE_OVERRIDE_FIELDS
    if (needsStageRecompute) {
      updatedRow = recomputeStageDates(updatedRow, entry as { values: Record<string, string | null> })
    }

    // Update rows
    const updatedRows = rows.map((r) => (r.id === rowId ? updatedRow : r))
    onRowsChange?.(updatedRows)

    scheduleFlush()
    cancelEditing()
  }, [editingCell, editValue, rows, stageMode, pendingRef, scheduleFlush, onRowsChange])

  const findNextEditableColumn = (startIndex: number, direction: 1 | -1): number => {
    let idx = startIndex + direction
    while (idx >= 0 && idx < COLUMNS.length) {
      if (COLUMNS[idx].editable !== false) return idx
      idx += direction
    }
    return -1
  }

  const moveToCell = (rowIndex: number, colIndex: number) => {
    if (rowIndex < 0 || rowIndex >= rows.length) return
    if (colIndex < 0 || colIndex >= COLUMNS.length) return
    const column = COLUMNS[colIndex]
    if (column.editable === false) return
    const row = rows[rowIndex]
    startEditing(row.id, column.key, getCellDisplayValue(row, column))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
      // Move to next row, same column
      if (editingCell) {
        const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        if (currentRowIndex < rows.length - 1) {
          moveToCell(currentRowIndex + 1, currentColIndex)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      // Move to next/prev editable cell
      if (editingCell) {
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
        const nextColIndex = findNextEditableColumn(currentColIndex, e.shiftKey ? -1 : 1)

        if (nextColIndex !== -1) {
          moveToCell(currentRowIndex, nextColIndex)
        } else if (!e.shiftKey && currentRowIndex < rows.length - 1) {
          // Move to first editable column of next row
          const firstEditableColIndex = findNextEditableColumn(-1, 1)
          if (firstEditableColIndex !== -1) {
            moveToCell(currentRowIndex + 1, firstEditableColIndex)
          }
        } else if (e.shiftKey && currentRowIndex > 0) {
          // Move to last editable column of previous row
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
        const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex - 1, currentColIndex)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex + 1, currentColIndex)
      }
    } else if (e.key === 'ArrowLeft') {
      // Only move to prev cell if cursor is at start of input
      const input = e.currentTarget
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
          const prevColIndex = findNextEditableColumn(currentColIndex, -1)
          if (prevColIndex !== -1) {
            moveToCell(currentRowIndex, prevColIndex)
          } else if (currentRowIndex > 0) {
            // Move to last editable column of previous row
            const lastEditableColIndex = findNextEditableColumn(COLUMNS.length, -1)
            if (lastEditableColIndex !== -1) {
              moveToCell(currentRowIndex - 1, lastEditableColIndex)
            }
          }
        }
      }
    } else if (e.key === 'ArrowRight') {
      // Only move to next cell if cursor is at end of input
      const input = e.currentTarget
      const len = input.value.length
      if (input.selectionStart === len && input.selectionEnd === len) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
          const nextColIndex = findNextEditableColumn(currentColIndex, 1)
          if (nextColIndex !== -1) {
            moveToCell(currentRowIndex, nextColIndex)
          } else if (currentRowIndex < rows.length - 1) {
            // Move to first editable column of next row
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

  const handleCellClick = (row: OpsInputRow, column: ColumnDef) => {
    onSelectOrder?.(row.id)
    if (column.editable !== false) {
      startEditing(row.id, column.key, getCellDisplayValue(row, column))
    }
  }

  const handleCellBlur = () => {
    commitEdit()
  }

  const getCellDisplayValue = (row: OpsInputRow, column: ColumnDef): string => {
    if (column.type === 'stage') {
      if (stageMode === 'dates') {
        const stageField = column.key as StageWeeksKey
        const endDate = resolveStageEnd(row, stageField)
        // Return ISO for editing, but display is formatted in renderCell
        return toIsoDate(endDate) ?? ''
      }
    }
    // Format date columns for display
    if (column.type === 'date') {
      const isoValue = row[column.key]
      if (isoValue) {
        return formatDateDisplay(isoValue)
      }
      return ''
    }
    return row[column.key] ?? ''
  }

  // Get display-formatted value (always formatted for user readability)
  const getFormattedDisplayValue = (row: OpsInputRow, column: ColumnDef): string => {
    if (column.type === 'stage' && stageMode === 'dates') {
      const stageField = column.key as StageWeeksKey
      const endDate = resolveStageEnd(row, stageField)
      const iso = toIsoDate(endDate)
      return iso ? formatDateDisplay(iso) : ''
    }
    if (column.type === 'date') {
      const isoValue = row[column.key]
      return isoValue ? formatDateDisplay(isoValue) : ''
    }
    return row[column.key] ?? ''
  }

  const getHeaderLabel = (column: ColumnDef): string => {
    if (column.type === 'stage') {
      return stageMode === 'weeks'
        ? column.headerWeeks ?? column.header
        : column.headerDates ?? column.header
    }
    return column.header
  }

  const renderCell = (row: OpsInputRow, column: ColumnDef) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === column.key
    // Use formatted display value for showing, raw value for editing
    const formattedValue = getFormattedDisplayValue(row, column)

    const cellClasses = [
      column.editable !== false ? 'ops-cell-editable' : 'ops-cell-readonly',
      column.type === 'numeric' || (column.type === 'stage' && stageMode === 'weeks')
        ? 'ops-cell-numeric'
        : '',
      column.type === 'date' || (column.type === 'stage' && stageMode === 'dates')
        ? 'ops-cell-date'
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    if (isEditing) {
      const inputType =
        column.type === 'date' || (column.type === 'stage' && stageMode === 'dates')
          ? 'date'
          : 'text'

      return (
        <td
          key={column.key}
          className={cellClasses}
          style={{ width: column.width, minWidth: column.width }}
        >
          <input
            ref={inputRef}
            type={inputType}
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleCellBlur}
            className="ops-cell-input"
            placeholder={column.type === 'date' ? 'Select date' : undefined}
          />
        </td>
      )
    }

    // Show placeholder for empty date fields
    const isDateColumn = column.type === 'date' || (column.type === 'stage' && stageMode === 'dates')
    const showPlaceholder = isDateColumn && !formattedValue
    const displayContent = showPlaceholder ? (
      <span className="ops-cell-placeholder">Click to select date</span>
    ) : (
      formattedValue
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

  const toggleStageMode = () => {
    setStageMode((prev) => (prev === 'weeks' ? 'dates' : 'weeks'))
  }

  const renderHeader = (column: ColumnDef) => {
    const isStageColumn = column.type === 'stage'
    const headerLabel = getHeaderLabel(column)

    if (isStageColumn) {
      return (
        <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
          <button
            type="button"
            className="ops-header-toggle"
            title={`Click to switch to ${stageMode === 'weeks' ? 'dates' : 'weeks'} view`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleStageMode()
            }}
          >
            {headerLabel}
          </button>
        </th>
      )
    }

    return (
      <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
        {headerLabel}
      </th>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            PO Table
          </h2>
        </div>
        {(onCreateOrder || onDeleteOrder) && (
          <div className="flex flex-wrap gap-2">
            {onCreateOrder ? (
              <button
                type="button"
                onClick={onCreateOrder}
                disabled={Boolean(disableCreate)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
              >
                Add purchase order
              </button>
            ) : null}
            {onDeleteOrder ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={Boolean(disableDelete) || !activeOrderId}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:focus:ring-rose-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
              >
                Remove selected
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="ops-table-container">
        <div className="ops-table-body-scroll">
          <table className="ops-table">
            <thead>
              <tr>{COLUMNS.map(renderHeader)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="ops-table-empty">
                    No purchase orders yet. Click &ldquo;Add purchase order&rdquo; to get started.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={activeOrderId === row.id ? 'row-active' : ''}
                    onClick={() => onSelectOrder?.(row.id)}
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
