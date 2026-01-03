'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ClipboardEvent,
  type PointerEvent,
} from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SelectionStatsBar } from '@/components/ui/selection-stats-bar'
import {
  formatNumericInput,
  sanitizeNumeric,
} from '@/components/sheets/validators'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'
import { withAppBasePath } from '@/lib/base-path'
import type { HandsontableSelectionStats } from '@/lib/handsontable'

type WeeklyRow = {
  weekNumber: string
  weekLabel: string
  weekDate: string
  amazonPayout: string
  inventorySpend: string
  fixedCosts: string
  netCash: string
  cashBalance: string
}

type UpdatePayload = {
  weekNumber: number
  values: Partial<Record<keyof WeeklyRow, string>>
}

interface CashFlowGridProps {
  strategyId: string
  weekly: WeeklyRow[]
}

const columnConfig: Array<{
  key: keyof WeeklyRow
  label: string
  width: number
  format: 'text' | 'currency'
  editable: boolean
  align: 'left' | 'right'
  sticky?: boolean
  stickyOffset?: number
}> = [
  { key: 'weekLabel', label: 'Week', width: 80, format: 'text', editable: false, align: 'left', sticky: true, stickyOffset: 0 },
  { key: 'weekDate', label: 'Date', width: 120, format: 'text', editable: false, align: 'left', sticky: true, stickyOffset: 80 },
  { key: 'amazonPayout', label: 'Amazon Payout', width: 130, format: 'currency', editable: true, align: 'right' },
  { key: 'inventorySpend', label: 'Inventory Purchase', width: 140, format: 'currency', editable: true, align: 'right' },
  { key: 'fixedCosts', label: 'Fixed Costs', width: 120, format: 'currency', editable: true, align: 'right' },
  { key: 'netCash', label: 'Net Cash', width: 130, format: 'currency', editable: false, align: 'right' },
  { key: 'cashBalance', label: 'Cash Balance', width: 130, format: 'currency', editable: false, align: 'right' },
]

type CellCoords = { row: number; col: number }
type CellRange = { from: CellCoords; to: CellCoords }

function normalizeRange(range: CellRange): { top: number; bottom: number; left: number; right: number } {
  return {
    top: Math.min(range.from.row, range.to.row),
    bottom: Math.max(range.from.row, range.to.row),
    left: Math.min(range.from.col, range.to.col),
    right: Math.max(range.from.col, range.to.col),
  }
}

