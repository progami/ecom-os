'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { formatNumericInput, formatPercentInput, sanitizeNumeric } from '@/components/sheets/validators'
import { withAppBasePath } from '@/lib/base-path'
import { Info } from 'lucide-react'
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
  'tariffRate',
  'fbaFee',
  'storagePerMonth',
] as const
type NumericField = (typeof NUMERIC_FIELDS)[number]

const NUMERIC_PRECISION: Record<NumericField, number> = {
  quantity: 0,
  sellingPrice: 2,
  manufacturingCost: 2,
  freightCost: 2,
  tariffRate: 2,
  fbaFee: 2,
  storagePerMonth: 2,
}

const PERCENT_FIELDS = ['tacosPercent', 'referralRate'] as const
type PercentField = (typeof PERCENT_FIELDS)[number]

const PERCENT_PRECISION: Record<PercentField, number> = {
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

const COLUMNS: ColumnDef[] = [
  { key: 'orderCode', header: 'PO Code', width: 140, type: 'text', editable: false },
  { key: 'productName', header: 'Product', width: 200, type: 'dropdown', editable: true },
  { key: 'quantity', header: 'Qty', width: 110, type: 'numeric', editable: true, precision: 0 },
  { key: 'sellingPrice', header: 'Sell $', width: 120, type: 'numeric', editable: true, precision: 2 },
  { key: 'manufacturingCost', header: 'Mfg $', width: 120, type: 'numeric', editable: true, precision: 2 },
  { key: 'freightCost', header: 'Freight $', width: 120, type: 'numeric', editable: true, precision: 2 },
  { key: 'tariffRate', header: 'Tariff $', width: 110, type: 'numeric', editable: true, precision: 2 },
  { key: 'tacosPercent', header: 'TACoS %', width: 110, type: 'percent', editable: true, precision: 2 },
  { key: 'fbaFee', header: 'FBA $', width: 110, type: 'numeric', editable: true, precision: 2 },
  { key: 'referralRate', header: 'Referral %', width: 110, type: 'percent', editable: true, precision: 2 },
  { key: 'storagePerMonth', header: 'Storage $', width: 120, type: 'numeric', editable: true, precision: 2 },
]

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
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof OpsBatchRow } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  const handleFlush = useCallback(
    async (payload: Array<{ id: string; values: Record<string, string | null> }>) => {
      if (payload.length === 0) return
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/purchase-orders/batches'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update batch cost overrides')
        toast.success('Batch cost saved')
        onSync?.()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save batch costs')
      }
    },
    [onSync]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<
    string,
    { id: string; values: Record<string, string | null> }
  >({
    debounceMs: 500,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {})
    }
  }, [flushNow])

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
    const updatedRows = rows.map((r) => (r.id === rowId ? updatedRow : r))
    onRowsChange?.(updatedRows)

    scheduleFlush()
    cancelEditing()
  }, [editingCell, editValue, rows, products, pendingRef, scheduleFlush, onRowsChange])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      // Move to next cell
      if (editingCell) {
        const currentColIndex = COLUMNS.findIndex((c) => c.key === editingCell.colKey)
        const currentRowIndex = rows.findIndex((r) => r.id === editingCell.rowId)
        const nextCol = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1

        if (nextCol >= 0 && nextCol < COLUMNS.length) {
          const nextColumn = COLUMNS[nextCol]
          if (nextColumn.editable) {
            const row = rows[currentRowIndex]
            startEditing(row.id, nextColumn.key, row[nextColumn.key] ?? '')
          }
        } else if (!e.shiftKey && currentRowIndex < rows.length - 1) {
          // Move to first editable column of next row
          const nextRow = rows[currentRowIndex + 1]
          const firstEditableCol = COLUMNS.find((c) => c.editable)
          if (firstEditableCol && nextRow) {
            startEditing(nextRow.id, firstEditableCol.key, nextRow[firstEditableCol.key] ?? '')
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
    setEditValue(e.target.value)
    // Auto-commit on select change
    setTimeout(() => commitEdit(), 0)
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
        onClick={() => handleCellClick(row, column)}
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
          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200/80">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/70 text-cyan-700 dark:border-cyan-300/40 dark:text-cyan-200">
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
            Values display per-unit. Enter total freight, manufacturing, or storage costs and we&apos;ll normalize them by the batch quantity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddBatch ? (
            <button
              type="button"
              onClick={onAddBatch}
              disabled={Boolean(disableAdd)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition enabled:hover:border-cyan-500 enabled:hover:bg-cyan-50 enabled:hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:enabled:hover:border-cyan-300/50 dark:enabled:hover:bg-white/10"
            >
              Add batch
            </button>
          ) : null}
          {onDeleteBatch ? (
            <button
              type="button"
              onClick={onDeleteBatch}
              disabled={Boolean(disableDelete) || !activeBatchId}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 shadow-sm transition enabled:hover:border-rose-500 enabled:hover:bg-rose-100 enabled:hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300 dark:enabled:hover:border-rose-500/80 dark:enabled:hover:bg-rose-500/20"
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
                {COLUMNS.map((column) => (
                  <th key={column.key} style={{ width: column.width, minWidth: column.width }}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="ops-table-empty">
                    No batches yet. Select a purchase order and click &quot;Add batch&quot; to create one.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={isRowActive(row) ? 'row-active' : ''}
                    onClick={() => {
                      onSelectOrder?.(row.purchaseOrderId)
                      onSelectBatch?.(row.id)
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
