'use client'

import { addWeeks } from 'date-fns'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { SelectionStatsBar } from '@/components/ui/selection-stats-bar'
import {
  formatNumericInput,
  parseNumericInput,
  sanitizeNumeric,
} from '@/components/sheets/validators'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'
import { usePersistentState } from '@/hooks/usePersistentState'
import { withAppBasePath } from '@/lib/base-path'
import type { HandsontableSelectionStats } from '@/lib/handsontable'
import { formatDateDisplay } from '@/lib/utils/dates'

const PLANNING_ANCHOR_WEEK = 1
const PLANNING_ANCHOR_DATE = new Date('2025-01-05T00:00:00.000Z')

function formatWeekDateFallback(weekNumber: number): string {
  return formatDateDisplay(addWeeks(PLANNING_ANCHOR_DATE, weekNumber - PLANNING_ANCHOR_WEEK))
}

type SalesRow = {
  weekNumber: string
  weekLabel: string
  weekDate: string
  arrivalDetail?: string
  arrivalNote?: string
  [key: string]: string | undefined
}

type ColumnMeta = Record<string, { productId: string; field: string }>
type NestedHeaderCell = string | { label: string; colspan?: number; rowspan?: number }

const editableMetrics = new Set(['actualSales', 'forecastSales'])
const BASE_SALES_METRICS = [
  'stockStart',
  'actualSales',
  'forecastSales',
  'finalSales',
  'finalSalesError',
] as const
const STOCK_METRIC_OPTIONS = [
  { id: 'stockWeeks', label: 'Stockout' },
  { id: 'stockEnd', label: 'Stock Qty' },
] as const
type StockMetricId = (typeof STOCK_METRIC_OPTIONS)[number]['id']

function isEditableMetric(field: string | undefined) {
  return Boolean(field && editableMetrics.has(field))
}

type SalesUpdate = {
  productId: string
  weekNumber: number
  values: Record<string, string>
}

type SalesPlanningFocusContextValue = {
  focusProductId: string
  setFocusProductId: (value: string) => void
}

const SalesPlanningFocusContext = createContext<SalesPlanningFocusContextValue | null>(null)

export function useSalesPlanningFocus() {
  return useContext(SalesPlanningFocusContext)
}

export function SalesPlanningFocusProvider({ children }: { children: ReactNode }) {
  const [focusProductId, setFocusProductId] = usePersistentState<string>(
    'xplan:sales-grid:focus-product',
    'ALL'
  )
  const value = useMemo(
    () => ({ focusProductId, setFocusProductId }),
    [focusProductId, setFocusProductId]
  )
  return (
    <SalesPlanningFocusContext.Provider value={value}>
      {children}
    </SalesPlanningFocusContext.Provider>
  )
}

export function SalesPlanningFocusControl({
  productOptions,
}: {
  productOptions: Array<{ id: string; name: string }>
}) {
  const context = useContext(SalesPlanningFocusContext)
  if (!context) return null
  const { focusProductId, setFocusProductId } = context

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">
        Focus SKU
      </span>
      <select
        value={focusProductId}
        onChange={(event) => setFocusProductId(event.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="ALL">Show all</option>
        {productOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  )
}

type BatchAllocationMeta = {
  orderCode: string
  batchCode?: string | null
  quantity: number
  sellingPrice: number
  landedUnitCost: number
}

type LeadTimeByProduct = Record<
  string,
  {
    productionWeeks: number
    sourceWeeks: number
    oceanWeeks: number
    finalWeeks: number
    totalWeeks: number
  }
>

type ReorderCueMeta = {
  startWeekNumber: number
  startWeekLabel: string | null
  startYear: number | null
  startDate: string
  breachWeekNumber: number
  breachWeekLabel: string | null
  breachYear: number | null
  breachDate: string
  leadTimeWeeks: number
}

interface SalesPlanningGridProps {
  strategyId: string
  rows: SalesRow[]
  hiddenRowIndices?: number[]
  columnMeta: ColumnMeta
  nestedHeaders: NestedHeaderCell[][]
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
  stockWarningWeeks: number
  leadTimeByProduct: LeadTimeByProduct
  batchAllocations: Map<string, BatchAllocationMeta[]>
  reorderCueByProduct: Map<string, ReorderCueMeta>
}

type CellCoords = { row: number; col: number }
type CellRange = { from: CellCoords; to: CellCoords }

function normalizeRange(range: CellRange): { top: number; bottom: number; left: number; right: number } {
  const top = Math.min(range.from.row, range.to.row)
  const bottom = Math.max(range.from.row, range.to.row)
  const left = Math.min(range.from.col, range.to.col)
  const right = Math.max(range.from.col, range.to.col)
  return { top, bottom, left, right }
}

function formatNumberDisplay(value: unknown, useGrouping: boolean): string {
  const parsed = typeof value === 'number' ? value : sanitizeNumeric(value)
  if (!Number.isFinite(parsed)) return ''
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping,
  })
}

function formatBatchComment(allocations: BatchAllocationMeta[]): string {
  if (!allocations || allocations.length === 0) return ''
  const lines = allocations.map((alloc) => {
    const batchId = alloc.batchCode || alloc.orderCode
    const qty = Number(alloc.quantity).toFixed(0)
    const price = Number(alloc.sellingPrice).toFixed(2)
    const cost = Number(alloc.landedUnitCost).toFixed(3)
    return `${batchId}: ${qty} units @ $${price} (cost: $${cost})`
  })
  return `FIFO Batch Allocation:\n${lines.join('\n')}`
}