function formatDisplayValue(value: string, format: 'text' | 'currency'): string {
  if (format === 'text') return value
  const numeric = sanitizeNumeric(value)
  if (!Number.isFinite(numeric)) return ''
  return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function parseNumericCandidate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  const normalized = raw.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function computeSelectionStats(
  data: WeeklyRow[],
  columnKeys: (keyof WeeklyRow)[],
  range: CellRange | null
): HandsontableSelectionStats | null {
  if (!range) return null
  const { top, bottom, left, right } = normalizeRange(range)
  if (top < 0 || left < 0) return null

  let cellCount = 0
  let numericCount = 0
  let sum = 0

  for (let rowIndex = top; rowIndex <= bottom; rowIndex += 1) {
    const row = data[rowIndex]
    if (!row) continue
    for (let colIndex = left; colIndex <= right; colIndex += 1) {
      const key = columnKeys[colIndex]
      if (!key) continue
      cellCount += 1
      const numeric = parseNumericCandidate(row[key])
      if (numeric != null) {
        numericCount += 1
        sum += numeric
      }
    }
  }

  if (cellCount === 0) return null
  return {
    rangeCount: 1,
    cellCount,
    numericCount,
    sum,
    average: numericCount > 0 ? sum / numericCount : null,
  }
}

export function CashFlowGrid({ strategyId, weekly }: CashFlowGridProps) {
  const columnHelper = useMemo(() => createColumnHelper<WeeklyRow>(), [])

  const [data, setData] = useState<WeeklyRow[]>(() => weekly.map((row) => ({ ...row })))
  useEffect(() => {
    setData(weekly.map((row) => ({ ...row })))
  }, [weekly])

  const inboundSpendWeeks = useMemo(() => {
    const flags = new Set<number>()
    weekly.forEach((row) => {
      const spend = parseNumericCandidate(row.inventorySpend)
      if (spend != null && Math.abs(spend) > 0) {
        const week = Number(row.weekNumber)
        if (Number.isFinite(week)) flags.add(week)
      }
    })
    return flags
  }, [weekly])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const getScrollElement = useCallback(() => scrollRef.current, [])
  usePersistentScroll(`hot:cash-flow:${strategyId}`, true, getScrollElement)

  const columns = useMemo(() => {
    return columnConfig.map((config) =>
      columnHelper.accessor(config.key, {
        id: config.key,
        header: () => config.label,
        meta: {
          width: config.width,
          format: config.format,
          editable: config.editable,
          align: config.align,
          sticky: config.key === 'weekLabel' || config.key === 'weekDate',
          stickyOffset: config.key === 'weekLabel' ? 0 : config.key === 'weekDate' ? 80 : undefined,
        },
      })
    )
  }, [columnHelper])

  const columnKeys = useMemo(() => columnConfig.map((c) => c.key), [])

  const tableWidth = useMemo(() => columnConfig.reduce((sum, c) => sum + c.width, 0), [])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const [selection, setSelection] = useState<CellRange | null>(null)
  const selectionAnchorRef = useRef<CellCoords | null>(null)
  const [activeCell, setActiveCell] = useState<CellCoords | null>(null)
  const [selectionStats, setSelectionStats] = useState<HandsontableSelectionStats | null>(null)

  const [editingCell, setEditingCell] = useState<{
    coords: CellCoords
    key: keyof WeeklyRow
    value: string
  } | null>(null)

  const handleFlush = useCallback(
    async (payload: UpdatePayload[]) => {
      if (payload.length === 0) return
      try {
        const res = await fetch(withAppBasePath('/api/v1/x-plan/cash-flow'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategyId, updates: payload }),
        })
        if (!res.ok) throw new Error('Failed to update cash flow')
        toast.success('Cash flow updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save cash flow changes')
      }
    },
    [strategyId]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<number, UpdatePayload>({
    debounceMs: 600,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {})
    }
  }, [flushNow])

  const commitEditing = useCallback(() => {
    if (!editingCell) return
    const { coords, key, value } = editingCell
    const rowIndex = coords.row
    const row = data[rowIndex]
    if (!row) {
      setEditingCell(null)
      return
    }

    const formatted = formatNumericInput(value, 2)
    const weekNumber = Number(row.weekNumber)

    setData((prev) => {
      const next = [...prev]
      next[rowIndex] = { ...next[rowIndex], [key]: formatted }
      return next
    })

    if (!pendingRef.current.has(weekNumber)) {
      pendingRef.current.set(weekNumber, { weekNumber, values: {} })
    }
    const entry = pendingRef.current.get(weekNumber)
    if (entry) {
      entry.values[key] = formatted
    }
    scheduleFlush()
    setEditingCell(null)
  }, [data, editingCell, pendingRef, scheduleFlush])

  const cancelEditing = useCallback(() => {
    setEditingCell(null)
  }, [])

  const moveActiveCell = useCallback(
    (deltaRow: number, deltaCol: number) => {
      setActiveCell((prev) => {
        if (!prev) return prev
        const newRow = Math.max(0, Math.min(data.length - 1, prev.row + deltaRow))
        const newCol = Math.max(0, Math.min(columnKeys.length - 1, prev.col + deltaCol))
        return { row: newRow, col: newCol }
      })
      setSelection(null)
    },
    [data.length, columnKeys.length]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveActiveCell(1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveActiveCell(-1, 0)
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault()
        moveActiveCell(0, e.shiftKey ? -1 : 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveActiveCell(0, -1)
      } else if (e.key === 'Enter' && activeCell) {
        e.preventDefault()
        const config = columnConfig[activeCell.col]
        if (config?.editable) {
          const row = data[activeCell.row]
          if (row) {
            setEditingCell({
              coords: activeCell,
              key: config.key,
              value: row[config.key],
            })
          }
        }
      } else if (e.key === 'Escape') {
        setSelection(null)
        setActiveCell(null)
      }
    },
    [activeCell, data, editingCell, moveActiveCell]
  )

  const handleCopy = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (!selection) return
      e.preventDefault()
      const { top, bottom, left, right } = normalizeRange(selection)
      const lines: string[] = []
      for (let rowIndex = top; rowIndex <= bottom; rowIndex += 1) {
        const row = data[rowIndex]
        if (!row) continue
        const cells: string[] = []
        for (let colIndex = left; colIndex <= right; colIndex += 1) {
          const key = columnKeys[colIndex]
          cells.push(key ? row[key] : '')
        }
        lines.push(cells.join('\t'))
      }
      e.clipboardData.setData('text/plain', lines.join('\n'))
    },
    [data, columnKeys, selection]
  )

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
      if (editingCell) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const coords = { row: rowIndex, col: colIndex }
      selectionAnchorRef.current = coords
      setActiveCell(coords)
      setSelection({ from: coords, to: coords })
    },
    [editingCell]
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
      if (!selectionAnchorRef.current) return
      setSelection({ from: selectionAnchorRef.current, to: { row: rowIndex, col: colIndex } })
    },
    []
  )

  const handlePointerUp = useCallback(() => {
    selectionAnchorRef.current = null
  }, [])

  const handleDoubleClick = useCallback(
    (rowIndex: number, colIndex: number) => {
      const config = columnConfig[colIndex]
      if (!config?.editable) return
      const row = data[rowIndex]
      if (!row) return
      setEditingCell({
        coords: { row: rowIndex, col: colIndex },
        key: config.key,
        value: row[config.key],
      })
    },
    [data]
  )

  useEffect(() => {
    setSelectionStats(computeSelectionStats(data, columnKeys, selection))
  }, [data, columnKeys, selection])

  return (
    <div className="p-4">
      <div
        className="relative overflow-hidden rounded-lg border bg-card"
        style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
        <div
          ref={scrollRef}
          tabIndex={0}
          className="h-full overflow-auto outline-none"
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
        >
          <Table
            className="relative border-collapse table-fixed"
            style={{ width: tableWidth, minWidth: tableWidth }}
          >
            <colgroup>
              {columnConfig.map((config) => (
                <col key={config.key} style={{ width: config.width, minWidth: config.width, maxWidth: config.width }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columnConfig.map((config) => (
                  <TableHead
                    key={config.key}
                    className={cn(
                      'sticky top-0 z-20 h-9 whitespace-nowrap border-b border-r bg-muted px-2 text-center text-xs font-semibold',
                      config.sticky && 'z-30'
                    )}
                    style={{
                      left: config.sticky ? config.stickyOffset : undefined,
                      width: config.width,
                      minWidth: config.width,
                    }}
                  >
                    {config.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row, rowIndex) => {
                const weekNumber = Number(row.original.weekNumber)
                const hasInbound = Number.isFinite(weekNumber) && inboundSpendWeeks.has(weekNumber)

                return (
                  <TableRow
                    key={row.id}
                    className={cn('hover:bg-transparent', rowIndex % 2 === 1 && 'bg-muted/30')}
                  >
                    {columnConfig.map((config, colIndex) => {
                      const isSelected = selection
                        ? (() => {
                            const range = normalizeRange(selection)
                            return (
                              rowIndex >= range.top &&
                              rowIndex <= range.bottom &&
                              colIndex >= range.left &&
                              colIndex <= range.right
                            )
                          })()
                        : false
                      const isCurrent = activeCell?.row === rowIndex && activeCell?.col === colIndex
                      const isEditing =
                        editingCell?.coords.row === rowIndex && editingCell?.coords.col === colIndex
                      const isEvenRow = rowIndex % 2 === 1
                      const isPinned = config.sticky

                      const rawValue = row.original[config.key]
                      const displayValue = formatDisplayValue(rawValue, config.format)

                      const cellContent = isEditing ? (
                        <Input
                          autoFocus
                          value={editingCell.value}
                          onChange={(e) =>
                            setEditingCell((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                          }
                          onBlur={commitEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEditing()
                              moveActiveCell(1, 0)
                            } else if (e.key === 'Tab') {
                              e.preventDefault()
                              commitEditing()
                              moveActiveCell(0, e.shiftKey ? -1 : 1)
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEditing()
                            }
                          }}
                          className="h-7 w-full min-w-0 border-primary px-2 text-right text-sm focus-visible:ring-1"
                        />
                      ) : (
                        <span
                          className={cn(
                            'block min-w-0 truncate tabular-nums',
                            config.align === 'left' ? 'text-left' : 'text-right'
                          )}
                        >
                          {displayValue}
                        </span>
                      )

                      return (
                        <TableCell
                          key={config.key}
                          className={cn(
                            'h-8 whitespace-nowrap border-r px-2 text-sm overflow-hidden',
                            isPinned
                              ? isEvenRow
                                ? 'bg-muted'
                                : 'bg-card'
                              : isEvenRow
                                ? 'bg-muted/30'
                                : 'bg-card',
                            isPinned && 'sticky z-10',
                            colIndex === 1 && 'border-r-2',
                            config.editable && 'cursor-text font-medium bg-accent/50',
                            hasInbound && !isPinned && 'bg-success-100/90 dark:bg-success-900/35',
                            isSelected && 'bg-accent',
                            isCurrent && 'ring-2 ring-inset ring-ring'
                          )}
                          style={{
                            left: isPinned ? config.stickyOffset : undefined,
                            width: config.width,
                            minWidth: config.width,
                            maxWidth: config.width,
                          }}
                          onPointerDown={(e) => handlePointerDown(e, rowIndex, colIndex)}
                          onPointerMove={(e) => handlePointerMove(e, rowIndex, colIndex)}
                          onPointerUp={handlePointerUp}
                          onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                        >
                          {cellContent}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <SelectionStatsBar stats={selectionStats} />
      </div>
    </div>
  )
}
