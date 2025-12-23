'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { HotTable } from '@handsontable/react-wrapper'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatNumericInput, numericValidator } from '@/components/sheets/validators'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import { useHandsontableThemeName } from '@/hooks/useHandsontableThemeName'
import { usePersistentHandsontableScroll } from '@/hooks/usePersistentHandsontableScroll'
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar'
import { usePersistentState } from '@/hooks/usePersistentState'
import { withAppBasePath } from '@/lib/base-path'

registerAllModules()

function getHandsontableScroll(hot: Handsontable | null): { top: number; left: number } | null {
  if (!hot?.rootElement) return null
  const holder =
    (hot.rootElement.querySelector('.ht_master .wtHolder') as HTMLElement | null) ??
    (hot.rootElement.querySelector('.wtHolder') as HTMLElement | null)
  if (!holder) return null
  return { top: holder.scrollTop, left: holder.scrollLeft }
}

function restoreHandsontableScroll(hot: Handsontable | null, scroll: { top: number; left: number }) {
  if (!hot?.rootElement) return
  const holder =
    (hot.rootElement.querySelector('.ht_master .wtHolder') as HTMLElement | null) ??
    (hot.rootElement.querySelector('.wtHolder') as HTMLElement | null)
  if (!holder) return
  holder.scrollTop = scroll.top
  holder.scrollLeft = scroll.left
}

type SalesRow = {
  weekNumber: string
  weekDate: string
  arrivalNote?: string
  [key: string]: string | undefined
}

type ColumnMeta = Record<string, { productId: string; field: string }>
type NestedHeaderCell = string | { label: string; colspan?: number; rowspan?: number }
type HandsontableNestedHeaders = NonNullable<Handsontable.GridSettings['nestedHeaders']>
const editableMetrics = new Set(['actualSales', 'forecastSales'])
const BASE_SALES_METRICS = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'finalSalesError'] as const
const STOCK_METRIC_OPTIONS = [
  { id: 'stockWeeks', label: 'Stock (Weeks)' },
  { id: 'stockEnd', label: 'Stock Qty' },
] as const
type StockMetricId = (typeof STOCK_METRIC_OPTIONS)[number]['id']

const WEEK_COLUMN_WIDTH = 92
const DATE_COLUMN_WIDTH = 136
const METRIC_MIN_WIDTH = 132

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

export function SalesPlanningFocusProvider({ children }: { children: ReactNode }) {
  const [focusProductId, setFocusProductId] = usePersistentState<string>('xplan:sales-grid:focus-product', 'ALL')
  const value = useMemo(
    () => ({ focusProductId, setFocusProductId }),
    [focusProductId, setFocusProductId],
  )
  return <SalesPlanningFocusContext.Provider value={value}>{children}</SalesPlanningFocusContext.Provider>
}

