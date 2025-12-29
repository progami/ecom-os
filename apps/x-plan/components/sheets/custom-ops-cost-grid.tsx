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
import { usePersistentState } from '@/hooks/usePersistentState'
import { formatNumericInput, formatPercentInput, sanitizeNumeric } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'
import '@/styles/custom-table.css'

export type OpsBatchRow = {
  id: string
  purchaseOrderId: string
  orderCode: string
  batchCode?: string
  productId: string
  productName: string
  quantity: string
  sellingPrice: string
  manufacturingCost: string
  freightCost: string
  tariffRate: string
  tariffCost: string
  tacosPercent: string
  fbaFee: string
  referralRate: string
  storagePerMonth: string
}

interface CustomOpsCostGridProps {
  rows: OpsBatchRow[]
  activeOrderId?: string | null
  activeBatchId?: string | null
  onSelectOrder?: (orderId: string) => void
  onSelectBatch?: (batchId: string) => void
  onRowsChange?: (rows: OpsBatchRow[]) => void
  onAddBatch?: () => void
  onDeleteBatch?: () => void
  disableAdd?: boolean
  disableDelete?: boolean
  products: Array<{ id: string; name: string }>
  onSync?: () => void
}

const NUMERIC_FIELDS = [
  'quantity',
  'sellingPrice',
  'manufacturingCost',
  'freightCost',
  'tariffCost',
  'fbaFee',
  'storagePerMonth',
] as const
type NumericField = (typeof NUMERIC_FIELDS)[number]

const NUMERIC_PRECISION: Record<NumericField, number> = {
  quantity: 0,
  sellingPrice: 2,
  manufacturingCost: 3,
  freightCost: 3,
  tariffCost: 3,
  fbaFee: 3,
  storagePerMonth: 3,
}

const PERCENT_FIELDS = ['tariffRate', 'tacosPercent', 'referralRate'] as const
type PercentField = (typeof PERCENT_FIELDS)[number]

const PERCENT_PRECISION: Record<PercentField, number> = {
  tariffRate: 2,
  tacosPercent: 2,
  referralRate: 2,
}

const NUMERIC_FIELD_SET = new Set<string>(NUMERIC_FIELDS)
const PERCENT_FIELD_SET = new Set<string>(PERCENT_FIELDS)

const SERVER_FIELD_MAP: Partial<Record<keyof OpsBatchRow, string>> = {
  quantity: 'quantity',
  sellingPrice: 'overrideSellingPrice',
  manufacturingCost: 'overrideManufacturingCost',
  freightCost: 'overrideFreightCost',
  tariffRate: 'overrideTariffRate',
  tariffCost: 'overrideTariffCost',
  tacosPercent: 'overrideTacosPercent',
  fbaFee: 'overrideFbaFee',
  referralRate: 'overrideReferralRate',
  storagePerMonth: 'overrideStoragePerMonth',
}

function isNumericField(field: keyof OpsBatchRow): field is NumericField {
  return NUMERIC_FIELD_SET.has(field as string)
}

function isPercentField(field: keyof OpsBatchRow): field is PercentField {
  return PERCENT_FIELD_SET.has(field as string)
}

function normalizeCurrency(value: unknown, fractionDigits = 2): string {
  return formatNumericInput(value, fractionDigits)
}

function normalizePercent(value: unknown, fractionDigits = 4): string {
  return formatPercentInput(value, fractionDigits)
}

function validateNumeric(value: string): boolean {
  if (!value || value.trim() === '') return true
  const parsed = sanitizeNumeric(value)
  return !Number.isNaN(parsed)
}

type ColumnDef = {
  key: keyof OpsBatchRow
  header: string
  width: number
  type: 'text' | 'numeric' | 'percent' | 'dropdown'
  editable: boolean
  precision?: number
}

const COLUMNS_BEFORE_TARIFF: ColumnDef[] = [
  { key: 'orderCode', header: 'PO Code', width: 140, type: 'text', editable: false },
  { key: 'productName', header: 'Product', width: 200, type: 'dropdown', editable: true },
  { key: 'quantity', header: 'Qty', width: 110, type: 'numeric', editable: true, precision: 0 },
  { key: 'sellingPrice', header: 'Sell $', width: 120, type: 'numeric', editable: true, precision: 2 },
  { key: 'manufacturingCost', header: 'Mfg $', width: 120, type: 'numeric', editable: true, precision: 3 },
  { key: 'freightCost', header: 'Freight $', width: 120, type: 'numeric', editable: true, precision: 3 },
]

const TARIFF_RATE_COLUMN: ColumnDef = {
  key: 'tariffRate',
  header: 'Tariff %',
  width: 110,
  type: 'percent',
  editable: true,
  precision: 2,
}