function parseNumericCandidate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let raw = value.trim()
  if (!raw || raw === '∞') return null

  let isNegative = false
  if (raw.startsWith('(') && raw.endsWith(')')) {
    isNegative = true
    raw = raw.slice(1, -1).trim()
  }

  const normalized = raw.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return isNegative ? -parsed : parsed
}

function computeSelectionStatsFromData(
  data: SalesRow[],
  visibleRowIndices: number[],
  columnIds: string[],
  range: CellRange | null
): HandsontableSelectionStats | null {
  if (!range) return null
  const { top, bottom, left, right } = normalizeRange(range)
  if (top < 0 || left < 0) return null

  let cellCount = 0
  let numericCount = 0
  let sum = 0

  for (let rowIndex = top; rowIndex <= bottom; rowIndex += 1) {
    const absoluteRowIndex = visibleRowIndices[rowIndex]
    const row = data[absoluteRowIndex]
    if (!row) continue

    for (let colIndex = left; colIndex <= right; colIndex += 1) {
      const columnId = columnIds[colIndex]
      if (!columnId) continue
      cellCount += 1
      const numeric = parseNumericCandidate(row[columnId])
      if (numeric == null) continue
      numericCount += 1
      sum += numeric
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

export function SalesPlanningGrid({
  strategyId,
  rows,
  hiddenRowIndices,
  columnMeta,
  columnKeys,
  productOptions,
  stockWarningWeeks,
  leadTimeByProduct,
  batchAllocations,
  reorderCueByProduct,
}: SalesPlanningGridProps) {
  const columnHelper = useMemo(() => createColumnHelper<SalesRow>(), [])
  const focusContext = useContext(SalesPlanningFocusContext)
  const focusProductId = focusContext?.focusProductId ?? 'ALL'

  const [activeStockMetric, setActiveStockMetric] = usePersistentState<StockMetricId>(
    'xplan:sales-grid:metric',
    'stockWeeks'
  )
  const [showFinalError, setShowFinalError] = usePersistentState<boolean>(
    'xplan:sales-grid:show-final-error',
    false
  )

  const warningThreshold = Number.isFinite(stockWarningWeeks)
    ? stockWarningWeeks
    : Number.POSITIVE_INFINITY

  const reorderCueByProductRef = useRef<Map<string, ReorderCueMeta>>(new Map())
  useEffect(() => {
    reorderCueByProductRef.current = new Map(reorderCueByProduct)
  }, [reorderCueByProduct])

  const [data, setData] = useState<SalesRow[]>(() => rows.map((row) => ({ ...row })))
  useEffect(() => {
    setData(rows.map((row) => ({ ...row })))
  }, [rows])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const getScrollElement = useCallback(() => scrollRef.current, [])
  usePersistentScroll(`hot:sales-planning:${strategyId}`, true, getScrollElement)

  const preserveGridScroll = useCallback((action: () => void) => {
    const holder = scrollRef.current
    if (!holder) {
      action()
      return
    }
    const top = holder.scrollTop
    const left = holder.scrollLeft
    action()
    requestAnimationFrame(() => {
      const current = scrollRef.current
      if (!current) return
      current.scrollTop = top
      current.scrollLeft = left
    })
  }, [])

  const hiddenRowSet = useMemo(() => new Set(hiddenRowIndices ?? []), [hiddenRowIndices])
  const visibleRowIndices = useMemo(
    () => data.map((_, index) => index).filter((index) => !hiddenRowSet.has(index)),
    [data, hiddenRowSet]
  )
  const visibleRows = useMemo(
    () => visibleRowIndices.map((index) => data[index]).filter(Boolean),
    [data, visibleRowIndices]
  )

  const visibleMetrics = useMemo(() => {
    const metrics = new Set<string>(['stockStart', 'actualSales', 'forecastSales'])
    metrics.add(showFinalError ? 'finalSalesError' : 'finalSales')
    metrics.add(activeStockMetric)
    return metrics
  }, [activeStockMetric, showFinalError])

  const keyByProductField = useMemo(() => {
    const map = new Map<string, Record<string, string>>()
    for (const key of columnKeys) {
      const meta = columnMeta[key]
      if (!meta) continue
      const entry = map.get(meta.productId) ?? {}
      entry[meta.field] = key
      map.set(meta.productId, entry)
    }
    return map
  }, [columnKeys, columnMeta])

  const stockWeeksKeyByProduct = useMemo(() => {
    const map = new Map<string, string>()
    for (const key of columnKeys) {
      const meta = columnMeta[key]
      if (meta?.field === 'stockWeeks') {
        map.set(meta.productId, key)
      }
    }
    return map
  }, [columnKeys, columnMeta])

  const weekDateByNumber = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      map.set(week, row.weekDate ?? '')
    })
    return map
  }, [data])

  const weekLabelByNumber = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      map.set(week, row.weekLabel ?? '')
    })
    return map
  }, [data])

  const hasInboundByWeek = useMemo(() => {
    const set = new Set<number>()
    data.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      if ((row.arrivalDetail ?? '').trim()) {
        set.add(week)
      }
    })
    return set
  }, [data])

  const displayedProducts = useMemo(() => {
    const base =
      focusProductId === 'ALL'
        ? productOptions
        : productOptions.filter((product) => product.id === focusProductId)
    return base.filter((product) => {
      const keys = keyByProductField.get(product.id) ?? {}
      return (
        BASE_SALES_METRICS.some((metric) => keys[metric]) &&
        Boolean(keys.stockWeeks) &&
        Boolean(keys.stockEnd)
      )
    })
  }, [focusProductId, keyByProductField, productOptions])

  const columns = useMemo(() => {
    const metricSequence: string[] = [
      'stockStart',
      'actualSales',
      'forecastSales',
      showFinalError ? 'finalSalesError' : 'finalSales',
      activeStockMetric,
    ]

    const baseColumns = [
      columnHelper.accessor('weekLabel', {
        id: 'weekLabel',
        header: () => 'Week',
        meta: { sticky: true, stickyOffset: 0, width: 80, kind: 'pinned' },
      }),
      columnHelper.accessor('weekDate', {
        id: 'weekDate',
        header: () => 'Date',
        meta: { sticky: true, stickyOffset: 80, width: 120, kind: 'pinned' },
      }),
      columnHelper.accessor((row) => row.arrivalDetail ?? '', {
        id: 'arrivalDetail',
        header: () => 'Inbound PO',
        meta: { sticky: true, stickyOffset: 200, width: 140, kind: 'pinned' },
      }),
    ]

    const productColumns = displayedProducts.flatMap((product) => {
      const keys = keyByProductField.get(product.id) ?? {}
      const currentProductIndex = productOptions.findIndex((option) => option.id === product.id)
      const hasPrev = currentProductIndex > 0
      const hasNext = currentProductIndex >= 0 && currentProductIndex < productOptions.length - 1

      return metricSequence
        .map((field, fieldIndex) => {
          const key = keys[field]
          if (!key) return null
          return columnHelper.accessor((row) => row[key] ?? '', {
            id: key,
            header: () => {
              if (fieldIndex === 0) {
                return (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={!hasPrev && focusProductId !== 'ALL'}
                      onClick={() => {
                        preserveGridScroll(() => {
                          if (!focusContext) return
                          if (focusProductId !== 'ALL' && !hasPrev) {
                            focusContext.setFocusProductId('ALL')
                            return
                          }
                          const prevId = productOptions[currentProductIndex - 1]?.id
                          if (prevId) focusContext.setFocusProductId(prevId)
                        })
                      }}
                    >
                      {focusProductId !== 'ALL' && !hasPrev ? (
                        <LayoutGrid className="h-3 w-3" />
                      ) : (
                        <ChevronLeft className="h-3 w-3" />
                      )}
                    </button>
                    <span className="font-semibold text-foreground">{product.name}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                      disabled={!hasNext}
                      onClick={() => {
                        preserveGridScroll(() => {
                          if (!focusContext || !hasNext) return
                          const nextId = productOptions[currentProductIndex + 1]?.id
                          if (nextId) focusContext.setFocusProductId(nextId)
                        })
                      }}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )
              }

              const labelMap: Record<string, string> = {
                stockStart: 'Stock Start',
                actualSales: 'Actual',
                forecastSales: 'Forecast',
                finalSales: 'Final',
                finalSalesError: '% Error',
                stockWeeks: 'Stockout',
                stockEnd: 'Stock Qty',
              }

              if (field === activeStockMetric) {
                return (
                  <button
                    type="button"
                    className="rounded-md border border-cyan-500/30 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900"
                    onClick={() =>
                      preserveGridScroll(() =>
                        setActiveStockMetric((prev) =>
                          prev === 'stockWeeks' ? 'stockEnd' : 'stockWeeks'
                        )
                      )
                    }
                  >
                    {labelMap[field]}
                  </button>
                )
              }

              if (field === (showFinalError ? 'finalSalesError' : 'finalSales')) {
                return (
                  <button
                    type="button"
                    className="rounded-md border border-cyan-500/30 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900"
                    onClick={() => preserveGridScroll(() => setShowFinalError((prev) => !prev))}
                  >
                    {labelMap[field]}
                  </button>
                )
              }

              return (
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {labelMap[field] ?? field}
                </span>
              )
            },
            meta: {
              kind: 'metric',
              productId: product.id,
              field,
              width: field === 'finalSalesError' ? 80 : 110,
            },
          })
        })
        .filter((col): col is NonNullable<typeof col> => Boolean(col))
    })

    return [...baseColumns, ...productColumns]
  }, [
    activeStockMetric,
    columnHelper,
    displayedProducts,
    focusContext,
    focusProductId,
    keyByProductField,
    preserveGridScroll,
    productOptions,
    setActiveStockMetric,
    setShowFinalError,
    showFinalError,
  ])

  const table = useReactTable({
    data: visibleRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const leafColumns = table.getAllLeafColumns()
  const leafColumnIds = useMemo(() => leafColumns.map((col) => col.id), [leafColumns])

  const [selection, setSelection] = useState<CellRange | null>(null)
  const selectionAnchorRef = useRef<CellCoords | null>(null)
  const selectionRef = useRef<CellRange | null>(null)
  selectionRef.current = selection

  const [activeCell, setActiveCell] = useState<CellCoords | null>(null)
  const [selectionStats, setSelectionStats] = useState<HandsontableSelectionStats | null>(null)

  const [editingCell, setEditingCell] = useState<{
    coords: CellCoords
    columnId: string
    productId: string
    field: string
    value: string
  } | null>(null)

  const recomputeDerivedForProduct = useCallback(
    (productId: string, nextData: SalesRow[], startRowIndex: number | null = null): SalesRow[] => {
      const extractYear = (label: string): number | null => {
        const match = label.match(/(\d{4})\s*$/)
        if (!match) return null
        const year = Number(match[1])
        return Number.isFinite(year) ? year : null
      }

      const keysByField = new Map<string, string>()
      for (const key of columnKeys) {
        const meta = columnMeta[key]
        if (!meta || meta.productId !== productId) continue
        keysByField.set(meta.field, key)
      }

      const stockStartKey = keysByField.get('stockStart')
      const actualSalesKey = keysByField.get('actualSales')
      const forecastSalesKey = keysByField.get('forecastSales')
      const finalSalesKey = keysByField.get('finalSales')
      const finalSalesErrorKey = keysByField.get('finalSalesError')
      const stockWeeksKey = keysByField.get('stockWeeks')
      const stockEndKey = keysByField.get('stockEnd')

      if (
        !stockStartKey ||
        !actualSalesKey ||
        !forecastSalesKey ||
        !finalSalesKey ||
        !finalSalesErrorKey ||
        !stockWeeksKey ||
        !stockEndKey
      ) {
        return nextData
      }

      const n = nextData.length
      const previousStockStart: number[] = new Array(n)
      const previousStockEnd: number[] = new Array(n)
      const actual: Array<number | null> = new Array(n)
      const forecast: Array<number | null> = new Array(n)

      for (let i = 0; i < n; i += 1) {
        const row = nextData[i]
        previousStockStart[i] = parseNumericInput(row?.[stockStartKey]) ?? 0
        previousStockEnd[i] = parseNumericInput(row?.[stockEndKey]) ?? 0
        actual[i] = parseNumericInput(row?.[actualSalesKey])
        forecast[i] = parseNumericInput(row?.[forecastSalesKey])
      }

      const inboundDelta: number[] = new Array(n).fill(0)
      for (let i = 1; i < n; i += 1) {
        inboundDelta[i] = previousStockStart[i] - previousStockEnd[i - 1]
      }

      const nextStockStart: number[] = new Array(n)
      const nextFinalSales: number[] = new Array(n)
      const nextStockEnd: number[] = new Array(n)
      const nextError: Array<number | null> = new Array(n)

      nextStockStart[0] = previousStockStart[0]

      for (let i = 0; i < n; i += 1) {
        const demand = actual[i] ?? forecast[i] ?? 0
        nextFinalSales[i] = Math.max(0, demand)
        nextStockEnd[i] = nextStockStart[i] - nextFinalSales[i]

        if (i + 1 < n) {
          nextStockStart[i + 1] = nextStockEnd[i] + inboundDelta[i + 1]
        }

        if (actual[i] != null && forecast[i] != null && forecast[i] !== 0) {
          nextError[i] = (actual[i]! - forecast[i]!) / Math.abs(forecast[i]!)
        } else {
          nextError[i] = null
        }
      }

      const nextStockWeeks: number[] = new Array(n)
      const depletionIndexByRow: Array<number | null> = new Array(n).fill(null)
      let nextDepletionIndex: number | null = null

      for (let i = n - 1; i >= 0; i -= 1) {
        if (nextStockEnd[i] <= 0) {
          nextDepletionIndex = i
        }
        depletionIndexByRow[i] = nextDepletionIndex
      }

      const fractionAtDepletion: number[] = new Array(n).fill(0)
      for (let i = 0; i < n; i += 1) {
        if (nextStockEnd[i] > 0) continue
        const depletionSales = nextFinalSales[i]
        const depletionStart = nextStockStart[i]
        fractionAtDepletion[i] = depletionSales > 0 ? depletionStart / depletionSales : 0
      }

      for (let i = 0; i < n; i += 1) {
        const depletionIndex = depletionIndexByRow[i]
        if (depletionIndex == null) {
          nextStockWeeks[i] = Number.POSITIVE_INFINITY
          continue
        }
        nextStockWeeks[i] = depletionIndex - i + fractionAtDepletion[depletionIndex]
      }

      if (Number.isFinite(warningThreshold) && warningThreshold > 0) {
        const leadProfile = leadTimeByProduct[productId]
        const leadTimeWeeks = leadProfile
          ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks)))
          : 0
        if (leadTimeWeeks > 0) {
          let hasBeenAbove = false
          let breachIndex: number | null = null
          for (let i = 0; i < n; i += 1) {
            const weeksValue = nextStockWeeks[i]
            if (!Number.isFinite(weeksValue)) {
              hasBeenAbove = true
              continue
            }
            const isBelow = weeksValue <= warningThreshold
            if (isBelow && hasBeenAbove) {
              breachIndex = i
              break
            }
            if (!isBelow) {
              hasBeenAbove = true
            }
          }

          if (breachIndex != null) {
            const breachWeekNumber = Number(nextData[breachIndex]?.weekNumber)
            if (!Number.isFinite(breachWeekNumber)) {
              reorderCueByProductRef.current.delete(productId)
            } else {
              const startWeekNumber = breachWeekNumber - leadTimeWeeks
              const breachWeekLabel = nextData[breachIndex]?.weekLabel ?? null
              const startWeekLabel = weekLabelByNumber.get(startWeekNumber) || null
              const startDate =
                weekDateByNumber.get(startWeekNumber) || formatWeekDateFallback(startWeekNumber)
              const breachDate =
                nextData[breachIndex]?.weekDate ||
                weekDateByNumber.get(breachWeekNumber) ||
                formatWeekDateFallback(breachWeekNumber)

              reorderCueByProductRef.current.set(productId, {
                startWeekNumber,
                startWeekLabel,
                startYear: extractYear(startDate),
                startDate,
                breachWeekNumber,
                breachWeekLabel,
                breachYear: extractYear(breachDate),
                breachDate,
                leadTimeWeeks,
              })
            }
          } else {
            reorderCueByProductRef.current.delete(productId)
          }
        } else {
          reorderCueByProductRef.current.delete(productId)
        }
      }

      const changes: Array<[number, string, string]> = []
      for (let i = 0; i < n; i += 1) {
        const row = nextData[i]

        const stockStartValue = Number.isFinite(nextStockStart[i]) ? nextStockStart[i].toFixed(2) : ''
        const finalSalesValue = Number.isFinite(nextFinalSales[i]) ? nextFinalSales[i].toFixed(2) : ''
        const stockEndValue = Number.isFinite(nextStockEnd[i]) ? nextStockEnd[i].toFixed(2) : ''
        const stockWeeksValue = Number.isFinite(nextStockWeeks[i]) ? nextStockWeeks[i].toFixed(2) : '∞'
        const errorValue = nextError[i] == null ? '' : `${(nextError[i]! * 100).toFixed(1)}%`

        if (row?.[stockStartKey] !== stockStartValue) changes.push([i, stockStartKey, stockStartValue])
        if (row?.[finalSalesKey] !== finalSalesValue) changes.push([i, finalSalesKey, finalSalesValue])
        if (row?.[stockEndKey] !== stockEndValue) changes.push([i, stockEndKey, stockEndValue])
        if (row?.[stockWeeksKey] !== stockWeeksValue) changes.push([i, stockWeeksKey, stockWeeksValue])
        if (row?.[finalSalesErrorKey] !== errorValue) changes.push([i, finalSalesErrorKey, errorValue])
      }

      const startIndex = Math.max(0, Math.min(n - 1, startRowIndex ?? 0))
      const slicedChanges =
        startIndex === 0 ? changes : changes.filter(([rowIndex]) => rowIndex >= startIndex)

      if (slicedChanges.length === 0) return nextData

      const next = nextData.slice()
      const updatedRows = new Map<number, SalesRow>()
      for (const [rowIndex, prop, value] of slicedChanges) {
        const base = updatedRows.get(rowIndex) ?? { ...(next[rowIndex] ?? {}) }
        base[prop] = value
        updatedRows.set(rowIndex, base)
      }
      updatedRows.forEach((row, rowIndex) => {
        next[rowIndex] = row
      })
      return next
    },
    [columnKeys, columnMeta, leadTimeByProduct, warningThreshold, weekDateByNumber, weekLabelByNumber]
  )

  const handleFlush = useCallback(
    async (payload: SalesUpdate[]) => {
      if (payload.length === 0) return
      try {
        const response = await fetch(withAppBasePath('/api/v1/x-plan/sales-weeks'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategyId, updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update sales planning')
        toast.success('Sales planning updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save sales planning changes')
      }
    },
    [strategyId]
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<string, SalesUpdate>({
    debounceMs: 600,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {})
    }
  }, [flushNow])

  const queueUpdate = useCallback(
    (productId: string, weekNumber: number, field: string, value: string) => {
      const key = `${productId}-${weekNumber}`
      if (!pendingRef.current.has(key)) {
        pendingRef.current.set(key, { productId, weekNumber, values: {} })
      }
      const entry = pendingRef.current.get(key)
      if (!entry) return
      entry.values[field] = value
      scheduleFlush()
    },
    [pendingRef, scheduleFlush]
  )

  const applyEdits = useCallback(
    (edits: Array<{ visibleRowIndex: number; columnId: string; rawValue: string }>) => {
      if (edits.length === 0) return

      const editsByProduct = new Map<string, { minRow: number; items: typeof edits }>()
      const queued: Array<{ productId: string; weekNumber: number; field: string; value: string }> = []

      edits.forEach((edit) => {
        const colMeta = columnMeta[edit.columnId]
        if (!colMeta || !isEditableMetric(colMeta.field)) return

        const absoluteRowIndex = visibleRowIndices[edit.visibleRowIndex]
        const row = data[absoluteRowIndex]
        if (!row) return
        const weekNumber = Number(row.weekNumber)
        if (!Number.isFinite(weekNumber)) return

        const formatted = formatNumericInput(edit.rawValue)

        queued.push({
          productId: colMeta.productId,
          weekNumber,
          field: colMeta.field,
          value: formatted,
        })

        const existing = editsByProduct.get(colMeta.productId)
        if (!existing) {
          editsByProduct.set(colMeta.productId, { minRow: absoluteRowIndex, items: [edit] })
        } else {
          existing.items.push(edit)
          existing.minRow = Math.min(existing.minRow, absoluteRowIndex)
        }
      })

      if (queued.length === 0) return

      setData((prev) => {
        let next = prev.slice()

        const touchedRows = new Map<number, SalesRow>()
        edits.forEach((edit) => {
          const colMeta = columnMeta[edit.columnId]
          if (!colMeta || !isEditableMetric(colMeta.field)) return

          const absoluteRowIndex = visibleRowIndices[edit.visibleRowIndex]
          const current = touchedRows.get(absoluteRowIndex) ?? { ...(next[absoluteRowIndex] ?? {}) }
          current[edit.columnId] = formatNumericInput(edit.rawValue)
          touchedRows.set(absoluteRowIndex, current)
        })

        touchedRows.forEach((rowValue, rowIndex) => {
          next[rowIndex] = rowValue
        })

        for (const [productId, payload] of editsByProduct.entries()) {
          next = recomputeDerivedForProduct(productId, next, payload.minRow)
        }

        return next
      })

      queued.forEach((item) => queueUpdate(item.productId, item.weekNumber, item.field, item.value))
    },
    [columnMeta, data, queueUpdate, recomputeDerivedForProduct, visibleRowIndices]
  )

  const startEditing = useCallback(
    (coords: CellCoords) => {
      const columnId = leafColumnIds[coords.col]
      if (!columnId) return
      const meta = columnMeta[columnId]
      if (!meta || !isEditableMetric(meta.field)) return

      const absoluteRowIndex = visibleRowIndices[coords.row]
      const row = data[absoluteRowIndex]
      if (!row) return

      setEditingCell({
        coords,
        columnId,
        productId: meta.productId,
        field: meta.field,
        value: row[columnId] ?? '',
      })
    },
    [columnMeta, data, leafColumnIds, visibleRowIndices]
  )

  const commitEditing = useCallback(() => {
    if (!editingCell) return
    applyEdits([
      {
        visibleRowIndex: editingCell.coords.row,
        columnId: editingCell.columnId,
        rawValue: editingCell.value,
      },
    ])
    setEditingCell(null)
  }, [applyEdits, editingCell])

  const cancelEditing = useCallback(() => setEditingCell(null), [])

  const moveActiveCell = useCallback(
    (deltaRow: number, deltaCol: number) => {
      if (!activeCell) return
      const nextRow = Math.max(0, Math.min(visibleRows.length - 1, activeCell.row + deltaRow))
      const nextCol = Math.max(0, Math.min(leafColumnIds.length - 1, activeCell.col + deltaCol))
      const nextCoords = { row: nextRow, col: nextCol }
      setActiveCell(nextCoords)
      setSelection({ from: nextCoords, to: nextCoords })
      selectionAnchorRef.current = nextCoords
      setSelectionStats(
        computeSelectionStatsFromData(data, visibleRowIndices, leafColumnIds, {
          from: nextCoords,
          to: nextCoords,
        })
      )
    },
    [activeCell, data, leafColumnIds, visibleRowIndices, visibleRows.length]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelEditing()
        }
        return
      }

      if (!activeCell) return

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'c') {
        return
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'v') {
        return
      }

      if (event.key === 'Enter') {
        const columnId = leafColumnIds[activeCell.col]
        const meta = columnId ? columnMeta[columnId] : undefined
        if (meta && isEditableMetric(meta.field)) {
          event.preventDefault()
          startEditing(activeCell)
          return
        }
        moveActiveCell(1, 0)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveActiveCell(1, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveActiveCell(-1, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveActiveCell(0, 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveActiveCell(0, -1)
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        const columnId = leafColumnIds[activeCell.col]
        const meta = columnId ? columnMeta[columnId] : undefined
        if (!meta || !isEditableMetric(meta.field)) return
        event.preventDefault()
        applyEdits([{ visibleRowIndex: activeCell.row, columnId, rawValue: '' }])
        return
      }

      if (/^[0-9.,-]$/.test(event.key)) {
        const columnId = leafColumnIds[activeCell.col]
        const meta = columnId ? columnMeta[columnId] : undefined
        if (!meta || !isEditableMetric(meta.field)) return
        event.preventDefault()
        setEditingCell({
          coords: activeCell,
          columnId,
          productId: meta.productId,
          field: meta.field,
          value: event.key,
        })
      }
    },
    [
      activeCell,
      applyEdits,
      cancelEditing,
      columnMeta,
      editingCell,
      leafColumnIds,
      moveActiveCell,
      startEditing,
    ]
  )

  const handleCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!selectionRef.current) return
      const range = normalizeRange(selectionRef.current)
      const lines: string[] = []

      for (let rowIndex = range.top; rowIndex <= range.bottom; rowIndex += 1) {
        const absoluteRowIndex = visibleRowIndices[rowIndex]
        const row = data[absoluteRowIndex]
        if (!row) continue

        const parts: string[] = []
        for (let colIndex = range.left; colIndex <= range.right; colIndex += 1) {
          const columnId = leafColumnIds[colIndex]
          if (!columnId) continue
          parts.push(row[columnId] ?? '')
        }
        lines.push(parts.join('\t'))
      }

      event.preventDefault()
      event.clipboardData.setData('text/plain', lines.join('\n'))
    },
    [data, leafColumnIds, visibleRowIndices]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!activeCell) return
      const text = event.clipboardData.getData('text/plain')
      if (!text) return
      event.preventDefault()

      const rowsMatrix = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => line.split('\t'))

      if (rowsMatrix.length === 0) return

      const edits: Array<{ visibleRowIndex: number; columnId: string; rawValue: string }> = []
      for (let r = 0; r < rowsMatrix.length; r += 1) {
        for (let c = 0; c < rowsMatrix[r]!.length; c += 1) {
          const targetRow = activeCell.row + r
          const targetCol = activeCell.col + c
          if (targetRow >= visibleRows.length) continue
          if (targetCol >= leafColumnIds.length) continue
          const columnId = leafColumnIds[targetCol]
          if (!columnId) continue
          edits.push({
            visibleRowIndex: targetRow,
            columnId,
            rawValue: rowsMatrix[r]![c] ?? '',
          })
        }
      }

      applyEdits(edits)
    },
    [activeCell, applyEdits, leafColumnIds, visibleRows.length]
  )

  const handlePointerDown = useCallback((event: PointerEvent<HTMLTableCellElement>, row: number, col: number) => {
    scrollRef.current?.focus()

    const coords = { row, col }
    setActiveCell(coords)

    if (event.shiftKey && selectionAnchorRef.current) {
      const nextRange = { from: selectionAnchorRef.current, to: coords }
      setSelection(nextRange)
      return
    }

    selectionAnchorRef.current = coords
    setSelection({ from: coords, to: coords })
    setSelectionStats(null)
  }, [])

  const handlePointerMove = useCallback((event: PointerEvent<HTMLTableCellElement>, row: number, col: number) => {
    if (!event.buttons) return
    if (!selectionAnchorRef.current) return
    setSelection({ from: selectionAnchorRef.current, to: { row, col } })
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!selectionRef.current) return
    setSelectionStats(
      computeSelectionStatsFromData(data, visibleRowIndices, leafColumnIds, selectionRef.current)
    )
  }, [data, leafColumnIds, visibleRowIndices])

  const handleDoubleClick = useCallback(
    (row: number, col: number) => {
      startEditing({ row, col })
    },
    [startEditing]
  )

  const getCellPresentation = useCallback(
    (visibleRowIndex: number, columnId: string) => {
      const absoluteRowIndex = visibleRowIndices[visibleRowIndex]
      const row = data[absoluteRowIndex]
      const colMeta = columnMeta[columnId]
      const weekNumber = Number(row?.weekNumber)
      const hasInbound = Number.isFinite(weekNumber) && hasInboundByWeek.has(weekNumber)

      if (!row) {
        return { display: '', isEditable: false, isWarning: false, isReorder: false, tooltip: '' }
      }

      if (columnId === 'weekLabel' || columnId === 'weekDate') {
        return {
          display: row[columnId] ?? '',
          isEditable: false,
          isWarning: false,
          isReorder: false,
          hasInbound,
          tooltip: '',
        }
      }

      if (columnId === 'arrivalDetail') {
        return {
          display: row.arrivalDetail ?? '',
          isEditable: false,
          isWarning: false,
          isReorder: false,
          hasInbound,
          tooltip: row.arrivalNote ?? '',
        }
      }

      const field = colMeta?.field
      const editable = isEditableMetric(field)
      let tooltipText = ''
      let isWarning = false
      let isReorder = false

      const productId = colMeta?.productId
      const reorderInfo = productId ? reorderCueByProductRef.current.get(productId) : undefined
      const isReorderWeek = reorderInfo != null && reorderInfo.startWeekNumber === weekNumber

      if (productId && isReorderWeek && field && visibleMetrics.has(field)) {
        isReorder = true
      }

      const weeksKey = productId ? stockWeeksKeyByProduct.get(productId) : undefined
      const rawWeeks = weeksKey ? row[weeksKey] : undefined

      if (field === 'stockWeeks' && rawWeeks === '∞') {
        const previousValue =
          visibleRowIndex > 0 ? data[visibleRowIndices[visibleRowIndex - 1]]?.[weeksKey ?? ''] : undefined
        const isFirstInfinity = visibleRowIndex === 0 || previousValue !== '∞'
        if (isFirstInfinity) {
          tooltipText =
            `Stockout (Weeks) is forward-looking coverage until projected inventory reaches 0.\n` +
            `∞ means inventory never reaches 0 within the loaded horizon.`
        }
      }

      const isStockColumn = field === activeStockMetric
      if (productId && isStockColumn && weeksKey) {
        const weeksNumeric = parseNumericInput(rawWeeks)
        const isBelowThreshold = weeksNumeric != null && weeksNumeric <= warningThreshold
        if (isBelowThreshold) {
          isWarning = true
          const leadProfile = leadTimeByProduct[productId]
          const leadTimeWeeks = leadProfile ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks))) : 0
          if (Number.isFinite(weekNumber) && leadTimeWeeks > 0 && !tooltipText) {
            const startWeekRaw = weekNumber - leadTimeWeeks
            const startDate = weekDateByNumber.get(startWeekRaw) || formatWeekDateFallback(startWeekRaw)
            tooltipText = `Low stock warning (≤ ${warningThreshold}w).\nSuggested production start: ${startDate}.`
          }
        }
      }

      if (field === 'finalSales') {
        const cellKey = `${weekNumber}-${columnId}`
        const allocations = batchAllocations.get(cellKey)
        if (allocations && allocations.length > 0) {
          tooltipText = tooltipText || formatBatchComment(allocations)
        }
      }

      const raw = row[columnId] ?? ''
      if (field === 'finalSalesError') {
        return { display: raw, isEditable: false, isWarning, isReorder, hasInbound, tooltip: tooltipText }
      }

      if (raw === '∞') {
        return { display: '∞', isEditable: editable, isWarning, isReorder, hasInbound, tooltip: tooltipText }
      }

      if (!raw) {
        return { display: '', isEditable: editable, isWarning, isReorder, hasInbound, tooltip: tooltipText }
      }

      return {
        display: formatNumberDisplay(raw, !editable),
        isEditable: editable,
        isWarning,
        isReorder,
        hasInbound,
        tooltip: tooltipText,
      }
    },
    [
      activeStockMetric,
      batchAllocations,
      columnMeta,
      data,
      hasInboundByWeek,
      leadTimeByProduct,
      stockWeeksKeyByProduct,
      visibleMetrics,
      visibleRowIndices,
      warningThreshold,
      weekDateByNumber,
    ]
  )

  const headerGroups = table.getHeaderGroups()

  return (
    <div className="p-4">
      <div
        className="relative overflow-hidden rounded-xl border bg-card shadow-sm"
        style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
          <div
            ref={scrollRef}
            tabIndex={0}
            className="h-full overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onKeyDown={handleKeyDown}
            onCopy={handleCopy}
            onPaste={handlePaste}
          >
            <Table className="relative">
              <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                {headerGroups.map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header, colIndex) => {
                      const meta = header.column.columnDef.meta as
                        | { sticky?: boolean; stickyOffset?: number; width?: number }
                        | undefined
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            'h-10 whitespace-nowrap border-r border-border/50 px-3 text-center',
                            meta?.sticky && 'sticky z-30 bg-muted/95 backdrop-blur'
                          )}
                          style={{
                            left: meta?.sticky ? meta.stickyOffset : undefined,
                            width: meta?.width,
                            minWidth: meta?.width,
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row, visibleRowIndex) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {leafColumns.map((column, colIndex) => {
                      const meta = column.columnDef.meta as
                        | { sticky?: boolean; stickyOffset?: number; width?: number; field?: string }
                        | undefined
                      const presentation = getCellPresentation(visibleRowIndex, column.id)
                      const isSelected = selection
                        ? (() => {
                            const range = normalizeRange(selection)
                            return (
                              visibleRowIndex >= range.top &&
                              visibleRowIndex <= range.bottom &&
                              colIndex >= range.left &&
                              colIndex <= range.right
                            )
                          })()
                        : false
                      const isCurrent =
                        activeCell?.row === visibleRowIndex && activeCell?.col === colIndex
                      const isEditing =
                        editingCell?.coords.row === visibleRowIndex &&
                        editingCell?.coords.col === colIndex

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
                          className="h-7 w-full rounded-none border-0 bg-cyan-50 px-2 text-right text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-cyan-950"
                        />
                      ) : (
                        <div
                          className={cn(
                            'truncate tabular-nums',
                            colIndex <= 2 ? 'text-left' : 'text-right',
                            presentation.isEditable && 'font-medium'
                          )}
                        >
                          {presentation.display}
                        </div>
                      )

                      const cell = (
                        <TableCell
                          key={column.id}
                          className={cn(
                            'h-8 whitespace-nowrap border-r border-border/30 px-3 py-0 text-sm transition-colors',
                            meta?.sticky && 'sticky z-10 bg-card',
                            presentation.isEditable &&
                              'cursor-text bg-cyan-50/50 text-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
                            presentation.isWarning &&
                              'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
                            presentation.isReorder &&
                              'ring-2 ring-inset ring-violet-500/50',
                            presentation.hasInbound &&
                              !presentation.isEditable &&
                              !presentation.isWarning &&
                              'bg-emerald-50/50 dark:bg-emerald-950/20',
                            isSelected && 'bg-accent',
                            isCurrent && 'ring-2 ring-inset ring-ring'
                          )}
                          style={{
                            left: meta?.sticky ? meta.stickyOffset : undefined,
                            width: meta?.width,
                            minWidth: meta?.width,
                          }}
                          onPointerDown={(e) => handlePointerDown(e, visibleRowIndex, colIndex)}
                          onPointerMove={(e) => handlePointerMove(e, visibleRowIndex, colIndex)}
                          onPointerUp={handlePointerUp}
                          onDoubleClick={() => handleDoubleClick(visibleRowIndex, colIndex)}
                        >
                          {cellContent}
                        </TableCell>
                      )

                      if (presentation.tooltip) {
                        return (
                          <Tooltip
                            key={column.id}
                            content={presentation.tooltip}
                            position="right"
                          >
                            {cell}
                          </Tooltip>
                        )
                      }

                      return cell
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

        <SelectionStatsBar stats={selectionStats} />
      </div>
    </div>
  )
}
