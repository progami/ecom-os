'use client'

import Link from 'next/link'
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clsx } from 'clsx'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Check, Download } from 'lucide-react'
import { SHEET_TOOLBAR_GROUP } from '@/components/sheet-toolbar'
import { useSalesPlanningFocus } from '@/components/sheets/sales-planning-grid'

type SalesRow = {
  weekNumber: string
  weekDate: string
  arrivalDetail?: string
  [key: string]: string | undefined
}

type ColumnMeta = Record<string, { productId: string; field: string }>

interface SalesPlanningVisualProps {
  rows: SalesRow[]
  columnMeta: ColumnMeta
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
}

type ShipmentMarker = {
  weekNumber: number
  weekDate: string
  arrivalDetail: string
}

// Calculate "nice" rounded numbers for axis labels
function niceNumber(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / Math.pow(10, exponent)
  let niceFraction: number

  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }

  return niceFraction * Math.pow(10, exponent)
}

function niceScale(min: number, max: number, tickCount: number): number[] {
  const range = niceNumber(max - min, false)
  const tickSpacing = niceNumber(range / (tickCount - 1), true)
  const niceMin = Math.floor(min / tickSpacing) * tickSpacing
  const niceMax = Math.ceil(max / tickSpacing) * tickSpacing

  const ticks: number[] = []
  for (let tick = niceMin; tick <= niceMax + tickSpacing * 0.5; tick += tickSpacing) {
    ticks.push(Math.round(tick))
  }
  return ticks
}