export function SalesPlanningFocusControl({ productOptions }: { productOptions: Array<{ id: string; name: string }> }) {
  const context = useContext(SalesPlanningFocusContext)
  if (!context) return null
  const { focusProductId, setFocusProductId } = context

  return (
    <label className={`${SHEET_TOOLBAR_GROUP} cursor-pointer`}>
      <span className={SHEET_TOOLBAR_LABEL}>Focus SKU</span>
      <select
        value={focusProductId}
        onChange={(event) => setFocusProductId(event.target.value)}
        className={SHEET_TOOLBAR_SELECT}
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

interface SalesPlanningGridProps {
  strategyId: string
  rows: SalesRow[]
  columnMeta: ColumnMeta
  nestedHeaders: NestedHeaderCell[][]
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
  stockWarningWeeks: number
  leadTimeByProduct: LeadTimeByProduct
  batchAllocations: Map<string, BatchAllocationMeta[]>
}

export function SalesPlanningGrid({ strategyId, rows, columnMeta, nestedHeaders, columnKeys, productOptions, stockWarningWeeks, leadTimeByProduct, batchAllocations }: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const focusContext = useContext(SalesPlanningFocusContext)
  const [activeStockMetric, setActiveStockMetric] = usePersistentState<StockMetricId>('xplan:sales-grid:metric', 'stockWeeks')
  const [showFinalError, setShowFinalError] = usePersistentState<boolean>('xplan:sales-grid:show-final-error', false)
  const themeName = useHandsontableThemeName()
  const focusProductId = focusContext?.focusProductId ?? 'ALL'
  const warningThreshold = Number.isFinite(stockWarningWeeks) ? stockWarningWeeks : Number.POSITIVE_INFINITY
  const router = useRouter()

  usePersistentHandsontableScroll(hotRef, `sales-planning:${strategyId}`)

  const preserveScrollPosition = useCallback((action: () => void) => {
    const scroll = getHandsontableScroll(hotRef.current)
    action()
    if (!scroll) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreHandsontableScroll(hotRef.current, scroll)
      })
    })
  }, [])

  const data = useMemo(() => rows, [rows])
  const weekDateByNumber = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      map.set(week, row.weekDate ?? '')
    })
    return map
  }, [data])
  const hasInboundByWeek = useMemo(() => {
    const set = new Set<number>()
    rows.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      if ((row.arrivalDetail ?? '').trim()) {
        set.add(week)
      }
    })
    return set
  }, [rows])

  const formatBatchComment = useCallback((allocations: BatchAllocationMeta[]): string => {
    if (!allocations || allocations.length === 0) return ''
    const lines = allocations.map((alloc) => {
      const batchId = alloc.batchCode || alloc.orderCode
      const qty = Number(alloc.quantity).toFixed(0)
      const price = Number(alloc.sellingPrice).toFixed(2)
      const cost = Number(alloc.landedUnitCost).toFixed(3)
      return `${batchId}: ${qty} units @ $${price} (cost: $${cost})`
    })
    return `FIFO Batch Allocation:\n${lines.join('\n')}`
  }, [])

  const visibleMetrics = useMemo(() => {
    const metrics = new Set<string>(['stockStart', 'actualSales', 'forecastSales'])
    metrics.add(showFinalError ? 'finalSalesError' : 'finalSales')
    metrics.add(activeStockMetric)
    return metrics
  }, [activeStockMetric, showFinalError])

  useEffect(() => {
    if (!focusContext) return
    if (focusContext.focusProductId !== 'ALL' && !productOptions.some((option) => option.id === focusContext.focusProductId)) {
      focusContext.setFocusProductId('ALL')
    }
  }, [focusContext, productOptions])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  useEffect(() => {
    hotRef.current?.render()
  }, [activeStockMetric, showFinalError])

  const widthByColumn = useMemo(() => {
    const measure = (values: string[], { min = 80, max = 200, padding = 18 } = {}) => {
      const normalized = values.map((value) => (value ?? '').toString().replace(/\s+/g, ' ').trim())
      const longest = normalized.reduce((maxLen, value) => Math.max(maxLen, value.length), 0)
      return Math.max(min, Math.min(max, padding + longest * 8))
    }

    const map: Record<string, number> = {}
    map.weekNumber = WEEK_COLUMN_WIDTH
    map.weekDate = DATE_COLUMN_WIDTH
    map.arrivalDetail = measure(rows.map((row) => row.arrivalDetail ?? ''), { min: 110, max: 220, padding: 14 })

      columnKeys.forEach((key) => {
        const values = rows.map((row) => row[key] ?? '')
        const meta = columnMeta[key]
        let bounds: { min: number; max: number; padding: number }
        switch (meta?.field) {
          case 'actualSales':
          case 'forecastSales':
            bounds = { min: 150, max: 260, padding: 32 }
            break
          case 'finalSalesError':
            bounds = { min: 120, max: 200, padding: 26 }
            break
          case 'stockStart':
            bounds = { min: 140, max: 240, padding: 36 }
            break
          default:
            bounds = { min: 130, max: 220, padding: 24 }
            break
        }
        map[key] = measure(values, bounds)
      })

    return map
  }, [columnKeys, columnMeta, rows])

  const columns: Handsontable.ColumnSettings[] = useMemo(() => {
    const base: Handsontable.ColumnSettings[] = [
      {
        data: 'weekNumber',
        readOnly: true,
        className: 'cell-readonly cell-common',
        width: WEEK_COLUMN_WIDTH,
      },
      {
        data: 'weekDate',
        readOnly: true,
        className: 'cell-readonly cell-common',
        width: DATE_COLUMN_WIDTH,
      },
      {
        data: 'arrivalDetail',
        readOnly: true,
        className: 'cell-readonly cell-note cell-common',
        editor: false,
        width: widthByColumn.arrivalDetail,
        wordWrap: true,
      },
    ]
    for (const key of columnKeys) {
      const meta = columnMeta[key]
      if (!meta) {
        base.push({ data: key, readOnly: true, className: 'cell-readonly', editor: false, width: widthByColumn[key] ?? 100 })
        continue
      }
      const editable = isEditableMetric(meta.field)
      const isFinalError = meta.field === 'finalSalesError'
      const measured = widthByColumn[key] ?? (isFinalError ? 96 : editable ? 88 : 86)
      const columnWidth = isFinalError ? measured : Math.max(METRIC_MIN_WIDTH, measured)
      base.push({
        data: key,
        type: isFinalError ? 'text' : 'numeric',
        numericFormat: !isFinalError ? (editable ? { pattern: '0,0.00' } : { pattern: '0.00' }) : undefined,
        readOnly: !editable,
        editor: editable ? Handsontable.editors.NumericEditor : false,
        className:
          isFinalError
            ? 'cell-readonly cell-note'
            : editable
              ? 'cell-editable'
              : 'cell-readonly',
        validator: editable ? numericValidator : undefined,
        allowInvalid: false,
        width: columnWidth,
        wordWrap: isFinalError,
      })
    }
    return base
  }, [columnMeta, columnKeys, widthByColumn])

  const columnWidths = useMemo<number[]>(
    () =>
      columns.map((column) =>
        typeof column.width === 'number' ? column.width : METRIC_MIN_WIDTH
      ),
    [columns],
  )

  const stockWeeksKeyByProduct = useMemo(() => {
    const map = new Map<string, string>()
    columnKeys.forEach((columnKey) => {
      const meta = columnMeta[columnKey]
      if (meta?.field === 'stockWeeks') {
        map.set(meta.productId, columnKey)
      }
    })
    return map
  }, [columnKeys, columnMeta])

  const clampStretchWidth = useCallback((width: number, column: number) => {
    if (column === 0) return WEEK_COLUMN_WIDTH
    if (column === 1) return DATE_COLUMN_WIDTH
    return width
  }, [])

  const hiddenColumns = useMemo(() => {
    const hidden: number[] = []
    const offset = 3
    columnKeys.forEach((key, index) => {
      const meta = columnMeta[key]
      if (!meta) return
      const columnIndex = index + offset
      if (focusProductId !== 'ALL' && meta.productId !== focusProductId) {
        hidden.push(columnIndex)
        return
      }
      if (!visibleMetrics.has(meta.field)) {
        hidden.push(columnIndex)
      }
    })
    return hidden
  }, [columnKeys, columnMeta, focusProductId, visibleMetrics])

  const handleColHeader = useCallback(
    (col: number, TH: HTMLTableCellElement, headerLevel: number) => {
      const offset = 3

      // Apply consistent font sizing for second header row to match P&L/Cash Flow
      if (headerLevel === 1) {
        TH.style.fontSize = '11px'
        TH.style.fontWeight = '700'
        TH.style.letterSpacing = '0.1em'
        TH.style.textTransform = 'uppercase'
      }

      // Handle SKU header row (headerLevel 0) with navigation arrows
      if (headerLevel === 0 && col >= offset) {
        const key = columnKeys[col - offset]
        const meta = columnMeta[key]
        if (!meta) return

        // Find the current product index and check if we need arrows
        const currentProductId = meta.productId
        const currentProductIndex = productOptions.findIndex(p => p.id === currentProductId)
        if (currentProductIndex === -1) return

        // Only add arrows if there are multiple products
        if (productOptions.length <= 1) return

        const hasPrev = currentProductIndex > 0
        const hasNext = currentProductIndex < productOptions.length - 1
        const showAllArrow = currentProductIndex === 0

        // Check if this is the first column of this product's section
        const isFirstColumnOfProduct = col === offset || columnMeta[columnKeys[col - offset - 1]]?.productId !== currentProductId
        if (!isFirstColumnOfProduct) return

        Handsontable.dom.empty(TH)
        const container = document.createElement('div')
        container.className = 'x-plan-sku-header-nav'

        // Previous arrow / Show All button
        const prevBtn = document.createElement('button')
        prevBtn.type = 'button'
        if (showAllArrow) {
          prevBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-all'
          prevBtn.innerHTML = '⊞'
          prevBtn.title = 'Show All SKUs'
        } else {
          prevBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-prev'
          prevBtn.innerHTML = '◀'
          prevBtn.title = hasPrev ? `Previous SKU: ${productOptions[currentProductIndex - 1].name}` : ''
        }
        prevBtn.style.visibility = (hasPrev || showAllArrow) ? 'visible' : 'hidden'
        prevBtn.disabled = !(hasPrev || showAllArrow)
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          preserveScrollPosition(() => {
            if (showAllArrow) {
              focusContext?.setFocusProductId('ALL')
            } else if (hasPrev) {
              focusContext?.setFocusProductId(productOptions[currentProductIndex - 1].id)
            }
          })
        })
        prevBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        })
        container.appendChild(prevBtn)

        // SKU name
        const label = document.createElement('span')
        label.className = 'x-plan-sku-header-label'
        label.textContent = productOptions[currentProductIndex].name
        container.appendChild(label)

        // Next arrow
        const nextBtn = document.createElement('button')
        nextBtn.type = 'button'
        nextBtn.className = 'x-plan-sku-nav-arrow x-plan-sku-nav-arrow-next'
        nextBtn.innerHTML = '▶'
        nextBtn.style.visibility = hasNext ? 'visible' : 'hidden'
        nextBtn.title = hasNext ? `Next SKU: ${productOptions[currentProductIndex + 1].name}` : ''
        nextBtn.disabled = !hasNext
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          preserveScrollPosition(() => {
            if (hasNext) {
              focusContext?.setFocusProductId(productOptions[currentProductIndex + 1].id)
            }
          })
        })
        nextBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        })
        container.appendChild(nextBtn)

        TH.appendChild(container)
        return
      }

      // Handle metric header row (headerLevel 1)
      if (headerLevel !== 1 || col < offset) return
      const key = columnKeys[col - offset]
      const meta = columnMeta[key]
      if (!meta) return

      const renderToggle = (label: string, handler: () => void) => {
        Handsontable.dom.empty(TH)
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'x-plan-header-toggle'
        button.textContent = label
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          handler()
        })
        button.addEventListener('mousedown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
        })
        TH.appendChild(button)
      }

      if (meta.field === activeStockMetric) {
        renderToggle(activeStockMetric === 'stockWeeks' ? 'Stock (Weeks)' : 'Stock Qty', () => {
          preserveScrollPosition(() => {
            setActiveStockMetric((prev) => (prev === 'stockWeeks' ? 'stockEnd' : 'stockWeeks'))
          })
        })
        return
      }

      const activeFinalField = showFinalError ? 'finalSalesError' : 'finalSales'
      if (meta.field === activeFinalField) {
        renderToggle(showFinalError ? '% Error' : 'Final Sales', () => {
          preserveScrollPosition(() => {
            setShowFinalError((prev) => !prev)
          })
        })
      }
    },
    [
      activeStockMetric,
      columnKeys,
      columnMeta,
      preserveScrollPosition,
      setActiveStockMetric,
      setShowFinalError,
      showFinalError,
      productOptions,
      focusContext,
    ]
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
        router.refresh()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save sales planning changes')
      }
    },
    [strategyId, router],
  )

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<string, SalesUpdate>({
    debounceMs: 600,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors handled inside handleFlush
      })
    }
  }, [flushNow])

  return (
    <div className="p-4">
      <div
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          themeName={themeName}
          width="100%"
          colHeaders={false}
          columns={columns}
          nestedHeaders={nestedHeaders as unknown as HandsontableNestedHeaders}
          afterGetColHeader={handleColHeader}
          stretchH="all"
          className="x-plan-hot h-full"
          height="100%"
          rowHeaders={false}
          undo
          comments={true}
          dropdownMenu={true}
          filters={true}
          hiddenColumns={{ columns: hiddenColumns, indicators: true }}
          autoColumnSize={false}
          colWidths={columnWidths}
          beforeStretchingColumnWidth={clampStretchWidth}
          cells={(row, col) => {
            const cell: Handsontable.CellMeta = {}
            const offset = 3
            const weekNumber = Number(data[row]?.weekNumber)
            const hasInbound = Number.isFinite(weekNumber) && hasInboundByWeek.has(weekNumber)

            if (col < offset) {
              if (hasInbound) {
                cell.className = cell.className ? `${cell.className} row-inbound-sales` : 'row-inbound-sales'
              }
              if (col === 2) {
                const note = data[row]?.arrivalNote
                if (note && note.trim().length > 0) {
                  cell.comment = { value: note }
                }
              }
              return cell
            }
            const key = columnKeys[col - offset]
            const meta = columnMeta[key]
            const editable = isEditableMetric(meta?.field)
            cell.readOnly = !editable
            const baseClass = editable ? 'cell-editable' : 'cell-readonly'
            cell.className = baseClass

            if (meta?.productId) {
              const weeksKey = stockWeeksKeyByProduct.get(meta.productId)
              const rawWeeks = weeksKey ? data[row]?.[weeksKey] : undefined
              const weeksNumeric = rawWeeks !== undefined ? Number(rawWeeks) : Number.NaN
              const isBelowThreshold = !Number.isNaN(weeksNumeric) && weeksNumeric <= warningThreshold
              const isStockColumn =
                (meta.field === 'stockWeeks' && activeStockMetric === 'stockWeeks') ||
                (meta.field === 'stockEnd' && activeStockMetric === 'stockEnd')

              if (isBelowThreshold && isStockColumn) {
                cell.className = cell.className ? `${cell.className} cell-warning` : 'cell-warning'

                const leadProfile = leadTimeByProduct[meta.productId]
                const leadTimeWeeks = leadProfile ? Math.max(0, Math.ceil(Number(leadProfile.totalWeeks))) : 0
                if (leadTimeWeeks > 0) {
                  const coverageWeeks = Math.max(0, Math.floor(weeksNumeric))
                  const stockoutWeek = coverageWeeks > 0 ? weekNumber + coverageWeeks - 1 : weekNumber
                  const stockoutDate = weekDateByNumber.get(stockoutWeek) ?? ''
                  const startWeekRaw = stockoutWeek - leadTimeWeeks
                  const startWeek = Math.max(1, startWeekRaw)
                  const startDate = weekDateByNumber.get(startWeek) ?? ''
                  const leadBreakdown = leadProfile
                    ? `${leadTimeWeeks}w (prod ${leadProfile.productionWeeks}w + source ${leadProfile.sourceWeeks}w + ocean ${leadProfile.oceanWeeks}w + final ${leadProfile.finalWeeks}w)`
                    : `${leadTimeWeeks}w`

                  const stockoutLabel = `W${stockoutWeek}${stockoutDate ? ` (${stockoutDate})` : ''}`
                  const startLabel =
                    startWeekRaw < 1
                      ? 'ASAP (before W1)'
                      : `W${startWeek}${startDate ? ` (${startDate})` : ''}`

                  cell.comment = {
                    value:
                      `Low stock warning (≤ ${warningThreshold}w).\n` +
                      `Projected stockout: ${stockoutLabel}.\n` +
                      `Suggested production start: ${startLabel}.\n` +
                      `Lead time: ${leadBreakdown}.`,
                    readOnly: true,
                  }
                }
              }
            }

            if (meta?.field === 'finalSales') {
              const cellKey = `${weekNumber}-${key}`
              const allocations = batchAllocations.get(cellKey)
              if (allocations && allocations.length > 0) {
                cell.comment = { value: formatBatchComment(allocations) }
              }
            }

            return cell
          }}
          afterChange={(changes, source) => {
            if (!changes || source === 'loadData') return
            const hot = hotRef.current
            if (!hot) return
            for (const change of changes) {
              const [rowIndex, prop, _oldValue, newValue] = change as [number, string, any, any]
              const meta = columnMeta[prop]
              if (!meta || !editableMetrics.has(meta.field)) continue
              const record = hot.getSourceDataAtRow(rowIndex) as SalesRow | null
              if (!record) continue
              const key = `${meta.productId}-${record.weekNumber}`
              if (!pendingRef.current.has(key)) {
                pendingRef.current.set(key, {
                  productId: meta.productId,
                  weekNumber: Number(record.weekNumber),
                  values: {},
                })
              }
              const entry = pendingRef.current.get(key)
              if (!entry) continue
              const formatted = formatNumericInput(newValue)
              entry.values[meta.field] = formatted
              record[prop] = formatted
            }
            scheduleFlush()
          }}
        />
      </div>
    </div>
  )
}
