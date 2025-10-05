'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatNumericInput, numericValidator } from '@/components/sheets/validators'
import { useMutationQueue } from '@/hooks/useMutationQueue'
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar'
import { usePersistentState } from '@/hooks/usePersistentState'

registerAllModules()

type SalesRow = {
  weekNumber: string
  weekDate: string
  [key: string]: string
}

type ColumnMeta = Record<string, { productId: string; field: string }>
type NestedHeaderCell = string | { label: string; colspan?: number; rowspan?: number }
type HandsontableNestedHeaders = NonNullable<Handsontable.GridSettings['nestedHeaders']>
const editableMetrics = new Set(['actualSales', 'forecastSales'])
const BASE_SALES_METRICS = ['stockStart', 'actualSales', 'forecastSales', 'finalSales', 'finalSalesError'] as const
const STOCK_METRIC_OPTIONS = [
  { id: 'stockWeeks', label: 'Stock (Weeks)' },
  { id: 'stockEnd', label: 'Stock End' },
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

interface SalesPlanningGridProps {
  rows: SalesRow[]
  columnMeta: ColumnMeta
  nestedHeaders: NestedHeaderCell[][]
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
  stockWarningWeeks: number
  batchAllocations: Map<string, BatchAllocationMeta[]>
}

export function SalesPlanningGrid({ rows, columnMeta, nestedHeaders, columnKeys, productOptions, stockWarningWeeks, batchAllocations }: SalesPlanningGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const focusContext = useContext(SalesPlanningFocusContext)
  const [activeStockMetric, setActiveStockMetric] = usePersistentState<StockMetricId>('xplan:sales-grid:metric', 'stockWeeks')
  const [showFinalError, setShowFinalError] = usePersistentState<boolean>('xplan:sales-grid:show-final-error', false)
  const focusProductId = focusContext?.focusProductId ?? 'ALL'
  const warningThreshold = Number.isFinite(stockWarningWeeks) ? stockWarningWeeks : Number.POSITIVE_INFINITY
  const router = useRouter()

  const data = useMemo(() => rows, [rows])
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
      const cost = Number(alloc.landedUnitCost).toFixed(2)
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
    map.weekNumber = measure(rows.map((row) => row.weekNumber), { min: 85, max: 150, padding: 24 })
    map.weekDate = measure(rows.map((row) => row.weekDate), { min: 130, max: 200, padding: 20 })
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
        width: widthByColumn.weekNumber,
      },
      {
        data: 'weekDate',
        readOnly: true,
        className: 'cell-readonly cell-common',
        width: widthByColumn.weekDate,
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
      const columnWidth = widthByColumn[key] ?? (isFinalError ? 96 : editable ? 88 : 86)
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
          if (showAllArrow) {
            focusContext?.setFocusProductId('ALL')
          } else if (hasPrev) {
            focusContext?.setFocusProductId(productOptions[currentProductIndex - 1].id)
          }
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
          if (hasNext) {
            focusContext?.setFocusProductId(productOptions[currentProductIndex + 1].id)
          }
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
        renderToggle(activeStockMetric === 'stockWeeks' ? 'Stock (Weeks)' : 'Stock End', () => {
          setActiveStockMetric((prev) => (prev === 'stockWeeks' ? 'stockEnd' : 'stockWeeks'))
        })
        return
      }

      const activeFinalField = showFinalError ? 'finalSalesError' : 'finalSales'
      if (meta.field === activeFinalField) {
        renderToggle(showFinalError ? '% Error' : 'Final Sales', () => {
          setShowFinalError((prev) => !prev)
        })
      }
    },
    [
      activeStockMetric,
      columnKeys,
      columnMeta,
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
        const response = await fetch('/api/v1/x-plan/sales-weeks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update sales planning')
        toast.success('Sales planning updated')
        router.refresh()
      } catch (error) {
        console.error(error)
        toast.error('Unable to save sales planning changes')
      }
    },
    [router],
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
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={false}
        columns={columns}
        nestedHeaders={nestedHeaders as unknown as HandsontableNestedHeaders}
        afterGetColHeader={handleColHeader}
        stretchH="all"
        className="x-plan-hot"
        height="auto"
        rowHeaders={false}
        undo
        comments={true}
        dropdownMenu={true}
        filters={true}
        hiddenColumns={{ columns: hiddenColumns, indicators: true }}
        cells={(row, col) => {
          const cell: Handsontable.CellMeta = {}
          const offset = 3
          const weekNumber = Number(data[row]?.weekNumber)
          const hasInbound = Number.isFinite(weekNumber) && hasInboundByWeek.has(weekNumber)

          if (col < offset) {
            if (hasInbound) {
              cell.className = cell.className ? `${cell.className} row-inbound-sales` : 'row-inbound-sales'
            }
            return cell
          }
          const key = columnKeys[col - offset]
          const meta = columnMeta[key]
          const editable = isEditableMetric(meta?.field)
          cell.readOnly = !editable
          const baseClass = editable ? 'cell-editable' : 'cell-readonly'
          cell.className = baseClass

          if (meta?.field === 'stockWeeks' && activeStockMetric === 'stockWeeks') {
            const record = data[row]
            const rawValue = record?.[key]
            const numeric = rawValue ? Number(rawValue) : Number.NaN
            if (!Number.isNaN(numeric) && numeric <= warningThreshold) {
              cell.className = cell.className ? `${cell.className} cell-warning` : 'cell-warning'
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
