'use client'

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import Flatpickr from 'react-flatpickr'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { toIsoDate, formatDateDisplay } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'
import { formatNumericInput, sanitizeNumeric } from '@/components/sheets/validators'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { withAppBasePath } from '@/lib/base-path'

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
  scrollKey?: string | null
  onSelectOrder?: (orderId: string) => void
  onRowsChange?: (rows: OpsInputRow[]) => void
  onCreateOrder?: () => void
  onDuplicateOrder?: (orderId: string) => void
  onDeleteOrder?: (orderId: string) => void
  disableCreate?: boolean
  disableDuplicate?: boolean
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
  entry: { values: Record<string, string | null> },
  options: { anchorStage?: StageWeeksKey | null } = {}
): OpsInputRow {
  const anchorStage = options.anchorStage ?? null
  let working = { ...record }

  const baseStart = parseIsoDate(working.poDate)
  if (!baseStart) {
    for (const stage of STAGE_CONFIG) {
      if (working[stage.overrideKey] !== '') {
        working = { ...working, [stage.overrideKey]: '' as OpsInputRow[StageOverrideKey] }
        entry.values[stage.overrideKey] = ''
      }
    }
    return working
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  let currentStart = baseStart

  for (const stage of STAGE_CONFIG) {
    const weeksKey = stage.weeksKey
    const overrideKey = stage.overrideKey

    let stageEnd: Date | null = null

    // If the user just edited a stage end date, treat it as the anchor for this stage and
    // recompute its weeks to match exactly, then derive all downstream stages from it.
    if (anchorStage === weeksKey) {
      const anchored = parseIsoDate(working[overrideKey])
      if (anchored) {
        stageEnd = anchored
        const diffDays = (anchored.getTime() - currentStart.getTime()) / MS_PER_DAY
        const weeks = Math.max(0, diffDays / 7)
        const normalizedWeeks = formatNumericInput(weeks, 2)
        if (working[weeksKey] !== normalizedWeeks) {
          working = { ...working, [weeksKey]: normalizedWeeks as OpsInputRow[StageWeeksKey] }
          entry.values[weeksKey] = normalizedWeeks
        }
      }
    }

    if (!stageEnd) {
      const weeks = parseWeeks(working[weeksKey]) ?? 0
      stageEnd = addWeeks(currentStart, weeks)
    }

    const iso = stageEnd ? toIsoDate(stageEnd) ?? '' : ''
    if (working[overrideKey] !== iso) {
      working = { ...working, [overrideKey]: iso as OpsInputRow[StageOverrideKey] }
      entry.values[overrideKey] = iso
    }

    currentStart = stageEnd
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

function validatePositiveNumeric(value: string): boolean {
  if (!value || value.trim() === '') return false
  const parsed = sanitizeNumeric(value)
  return !Number.isNaN(parsed) && parsed > 0
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
    headerWeeks: 'Prod (wk)',
    headerDates: 'Prod Complete',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'sourceWeeks',
    header: 'Ocean Departure',
    headerWeeks: 'Ocean Dep. (wk)',
    headerDates: 'Ocean Dep.',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'oceanWeeks',
    header: 'Ocean',
    headerWeeks: 'Port ETA (wk)',
    headerDates: 'Port ETA',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  {
    key: 'finalWeeks',
    header: 'Warehouse Arrival',
    headerWeeks: 'Warehouse (wk)',
    headerDates: 'Warehouse',
    width: 120,
    type: 'stage',
    editable: true,
    precision: 2,
  },
  { key: 'notes', header: 'Notes', width: 200, type: 'text', editable: true },
]

type StageMode = 'weeks' | 'dates'

const CELL_ID_PREFIX = 'xplan-ops-po'

function sanitizeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function cellDomId(rowId: string, colKey: keyof OpsInputRow): string {
  return `${CELL_ID_PREFIX}:${sanitizeDomId(rowId)}:${String(colKey)}`
}

function getCellEditValue(row: OpsInputRow, column: ColumnDef, stageMode: StageMode): string {
  if (column.type === 'stage' && stageMode === 'dates') {
    const stageField = column.key as StageWeeksKey
    const endDate = resolveStageEnd(row, stageField)
    return toIsoDate(endDate) ?? ''
  }

  if (column.type === 'date') {
    return row[column.key] ?? ''
  }

  return row[column.key] ?? ''
}

function getCellFormattedValue(row: OpsInputRow, column: ColumnDef, stageMode: StageMode): string {
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

type CustomOpsPlanningRowProps = {
  row: OpsInputRow
  rowIndex: number
  stageMode: StageMode
  isActive: boolean
  activeColKey: keyof OpsInputRow | null
  editingColKey: keyof OpsInputRow | null
  editValue: string
  isDatePickerOpen: boolean
  inputRef: { current: HTMLInputElement | null }
  onSelectCell: (rowId: string, colKey: keyof OpsInputRow) => void
  onStartEditing: (rowId: string, colKey: keyof OpsInputRow, currentValue: string) => void
  onSetEditValue: (value: string) => void
  onCommitEdit?: (nextValue?: string) => void
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  setIsDatePickerOpen: (open: boolean) => void
}

const CustomOpsPlanningRow = memo(function CustomOpsPlanningRow({
  row,
  rowIndex,
  stageMode,
  isActive,
  activeColKey,
  editingColKey,
  editValue,
  isDatePickerOpen,
  inputRef,
  onSelectCell,
  onStartEditing,
  onSetEditValue,
  onCommitEdit,
  onInputKeyDown,
  setIsDatePickerOpen,
}: CustomOpsPlanningRowProps) {
  const isEvenRow = rowIndex % 2 === 1

  return (
    <TableRow
      className={cn(
        'hover:bg-transparent',
        isEvenRow ? 'bg-muted/30' : 'bg-card',
        isActive && 'bg-cyan-50/70 dark:bg-cyan-900/20'
      )}
    >
      {COLUMNS.map((column, colIndex) => {
        const isEditing = editingColKey === column.key
        const isEditable = column.editable !== false
        const isDateCell = column.type === 'date' || (column.type === 'stage' && stageMode === 'dates')
        const isNumericCell =
          column.type === 'numeric' || (column.type === 'stage' && stageMode === 'weeks')

        const isCurrentCell = activeColKey === column.key

        const cellClassName = cn(
          'h-9 whitespace-nowrap border-r p-0 align-middle text-sm',
          colIndex === 0 && isActive && 'border-l-4 border-cyan-600 dark:border-cyan-400',
          isNumericCell && 'text-right',
          isEditable ? 'cursor-text bg-accent/50 font-medium' : 'bg-muted/50 text-muted-foreground',
          (isEditing || isCurrentCell) && 'ring-2 ring-inset ring-ring',
          colIndex === COLUMNS.length - 1 && 'border-r-0'
        )

        const inputClassName = cn(
          'h-9 w-full bg-transparent px-3 text-sm font-semibold text-foreground outline-none focus:bg-background focus:ring-1 focus:ring-inset focus:ring-ring',
          isNumericCell && 'text-right'
        )

        if (isEditing && onCommitEdit) {
          return (
            <TableCell
              key={column.key}
              className={cellClassName}
              style={{ width: column.width, minWidth: column.width }}
            >
              {isDateCell ? (
                <Flatpickr
                  value={editValue}
                  options={{
                    dateFormat: 'Y-m-d',
                    allowInput: true,
                    disableMobile: true,
                    onOpen: () => setIsDatePickerOpen(true),
                    onClose: (_dates: Date[], dateStr: string) => {
                      setIsDatePickerOpen(false)
                      onCommitEdit(dateStr || editValue)
                    },
                  }}
                  onChange={(_dates: Date[], dateStr: string) => {
                    onSetEditValue(dateStr)
                  }}
                  render={(_props: any, handleNodeChange: (node: HTMLElement | null) => void) => (
                    <input
                      ref={(node) => {
                        handleNodeChange(node)
                        inputRef.current = node as HTMLInputElement | null
                      }}
                      type="text"
                      value={editValue}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => onSetEditValue(event.target.value)}
                      onKeyDown={onInputKeyDown}
                      onBlur={() => {
                        if (!isDatePickerOpen) {
                          onCommitEdit()
                        }
                      }}
                      className={inputClassName}
                      placeholder="YYYY-MM-DD"
                    />
                  )}
                />
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSetEditValue(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  onBlur={() => onCommitEdit()}
                  className={inputClassName}
                />
              )}
            </TableCell>
          )
        }

        const formattedValue = getCellFormattedValue(row, column, stageMode)
        const showPlaceholder = isDateCell && !formattedValue
        const displayContent = showPlaceholder ? (
          <span className="px-3 text-xs italic text-muted-foreground">Click to select date</span>
        ) : (
          formattedValue
        )

        return (
          <TableCell
            key={column.key}
            id={cellDomId(row.id, column.key)}
            className={cellClassName}
            style={{ width: column.width, minWidth: column.width }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectCell(row.id, column.key)
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              if (!isEditable) return
              onStartEditing(row.id, column.key, getCellEditValue(row, column, stageMode))
            }}
          >
            <div className={cn('flex h-9 items-center px-3', isNumericCell && 'justify-end')}>
              {displayContent}
            </div>
          </TableCell>
        )
      })}
    </TableRow>
  )
})

export function CustomOpsPlanningGrid({
  rows,
  activeOrderId,
  scrollKey,
  onSelectOrder,
  onRowsChange,
  onCreateOrder,
  onDuplicateOrder,
  onDeleteOrder,
  disableCreate,
  disableDuplicate,
  disableDelete,
}: CustomOpsPlanningGridProps) {
  const [stageMode, setStageMode] = useState<StageMode>('dates')
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof OpsInputRow } | null>(null)
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: keyof OpsInputRow } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  usePersistentScroll(scrollKey ?? null, true, () => tableScrollRef.current)

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

  const handleDuplicateClick = () => {
    if (!onDuplicateOrder || !activeOrderId || disableDuplicate) return
    onDuplicateOrder(activeOrderId)
  }

  const startEditing = useCallback((rowId: string, colKey: keyof OpsInputRow, currentValue: string) => {
    setIsDatePickerOpen(false)
    setActiveCell({ rowId, colKey })
    setEditingCell({ rowId, colKey })
    setEditValue(currentValue)
  }, [])

  const selectCell = useCallback(
    (rowId: string, colKey: keyof OpsInputRow) => {
      tableScrollRef.current?.focus()
      setActiveCell({ rowId, colKey })
      onSelectOrder?.(rowId)
    },
    [onSelectOrder]
  )

  const cancelEditing = useCallback(() => {
    setIsDatePickerOpen(false)
    setEditingCell(null)
    setEditValue('')
  }, [])

  const commitEdit = useCallback((nextValue?: string) => {
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

    let finalValue = nextValue ?? editValue

    // Validate and normalize based on column type
    if (column.type === 'numeric' || (column.type === 'stage' && stageMode === 'weeks')) {
      const isStageWeeks = column.type === 'stage' && stageMode === 'weeks'
      const validator = isStageWeeks ? validatePositiveNumeric : validateNumeric
      if (!validator(finalValue)) {
        toast.error(isStageWeeks ? 'Weeks must be a positive number' : 'Invalid number')
        cancelEditing()
        return
      }
      const precision = column.precision ?? NUMERIC_PRECISION[colKey] ?? 2
      finalValue = normalizeNumeric(finalValue, precision)
    } else if (column.type === 'date') {
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
    } else if (column.type === 'stage' && stageMode === 'dates') {
      if (!validateDate(finalValue)) {
        toast.error('Invalid date')
        cancelEditing()
        return
      }
    }

    // Treat stage/date cells as the resolved stage end date, not the underlying weeks value.
    if (column.type === 'stage' && stageMode === 'dates') {
      const stageField = colKey as StageWeeksKey
      const overrideField = STAGE_OVERRIDE_FIELDS[stageField]
      const currentIso = toIsoDate(resolveStageEnd(row, stageField)) ?? ''

      if (!finalValue || finalValue.trim() === '') {
        finalValue = ''
        if ((row[overrideField] ?? '') === '') {
          cancelEditing()
          return
        }
      } else {
        const iso = toIsoDate(finalValue)
        if (!iso) {
          toast.error('Invalid date')
          cancelEditing()
          return
        }
        finalValue = iso
        if (finalValue === currentIso) {
          cancelEditing()
          return
        }
      }
    } else if (column.type === 'date') {
      const currentIso = row[colKey] ? (toIsoDate(row[colKey]) ?? '') : ''
      if (currentIso === finalValue) {
        cancelEditing()
        return
      }
    } else if (row[colKey] === finalValue) {
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
      const iso = finalValue

      if (!iso) {
        if ((row[overrideField] ?? '') !== '') {
          entry.values[overrideField] = ''
        }
      } else {
        const picked = new Date(`${iso}T00:00:00Z`)
        const stageStart = resolveStageStart(row, stageField)
        if (stageStart) {
          if (picked.getTime() < stageStart.getTime()) {
            toast.error('Stage end date cannot be before the stage start')
            cancelEditing()
            return
          }
          const diffDays = (picked.getTime() - stageStart.getTime()) / (24 * 60 * 60 * 1000)
          const weeks = diffDays / 7
          if (weeks < 0) {
            toast.error('Stage weeks cannot be negative')
            cancelEditing()
            return
          }
          const normalized = formatNumericInput(weeks, 2)
          if (row[colKey] !== normalized) {
            entry.values[colKey] = normalized
          }
        }
        if ((row[overrideField] ?? '') !== iso) {
          entry.values[overrideField] = iso ?? ''
        }
      }
    } else if (NUMERIC_FIELDS.has(colKey)) {
      entry.values[colKey] = finalValue

      // Clear override if weeks changed
      if ((colKey as string) in STAGE_OVERRIDE_FIELDS) {
        const overrideField = STAGE_OVERRIDE_FIELDS[colKey as StageWeeksKey]
        if ((row[overrideField] ?? '') !== '') {
          entry.values[overrideField] = ''
        }
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
      const anchorStage =
        column.type === 'stage' && stageMode === 'dates' ? (colKey as StageWeeksKey) : null
      updatedRow = recomputeStageDates(
        updatedRow,
        entry as { values: Record<string, string | null> },
        { anchorStage }
      )
    }

    if (Object.keys(entry.values).length === 0) {
      pendingRef.current.delete(rowId)
      cancelEditing()
      return
    }

    // Update rows
    const updatedRows = rows.map((r) => (r.id === rowId ? updatedRow : r))
    onRowsChange?.(updatedRows)

    scheduleFlush()
    cancelEditing()
  }, [editingCell, editValue, rows, stageMode, pendingRef, scheduleFlush, onRowsChange, cancelEditing])

  const scrollToCell = useCallback((rowId: string, colKey: keyof OpsInputRow) => {
    requestAnimationFrame(() => {
      const node = document.getElementById(cellDomId(rowId, colKey))
      node?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }, [])

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      if (!activeCell) return

      const currentRowIndex = rows.findIndex((row) => row.id === activeCell.rowId)
      const currentColIndex = COLUMNS.findIndex((column) => column.key === activeCell.colKey)
      if (currentRowIndex < 0 || currentColIndex < 0) return

      const nextRowIndex = Math.max(0, Math.min(rows.length - 1, currentRowIndex + deltaRow))
      const nextColIndex = Math.max(0, Math.min(COLUMNS.length - 1, currentColIndex + deltaCol))

      const nextRowId = rows[nextRowIndex]?.id
      const nextColKey = COLUMNS[nextColIndex]?.key
      if (!nextRowId || !nextColKey) return

      setActiveCell({ rowId: nextRowId, colKey: nextColKey })
      onSelectOrder?.(nextRowId)
      scrollToCell(nextRowId, nextColKey)
    },
    [activeCell, rows, onSelectOrder, scrollToCell]
  )

  const moveSelectionTab = useCallback(
    (direction: 1 | -1) => {
      if (!activeCell) return

      const currentRowIndex = rows.findIndex((row) => row.id === activeCell.rowId)
      const currentColIndex = COLUMNS.findIndex((column) => column.key === activeCell.colKey)
      if (currentRowIndex < 0 || currentColIndex < 0) return

      let nextRowIndex = currentRowIndex
      let nextColIndex = currentColIndex + direction

      if (nextColIndex >= COLUMNS.length) {
        nextColIndex = 0
        nextRowIndex = Math.min(rows.length - 1, currentRowIndex + 1)
      } else if (nextColIndex < 0) {
        nextColIndex = COLUMNS.length - 1
        nextRowIndex = Math.max(0, currentRowIndex - 1)
      }

      const nextRowId = rows[nextRowIndex]?.id
      const nextColKey = COLUMNS[nextColIndex]?.key
      if (!nextRowId || !nextColKey) return

      setActiveCell({ rowId: nextRowId, colKey: nextColKey })
      onSelectOrder?.(nextRowId)
      scrollToCell(nextRowId, nextColKey)
    },
    [activeCell, rows, onSelectOrder, scrollToCell]
  )

  const startEditingActiveCell = useCallback(() => {
    if (!activeCell) return
    const row = rows.find((r) => r.id === activeCell.rowId)
    const column = COLUMNS.find((c) => c.key === activeCell.colKey)
    if (!row || !column) return
    if ((column.editable ?? true) === false) return
    startEditing(row.id, column.key, getCellEditValue(row, column, stageMode))
  }, [activeCell, rows, stageMode, startEditing])

  const handleTableKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (editingCell) return
      if (!activeCell) return

      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault()
        startEditingActiveCell()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        moveSelectionTab(event.shiftKey ? -1 : 1)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveSelection(0, 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveSelection(0, -1)
        return
      }
    },
    [activeCell, editingCell, moveSelection, moveSelectionTab, startEditingActiveCell]
  )

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
    startEditing(row.id, column.key, getCellEditValue(row, column, stageMode))
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

  const getHeaderLabel = (column: ColumnDef): string => {
    if (column.type === 'stage') {
      return stageMode === 'weeks'
        ? column.headerWeeks ?? column.header
        : column.headerDates ?? column.header
    }
    return column.header
  }

  const toggleStageMode = () => {
    setStageMode((prev) => (prev === 'weeks' ? 'dates' : 'weeks'))
  }

  const renderHeader = (column: ColumnDef) => {
    const isStageColumn = column.type === 'stage'
    const headerLabel = getHeaderLabel(column)

    return (
      <TableHead
        key={column.key}
        style={{ width: column.width, minWidth: column.width }}
        className="sticky top-0 z-10 h-10 whitespace-nowrap border-b border-r bg-muted px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 last:border-r-0 dark:text-cyan-300/80"
      >
        {isStageColumn ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-cyan-700 transition hover:bg-cyan-500/20 dark:border-cyan-300/35 dark:bg-cyan-300/10 dark:text-cyan-200 dark:hover:bg-cyan-300/20"
            title={`Click to switch to ${stageMode === 'weeks' ? 'dates' : 'weeks'} view`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggleStageMode()
            }}
          >
            {headerLabel}
          </button>
        ) : (
          headerLabel
        )}
      </TableHead>
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
        {(onCreateOrder || onDuplicateOrder || onDeleteOrder) && (
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
            {onDuplicateOrder ? (
              <button
                type="button"
                onClick={handleDuplicateClick}
                disabled={Boolean(disableDuplicate) || !activeOrderId}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
              >
                Duplicate selected
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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm dark:border-white/10">
        <div
          ref={tableScrollRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className="max-h-[400px] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Table className="table-fixed border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">{COLUMNS.map(renderHeader)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLUMNS.length} className="p-6 text-center text-sm text-muted-foreground">
                    No purchase orders yet. Click &ldquo;Add purchase order&rdquo; to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, rowIndex) => {
                  const isEditingRow = editingCell?.rowId === row.id
                  return (
                    <CustomOpsPlanningRow
                      key={row.id}
                      row={row}
                      rowIndex={rowIndex}
                      stageMode={stageMode}
                      isActive={activeOrderId === row.id}
                      activeColKey={activeCell?.rowId === row.id ? activeCell.colKey : null}
                      editingColKey={isEditingRow ? editingCell!.colKey : null}
                      editValue={isEditingRow ? editValue : ''}
                      isDatePickerOpen={isEditingRow ? isDatePickerOpen : false}
                      inputRef={inputRef}
                      onSelectCell={selectCell}
                      onStartEditing={startEditing}
                      onSetEditValue={setEditValue}
                      onCommitEdit={isEditingRow ? commitEdit : undefined}
                      onInputKeyDown={isEditingRow ? handleKeyDown : undefined}
                      setIsDatePickerOpen={setIsDatePickerOpen}
                    />
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