export function SalesPlanningVisual({ rows, columnMeta, columnKeys, productOptions }: SalesPlanningVisualProps) {
  const { theme } = useTheme()
  const searchParams = useSearchParams()
  const productSetupHref = searchParams ? `/1-product-setup?${searchParams.toString()}` : '/1-product-setup'
  const defaultProductId = productOptions[0]?.id ?? ''

  // Use shared focus context from toolbar (synced with FOCUS SKU selector)
  const focusContext = useSalesPlanningFocus()
  const contextProductId = focusContext?.focusProductId

  // Derive selected product: use context if set to a specific product, otherwise use first product
  const selectedProductId = contextProductId && contextProductId !== 'ALL'
    ? contextProductId
    : defaultProductId

  const [activeWeekIndex, setActiveWeekIndex] = useState<number | null>(null)
  const [showShipments, setShowShipments] = useState(true)
  const [showStockLine, setShowStockLine] = useState(true)

  const isDark = theme === 'dark'
  const colors = {
    stroke: isDark ? '#041324' : '#ffffff',
    stockLine: isDark ? '#00C2B9' : '#0891b2',
    shipmentLine: isDark ? '#10b981' : '#059669',
    axis: isDark ? '#6F7B8B' : '#64748b',
    gridLine: isDark ? '#6F7B8B' : '#cbd5e1',
  }

  const stockDataPoints = useMemo(() => {
    if (!selectedProductId) return []

    const productColumnKey = columnKeys.find(
      (key) => columnMeta[key]?.productId === selectedProductId && columnMeta[key]?.field === 'stockEnd'
    )

    if (!productColumnKey) return []

    return rows.map((row) => {
      const stockValue = row[productColumnKey]
      const weekNumber = Number(row.weekNumber)
      return {
        weekNumber,
        weekDate: row.weekDate,
        stockEnd: stockValue ? Number(stockValue) : 0,
      }
    }).filter((point) => Number.isFinite(point.weekNumber) && Number.isFinite(point.stockEnd))
  }, [selectedProductId, rows, columnKeys, columnMeta])

  const shipmentMarkers = useMemo(() => {
    return rows
      .filter((row) => row.arrivalDetail && row.arrivalDetail.trim().length > 0)
      .map((row) => ({
        weekNumber: Number(row.weekNumber),
        weekDate: row.weekDate,
        arrivalDetail: row.arrivalDetail || '',
      }))
      .filter((marker) => Number.isFinite(marker.weekNumber))
  }, [rows])

  const shipmentByWeek = useMemo(() => {
    const map = new Map<number, ShipmentMarker>()
    shipmentMarkers.forEach((marker) => {
      if (!map.has(marker.weekNumber)) {
        map.set(marker.weekNumber, marker)
      }
    })
    return map
  }, [shipmentMarkers])

  const weekIndexByWeekNumber = useMemo(() => {
    const map = new Map<number, number>()
    stockDataPoints.forEach((point, index) => {
      map.set(point.weekNumber, index)
    })
    return map
  }, [stockDataPoints])

  const chartBounds = useMemo(() => {
    if (stockDataPoints.length === 0) {
      return { minStock: 0, maxStock: 100, minWeek: 1, maxWeek: 52 }
    }

    const stockValues = stockDataPoints.map((p) => p.stockEnd)
    const weekNumbers = stockDataPoints.map((p) => p.weekNumber)

    const rawMaxStock = Math.max(...stockValues)
    const minWeek = Math.min(...weekNumbers)
    const maxWeek = Math.max(...weekNumbers)

    // Use nice scale to get clean max value
    const niceTicks = rawMaxStock > 0 ? niceScale(0, rawMaxStock, 6) : [0, 100]
    const maxStock = niceTicks[niceTicks.length - 1]

    return {
      minStock: 0,
      maxStock,
      minWeek,
      maxWeek,
    }
  }, [stockDataPoints])

  const chartHeight = 600
  const padding = { top: 40, right: 40, bottom: 60, left: 80 }
  const viewBoxWidth = 1400

  const xScale = (weekNumber: number, containerWidth: number) => {
    const range = chartBounds.maxWeek - chartBounds.minWeek
    if (range === 0) return padding.left
    return padding.left + ((weekNumber - chartBounds.minWeek) / range) * (containerWidth - padding.left - padding.right)
  }

  const yScale = (stock: number) => {
    const range = chartBounds.maxStock - chartBounds.minStock
    if (range === 0) return chartHeight - padding.bottom
    return chartHeight - padding.bottom - ((stock - chartBounds.minStock) / range) * (chartHeight - padding.top - padding.bottom)
  }

  const getPathData = (containerWidth: number) => {
    if (stockDataPoints.length === 0) return ''

    let d = ''
    stockDataPoints.forEach((point, index) => {
      const x = xScale(point.weekNumber, containerWidth)
      const y = yScale(point.stockEnd)
      if (index === 0) {
        d += `M ${x} ${y}`
      } else {
        d += ` L ${x} ${y}`
      }
    })
    return d
  }

  const getAreaPathData = (containerWidth: number) => {
    if (stockDataPoints.length === 0) return ''

    const baseY = chartHeight - padding.bottom
    let d = `M ${xScale(stockDataPoints[0].weekNumber, containerWidth)} ${baseY}`

    stockDataPoints.forEach((point) => {
      const x = xScale(point.weekNumber, containerWidth)
      const y = yScale(point.stockEnd)
      d += ` L ${x} ${y}`
    })

    d += ` L ${xScale(stockDataPoints[stockDataPoints.length - 1].weekNumber, containerWidth)} ${baseY} Z`
    return d
  }

  const yAxisTicks = useMemo(() => {
    if (chartBounds.maxStock <= 0) return [0]
    return niceScale(chartBounds.minStock, chartBounds.maxStock, 6)
  }, [chartBounds])

  const xAxisTicks = useMemo(() => {
    const weekCount = chartBounds.maxWeek - chartBounds.minWeek + 1
    const stride = Math.max(1, Math.floor(weekCount / 12))
    const ticks: Array<{ weekNumber: number; weekDate: string }> = []

    for (let i = 0; i < stockDataPoints.length; i += stride) {
      ticks.push({
        weekNumber: stockDataPoints[i].weekNumber,
        weekDate: stockDataPoints[i].weekDate,
      })
    }

    return ticks
  }, [chartBounds, stockDataPoints])

  const activeStock = activeWeekIndex != null ? stockDataPoints[activeWeekIndex] ?? null : null
  const activeShipment =
    showShipments && activeStock ? shipmentByWeek.get(activeStock.weekNumber) ?? null : null

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (stockDataPoints.length === 0) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const clampedX = Math.max(0, Math.min(bounds.width, relativeX))
    const svgX = (clampedX / Math.max(1, bounds.width)) * viewBoxWidth

    const minX = padding.left
    const maxX = viewBoxWidth - padding.right
    const clampedSvgX = Math.max(minX, Math.min(maxX, svgX))
    const normalized = (clampedSvgX - minX) / Math.max(1, maxX - minX)

    const weekSpan = chartBounds.maxWeek - chartBounds.minWeek || 1
    const estimatedWeek = chartBounds.minWeek + normalized * weekSpan
    const roundedWeek = Math.round(estimatedWeek)

    const directIndex = weekIndexByWeekNumber.get(roundedWeek)
    if (directIndex != null) {
      setActiveWeekIndex((prev) => (prev === directIndex ? prev : directIndex))
      return
    }

    let nearestIndex = 0
    let nearestDelta = Infinity
    for (let index = 0; index < stockDataPoints.length; index++) {
      const delta = Math.abs(stockDataPoints[index]?.weekNumber - estimatedWeek)
      if (delta < nearestDelta) {
        nearestDelta = delta
        nearestIndex = index
      }
    }
    setActiveWeekIndex((prev) => (prev === nearestIndex ? prev : nearestIndex))
  }

  const handlePointerLeave = () => setActiveWeekIndex(null)

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (stockDataPoints.length === 0) return

    event.preventDefault()
    setActiveWeekIndex((prev) => {
      const maxIndex = Math.max(0, stockDataPoints.length - 1)
      if (prev == null) {
        return event.key === 'ArrowLeft' ? maxIndex : 0
      }
      if (event.key === 'ArrowLeft') {
        return Math.max(0, prev - 1)
      }
      return Math.min(maxIndex, prev + 1)
    })
  }

  if (productOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-12 text-center dark:border-[#6F7B8B]/40 dark:bg-[#002C51]/20">
        <div className="mx-auto max-w-md space-y-4">
          <div className="text-6xl">📦</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">No Products Available</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">
            Set up your first product in the Product Setup sheet to start tracking stock levels and sales planning.
          </p>
          <Link
            href={productSetupHref}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-600 bg-cyan-600/20 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-600/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-[#00C2B9] dark:bg-[#00C2B9]/20 dark:text-white dark:hover:bg-[#00C2B9]/30 dark:focus-visible:outline-[#00C2B9]"
          >
            <span>→</span> Go to Product Setup
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">Show</span>
          <button
            type="button"
            onClick={() => setShowStockLine(!showStockLine)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
              showStockLine
                ? 'bg-cyan-100 text-cyan-800 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
            )}
          >
            {showStockLine && <Check className="h-3 w-3" />}
            Stock
          </button>
          <button
            type="button"
            onClick={() => setShowShipments(!showShipments)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all',
              showShipments
                ? 'bg-emerald-100 text-emerald-800 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
            )}
          >
            {showShipments && <Check className="h-3 w-3" />}
            Shipments
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            const svg = document.querySelector('.sales-chart-svg') as SVGElement
            if (!svg) return
            const data = new XMLSerializer().serializeToString(svg)
            const blob = new Blob([data], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `sales-planning-${selectedProductId}.svg`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#00C2B9]/50 dark:hover:text-cyan-100 dark:focus-visible:outline-[#00C2B9]"
        >
          <Download className="h-3.5 w-3.5" />
          Export SVG
        </button>
      </div>

	      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
	        <div className="mb-4">
	          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Stock Level Over Time</h3>
	          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">
	            Tracking inventory levels with shipment arrival markers
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
	          <div className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85">
	            <svg
	            width="100%"
	            height={chartHeight}
	            className="sales-chart-svg text-slate-900 dark:text-white"
	            preserveAspectRatio="none"
	            viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}
              role="img"
              aria-label="Stock level over time"
              tabIndex={0}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onKeyDown={handleKeyDown}
	          >
	            {/* Grid lines */}
	            <g className="opacity-40">
	              {yAxisTicks.map((tick, index) => (
	                <line
                  key={`grid-y-${index}-${tick}`}
                  x1={padding.left}
                  y1={yScale(tick)}
                  x2={1400 - padding.right}
                  y2={yScale(tick)}
                  stroke={colors.gridLine}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}
            </g>

            {/* Area fill */}
            {showStockLine && (
              <path
                d={getAreaPathData(1400)}
                fill="url(#stockGradient)"
                opacity="0.3"
              />
            )}

	            {/* Stock line */}
	            {showStockLine && (
	              <path
	                d={getPathData(viewBoxWidth)}
	                fill="none"
	                stroke={colors.stockLine}
	                strokeWidth="3"
	                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

              {/* Active week indicator */}
              {activeStock ? (
                <line
                  x1={xScale(activeStock.weekNumber, viewBoxWidth)}
                  x2={xScale(activeStock.weekNumber, viewBoxWidth)}
                  y1={padding.top}
                  y2={chartHeight - padding.bottom}
                  stroke={colors.stockLine}
                  strokeWidth="3"
                  strokeDasharray="6 4"
                  opacity="0.35"
                  className="pointer-events-none"
                />
              ) : null}

	            {/* Shipment markers */}
	            {showShipments && shipmentMarkers.map((marker, index) => {
	              const x = xScale(marker.weekNumber, viewBoxWidth)
	              const isHovered = activeShipment?.weekNumber === marker.weekNumber

	              return (
	                <g key={`shipment-${index}`}>
	                  {/* Visible line */}
	                  <line
	                    x1={x}
	                    y1={padding.top}
                    x2={x}
                    y2={chartHeight - padding.bottom}
	                    stroke={colors.shipmentLine}
	                    strokeWidth={isHovered ? "4" : "2"}
	                    strokeDasharray="6 4"
	                    className="pointer-events-none transition-all duration-150"
	                  />
	                  {/* Visible circle marker */}
	                  <circle
	                    cx={x}
	                    cy={padding.top - 10}
                    r={isHovered ? "9" : "7"}
                    fill={colors.shipmentLine}
                    stroke={colors.stroke}
                    strokeWidth="2"
                    className="pointer-events-none transition-all duration-150"
	                  />
	                </g>
	              )
	            })}

              {/* Data points */}
              {showStockLine
                ? stockDataPoints.map((point, index) => {
                    const isHovered = activeStock?.weekNumber === point.weekNumber
                    return (
                      <circle
                        key={`point-${index}`}
                        cx={xScale(point.weekNumber, viewBoxWidth)}
                        cy={yScale(point.stockEnd)}
                        r={isHovered ? 7 : 5}
                        fill={colors.stockLine}
                        stroke={colors.stroke}
                        strokeWidth="2"
                        opacity={isHovered ? 1 : 0.75}
                        className="pointer-events-none transition-all duration-150"
                      />
                    )
                  })
                : null}

	            {/* Y-axis */}
	            <g>
	              <line
	                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={chartHeight - padding.bottom}
                stroke={colors.axis}
                strokeWidth="2"
              />
              {yAxisTicks.map((tick, index) => (
                <g key={`y-tick-${index}-${tick}`}>
                  <line
                    x1={padding.left - 5}
                    y1={yScale(tick)}
                    x2={padding.left}
                    y2={yScale(tick)}
                    stroke={colors.axis}
                    strokeWidth="2"
                  />
                  <text
                    x={padding.left - 10}
                    y={yScale(tick)}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="text-xs font-mono fill-slate-600 dark:fill-[#6F7B8B]"
                  >
                    {Math.round(tick)}
                  </text>
                </g>
              ))}
	              <text
	                x={20}
	                y={chartHeight / 2}
	                textAnchor="middle"
	                className="fill-slate-600 dark:fill-[#6F7B8B] text-sm font-semibold"
	                transform={`rotate(-90, 20, ${chartHeight / 2})`}
	              >
	                Stock Level (Units)
	              </text>
            </g>

            {/* X-axis */}
            <g>
	              <line
	                x1={padding.left}
	                y1={chartHeight - padding.bottom}
	                x2={viewBoxWidth - padding.right}
	                y2={chartHeight - padding.bottom}
	                stroke="#6F7B8B"
	                strokeWidth="2"
	              />
              {xAxisTicks.map((tick, index) => (
	                <g key={`x-tick-${index}-${tick.weekNumber}`}>
	                  <line
	                    x1={xScale(tick.weekNumber, viewBoxWidth)}
	                    y1={chartHeight - padding.bottom}
	                    x2={xScale(tick.weekNumber, viewBoxWidth)}
	                    y2={chartHeight - padding.bottom + 5}
	                    stroke="#6F7B8B"
	                    strokeWidth="2"
	                  />
	                  <text
	                    x={xScale(tick.weekNumber, viewBoxWidth)}
	                    y={chartHeight - padding.bottom + 20}
	                    textAnchor="middle"
	                    className="fill-[#6F7B8B] text-xs"
	                  >
	                    W{tick.weekNumber}
	                  </text>
	                  {tick.weekDate && (
	                    <text
	                      x={xScale(tick.weekNumber, viewBoxWidth)}
	                      y={chartHeight - padding.bottom + 35}
	                      textAnchor="middle"
	                      className="fill-[#6F7B8B] text-xs"
	                    >
                      {tick.weekDate}
                    </text>
                  )}
                </g>
              ))}
            </g>

            {/* Gradient definition */}
            <defs>
              <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C2B9" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#00C2B9" stopOpacity="0.05" />
              </linearGradient>
            </defs>
          </svg>
          </div>

          {/* Side panel - like P&L/Cash Flow */}
	          <aside className="space-y-4 rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 p-4 text-sm backdrop-blur-sm">
	            <div>
	              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
	                {activeStock ? 'Selected week' : 'Latest week'}
	              </p>
	              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
	                {activeStock
	                  ? `W${activeStock.weekNumber} · ${activeStock.weekDate}`
	                  : stockDataPoints.length > 0
	                    ? `W${stockDataPoints[stockDataPoints.length - 1].weekNumber} · ${stockDataPoints[stockDataPoints.length - 1].weekDate}`
	                    : '—'
	                }
	              </p>
	            </div>
            <div className="space-y-1">
	              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Stock level</p>
	              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
	                {(() => {
	                  const value = activeStock?.stockEnd ?? stockDataPoints[stockDataPoints.length - 1]?.stockEnd
	                  return value != null ? Math.round(value).toLocaleString() : '—'
	                })()}
	                <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">units</span>
	              </p>
	            </div>
            <div className="space-y-1">
	              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Change vs. prior</p>
	              {(() => {
	                const currentIndex = activeWeekIndex != null ? activeWeekIndex : stockDataPoints.length - 1
	                const currentValue = stockDataPoints[currentIndex]?.stockEnd
	                const priorValue = currentIndex > 0 ? stockDataPoints[currentIndex - 1]?.stockEnd : null

                if (currentValue == null || priorValue == null) {
                  return (
                    <>
                      <p className="text-lg font-medium text-slate-900 dark:text-white">—</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
                    </>
                  )
                }

                const change = currentValue - priorValue
                const changePercent = priorValue !== 0 ? (change / Math.abs(priorValue)) * 100 : null
                const isPositive = change > 0
                const isNegative = change < 0

                return (
                  <>
                    <p className={clsx(
                      'text-lg font-medium',
                      isPositive && 'text-emerald-600 dark:text-emerald-400',
                      isNegative && 'text-red-600 dark:text-red-400',
                      !isPositive && !isNegative && 'text-slate-900 dark:text-white'
                    )}>
                      {isPositive ? '+' : ''}{Math.round(change).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {changePercent != null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%` : '—'}
                    </p>
                  </>
	                )
	              })()}
	            </div>
	            {activeShipment && (
	              <div className="space-y-1 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
	                <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300/80">Shipment</p>
	                <p className="text-sm font-medium text-slate-900 dark:text-white">
	                  W{activeShipment.weekNumber} · {activeShipment.weekDate}
	                </p>
	                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
	                  {activeShipment.arrivalDetail}
	                </p>
	              </div>
	            )}
	          </aside>
	        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 rounded-sm bg-cyan-600 dark:bg-[#00C2B9]" />
            <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">Stock Level</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 border-2 border-dashed border-emerald-600 rounded-sm dark:border-emerald-500" />
            <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">Shipment Arrival</span>
          </div>
	        </div>
	      </div>
	    </div>
	  )
	}