const TARIFF_COST_COLUMN: ColumnDef = {
  key: 'tariffCost',
  header: 'Tariff $/unit',
  width: 120,
  type: 'numeric',
  editable: true,
  precision: 3,
}

const COLUMNS_AFTER_TARIFF: ColumnDef[] = [
  { key: 'tacosPercent', header: 'TACoS %', width: 110, type: 'percent', editable: true, precision: 2 },
  { key: 'fbaFee', header: 'FBA $', width: 110, type: 'numeric', editable: true, precision: 3 },
  { key: 'referralRate', header: 'Referral %', width: 110, type: 'percent', editable: true, precision: 2 },
  { key: 'storagePerMonth', header: 'Storage $', width: 120, type: 'numeric', editable: true, precision: 3 },
]

type TariffInputMode = 'rate' | 'cost'

export function CustomOpsCostGrid({
  rows,
  activeOrderId,
  activeBatchId,
  onSelectOrder,
  onSelectBatch,
  onRowsChange,
  onAddBatch,
  onDeleteBatch,
  disableAdd,
  disableDelete,
  products,
  onSync,
}: CustomOpsCostGridProps) {
  const [tariffInputMode, setTariffInputMode] = usePersistentState<TariffInputMode>(
    'xplan:ops:batch-tariff-mode',
    'rate'
  )
  const columns = useMemo(() => {
    const tariffColumn = tariffInputMode === 'cost' ? TARIFF_COST_COLUMN : TARIFF_RATE_COLUMN
    return [...COLUMNS_BEFORE_TARIFF, tariffColumn, ...COLUMNS_AFTER_TARIFF]
  }, [tariffInputMode])

  const [localRows, setLocalRows] = useState<OpsBatchRow[]>(rows)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof OpsBatchRow } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // Keep a local copy to avoid UI flicker when parent props refresh after saving.
  useEffect(() => {
    setLocalRows((previous) => {
      if (previous.length === 0) return rows
      const byId = new Map(previous.map((row) => [row.id, row]))
      let changed = false
      for (const row of rows) {
        const existing = byId.get(row.id)
        const serializedExisting = existing ? JSON.stringify(existing) : null
        const serializedIncoming = JSON.stringify(row)
        if (serializedExisting !== serializedIncoming) {
          byId.set(row.id, row)
          changed = true
        }
      }
      return changed ? rows.map((row) => byId.get(row.id) ?? row) : previous
    })
  }, [rows])

  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string | null> }>) => {
      if (payload.length === 0) return
      // Filter out items that no longer exist in the current rows
      const existingIds = new Set(localRows.map((r) => r.id))
      const validPayload = payload.filter((item) => existingIds.has(item.id))
      if (validPayload.length === 0) return
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/purchase-orders/batches'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: validPayload }),
        })
        if (!response.ok) throw new Error('Failed to update batch cost overrides')
        toast.success('Batch cost saved', { id: 'batch-cost-saved' })
        onSync?.()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save batch costs', { id: 'batch-cost-error' })
      }
    },
    [localRows, onSync]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string | null> }
  >({
    debounceMs: 500,
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
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editingCell])

  const startEditing = (rowId: string, colKey: keyof OpsBatchRow, currentValue: string) => {
    setEditingCell({ rowId, colKey })
    setEditValue(currentValue)
  }

  const cancelEditing = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  const toggleTariffInputMode = useCallback(() => {
    cancelEditing()
    setTariffInputMode((previous) => (previous === 'rate' ? 'cost' : 'rate'))
  }, [cancelEditing, setTariffInputMode])

  const commitEdit = useCallback((overrideValue?: string) => {
    if (!editingCell) return

    const { rowId, colKey } = editingCell
    const row = localRows.find((r) => r.id === rowId)
    if (!row) {
      cancelEditing()
      return
    }

    const column = columns.find((c) => c.key === colKey)
    if (!column) {
      cancelEditing()
      return
    }

    let finalValue = overrideValue ?? editValue

    // Validate and normalize based on column type
    if (column.type === 'numeric') {
      if (!validateNumeric(finalValue)) {
        toast.error('Invalid number')
        cancelEditing()
        return
      }
      const precision = column.precision ?? NUMERIC_PRECISION[colKey as NumericField] ?? 2
      finalValue = normalizeCurrency(finalValue, precision)
    } else if (column.type === 'percent') {
      if (!validateNumeric(finalValue)) {
        toast.error('Invalid percentage')
        cancelEditing()
        return
      }
      const precision = column.precision ?? PERCENT_PRECISION[colKey as PercentField] ?? 4
      finalValue = normalizePercent(finalValue, precision)
    } else if (column.type === 'dropdown') {
      // Handle product selection
      const selected = products.find((p) => p.name === finalValue)
      if (!selected && finalValue) {
        toast.error('Select a valid product')
        cancelEditing()
        return
      }
    }

    // Don't update if value hasn't changed
    if (row[colKey] === finalValue) {
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

    if (colKey === 'productName') {
      const selected = products.find((p) => p.name === finalValue)
      if (selected) {
        entry.values.productId = selected.id
        updatedRow.productId = selected.id
        updatedRow.productName = selected.name
      }
    } else if (colKey === 'tariffCost') {
      entry.values.overrideTariffCost = finalValue === '' ? null : finalValue
      entry.values.overrideTariffRate = null
      updatedRow.tariffCost = finalValue
      updatedRow.tariffRate = ''
    } else if (colKey === 'tariffRate') {
      entry.values.overrideTariffRate = finalValue === '' ? null : finalValue
      entry.values.overrideTariffCost = null
      updatedRow.tariffRate = finalValue
      updatedRow.tariffCost = ''
    } else if (isNumericField(colKey)) {
      const serverKey = SERVER_FIELD_MAP[colKey]
      if (serverKey) {
        entry.values[serverKey] = finalValue === '' ? null : finalValue
      }
      updatedRow[colKey] = finalValue
    } else if (isPercentField(colKey)) {
      const serverKey = SERVER_FIELD_MAP[colKey]
      if (serverKey) {
        entry.values[serverKey] = finalValue === '' ? null : finalValue
      }
      updatedRow[colKey] = finalValue
    }

    // Update rows
    const updatedRows = localRows.map((r) => (r.id === rowId ? updatedRow : r))
    setLocalRows(updatedRows)
    onRowsChange?.(updatedRows)

    scheduleFlush()
    cancelEditing()
  }, [editingCell, editValue, localRows, products, pendingRef, scheduleFlush, onRowsChange, columns, cancelEditing])

  const findNextEditableColumn = (startIndex: number, direction: 1 | -1): number => {
    let idx = startIndex + direction
    while (idx >= 0 && idx < columns.length) {
      if (columns[idx].editable) return idx
      idx += direction
    }
    return -1
  }

  const moveToCell = (rowIndex: number, colIndex: number) => {
    if (rowIndex < 0 || rowIndex >= localRows.length) return
    if (colIndex < 0 || colIndex >= columns.length) return
    const column = columns[colIndex]
    if (!column.editable) return
    const row = localRows[rowIndex]
    startEditing(row.id, column.key, row[column.key] ?? '')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
      // Move to next row, same column
      if (editingCell) {
        const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
        if (currentRowIndex < localRows.length - 1) {
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
        const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
        const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
        const nextColIndex = findNextEditableColumn(currentColIndex, e.shiftKey ? -1 : 1)

        if (nextColIndex !== -1) {
          moveToCell(currentRowIndex, nextColIndex)
        } else if (!e.shiftKey && currentRowIndex < localRows.length - 1) {
          // Move to first editable column of next row
          const firstEditableColIndex = findNextEditableColumn(-1, 1)
          if (firstEditableColIndex !== -1) {
            moveToCell(currentRowIndex + 1, firstEditableColIndex)
          }
        } else if (e.shiftKey && currentRowIndex > 0) {
          // Move to last editable column of previous row
          const lastEditableColIndex = findNextEditableColumn(columns.length, -1)
          if (lastEditableColIndex !== -1) {
            moveToCell(currentRowIndex - 1, lastEditableColIndex)
          }
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex - 1, currentColIndex)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
        const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
        moveToCell(currentRowIndex + 1, currentColIndex)
      }
    } else if (e.key === 'ArrowLeft' && e.currentTarget instanceof HTMLInputElement) {
      // Only move to prev cell if cursor is at start of input (not for select)
      const input = e.currentTarget
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
          const prevColIndex = findNextEditableColumn(currentColIndex, -1)
          if (prevColIndex !== -1) {
            moveToCell(currentRowIndex, prevColIndex)
          } else if (currentRowIndex > 0) {
            // Move to last editable column of previous row
            const lastEditableColIndex = findNextEditableColumn(columns.length, -1)
            if (lastEditableColIndex !== -1) {
              moveToCell(currentRowIndex - 1, lastEditableColIndex)
            }
          }
        }
      }
    } else if (e.key === 'ArrowRight' && e.currentTarget instanceof HTMLInputElement) {
      // Only move to next cell if cursor is at end of input (not for select)
      const input = e.currentTarget
      const len = input.value.length
      if (input.selectionStart === len && input.selectionEnd === len) {
        e.preventDefault()
        commitEdit()
        if (editingCell) {
          const currentRowIndex = localRows.findIndex((r) => r.id === editingCell.rowId)
          const currentColIndex = columns.findIndex((c) => c.key === editingCell.colKey)
          const nextColIndex = findNextEditableColumn(currentColIndex, 1)
          if (nextColIndex !== -1) {
            moveToCell(currentRowIndex, nextColIndex)
          } else if (currentRowIndex < localRows.length - 1) {
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditValue(e.target.value)
  }

  const handleCellClick = (row: OpsBatchRow, column: ColumnDef) => {
    onSelectOrder?.(row.purchaseOrderId)
    onSelectBatch?.(row.id)
    if (column.editable) {
      startEditing(row.id, column.key, row[column.key] ?? '')
    }
  }

  const handleCellBlur = () => {
    commitEdit()
  }

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = e.target.value
    setEditValue(nextValue)
    // Commit with the selected value (avoid stale `editValue` closures)
    commitEdit(nextValue)
  }

  const formatDisplayValue = (row: OpsBatchRow, column: ColumnDef): string => {
    const value = row[column.key]
    if (!value) return ''

    if (column.type === 'numeric') {
      const num = sanitizeNumeric(value)
      if (Number.isNaN(num)) return value
      if (column.key === 'quantity') return num.toLocaleString()
      return `$${num.toFixed(column.precision ?? 2)}`
    }

    if (column.type === 'percent') {
      const num = sanitizeNumeric(value)
      if (Number.isNaN(num)) return value
      return `${(num * 100).toFixed(column.precision ?? 2)}%`
    }

    return value
  }

  const renderCell = (row: OpsBatchRow, column: ColumnDef) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === column.key
    const displayValue = formatDisplayValue(row, column)

    const cellClasses = [
      column.editable ? 'ops-cell-editable' : 'ops-cell-readonly',
      column.type === 'numeric' || column.type === 'percent' ? 'ops-cell-numeric' : '',
      column.type === 'dropdown' ? 'ops-cell-select' : '',
    ]
      .filter(Boolean)
      .join(' ')

    if (isEditing) {
      if (column.type === 'dropdown') {
        return (
          <td
            key={column.key}
            className={cellClasses}
            style={{ width: column.width, minWidth: column.width }}
          >
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={editValue}
              onChange={handleSelectChange}
              onKeyDown={handleKeyDown}
              onBlur={handleCellBlur}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <option value="">Select product...</option>
              {products.map((product) => (
                <option key={product.id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>
          </td>
        )
      }

      return (
        <td
          key={column.key}
          className={cellClasses}
          style={{ width: column.width, minWidth: column.width }}
        >
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleCellBlur}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            className="ops-cell-input"
            placeholder={column.type === 'percent' ? 'e.g. 10 for 10%' : undefined}
          />
        </td>
      )
    }

    return (
      <td
        key={column.key}
        className={cellClasses}
        style={{ width: column.width, minWidth: column.width }}
        onClick={(event) => {
          event.stopPropagation()
          handleCellClick(row, column)
        }}
      >
        <div className="ops-cell-display">{displayValue}</div>
      </td>
    )
  }

  const isRowActive = (row: OpsBatchRow): boolean => {
    if (activeBatchId && row.id === activeBatchId) return true
    if (!activeBatchId && activeOrderId && row.purchaseOrderId === activeOrderId) return true
    return false
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            Batch Table
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddBatch ? (
            <button
              type="button"
              onClick={onAddBatch}
              disabled={Boolean(disableAdd)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:focus:ring-cyan-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add batch
            </button>
          ) : null}
          {onDeleteBatch ? (
            <button
              type="button"
              onClick={onDeleteBatch}
              disabled={Boolean(disableDelete) || !activeBatchId}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:focus:ring-rose-400/60 dark:focus:ring-offset-slate-900 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
            >
              Remove batch
            </button>
          ) : null}
        </div>
      </header>

      <div className="ops-table-container">
        <div className="ops-table-body-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
                    {column.key === 'tariffRate' || column.key === 'tariffCost' ? (
                      <button
                        type="button"
                        className="ops-header-toggle"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toggleTariffInputMode()
                        }}
                        title={tariffInputMode === 'rate' ? 'Switch to Tariff $/unit' : 'Switch to Tariff %'}
                      >
                        {column.header}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="ops-table-empty">
                    {activeOrderId
                      ? 'No batches for this order. Click "Add batch" to add cost details.'
                      : 'Select a purchase order above to view or add batches.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={isRowActive(row) ? 'row-active' : ''}
                  >
                    {columns.map((column) => renderCell(row, column))}
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
