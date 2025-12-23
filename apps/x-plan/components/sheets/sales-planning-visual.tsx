'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Download } from 'lucide-react'
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SEGMENTED,
} from '@/components/sheet-toolbar'
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

type ShowMode = 'all' | 'stock' | 'shipments'

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

  const selectedProduct = productOptions.find((p) => p.id === selectedProductId)

  const [hoveredShipment, setHoveredShipment] = useState<ShipmentMarker | null>(null)
  const [hoveredStock, setHoveredStock] = useState<{ weekNumber: number; weekDate: string; stockEnd: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [showMode, setShowMode] = useState<ShowMode>('all')
  const [mounted, setMounted] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const showStockLine = showMode === 'all' || showMode === 'stock'
  const showShipments = showMode === 'all' || showMode === 'shipments'

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

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

  // Compute stats for side panel
  const stats = useMemo(() => {
    if (stockDataPoints.length === 0) {
      return { latestWeek: null, latestDate: null, currentStock: 0, avgStock: 0, peakStock: 0, shipmentsCount: 0 }
    }

    const latest = stockDataPoints[stockDataPoints.length - 1]
    const stockValues = stockDataPoints.map((p) => p.stockEnd).filter((v) => v > 0)
    const avgStock = stockValues.length > 0 ? stockValues.reduce((a, b) => a + b, 0) / stockValues.length : 0
    const peakStock = Math.max(...stockDataPoints.map((p) => p.stockEnd))

    return {
      latestWeek: latest?.weekNumber ?? null,
      latestDate: latest?.weekDate ?? null,
      currentStock: latest?.stockEnd ?? 0,
      avgStock: Math.round(avgStock),
      peakStock,
      shipmentsCount: shipmentMarkers.length,
    }
  }, [stockDataPoints, shipmentMarkers])

  const chartHeight = 400
  const padding = { top: 40, right: 40, bottom: 60, left: 80 }

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

  if (productOptions.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 text-sm text-slate-400 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Stock Analysis</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">No Products Available</h2>
        </header>
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">
            Set up your first product in the Product Setup sheet to start tracking stock levels.
          </p>
          <Link
            href={productSetupHref}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-600 bg-cyan-600/20 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-cyan-600/30 dark:border-[#00C2B9] dark:bg-[#00C2B9]/20 dark:text-white dark:hover:bg-[#00C2B9]/30"
          >
            <span>→</span> Go to Product Setup
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
      {/* Header */}
      <header className="space-y-4 lg:flex lg:items-end lg:justify-between lg:space-y-0">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Stock Analysis</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Stock Level Over Time</h2>
          <p className="text-sm text-slate-700 dark:text-slate-200/80">
            Track inventory levels and shipment arrivals for planning
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          {/* Show Mode Toggle */}
          <div className={SHEET_TOOLBAR_GROUP}>
            <span className={SHEET_TOOLBAR_LABEL}>Display</span>
            <div role="group" aria-label="Select display mode" className={SHEET_TOOLBAR_SEGMENTED}>
              {[
                { value: 'all' as const, label: 'All' },
                { value: 'stock' as const, label: 'Stock' },
                { value: 'shipments' as const, label: 'Shipments' },
              ].map((option) => {
                const isActive = option.value === showMode
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${SHEET_TOOLBAR_BUTTON} rounded-none first:rounded-l-full last:rounded-r-full ${
                      isActive
                        ? 'border-[#00c2b9] bg-cyan-600 text-white shadow-[0_12px_24px_rgba(0,194,185,0.15)] dark:bg-[#00c2b9]/15 dark:text-cyan-100'
                        : 'text-slate-700 hover:text-cyan-700 dark:text-slate-200 dark:hover:text-cyan-100'
                    }`}
                    onClick={() => setShowMode(option.value)}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Export Button */}
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
            className={`${SHEET_TOOLBAR_BUTTON} gap-1.5`}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </header>

      {/* Chart and Stats Grid */}
      <article className="space-y-6">
        {/* Legend badges */}
        <div className="flex flex-wrap items-center gap-2">
          {showStockLine && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-600 dark:bg-[#00C2B9]" />
              Stock Level
            </span>
          )}
          {showShipments && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />
              Shipment Arrivals
            </span>
          )}
          {selectedProduct && (
            <span className="text-sm text-slate-700 dark:text-slate-200/80">
              {selectedProduct.name}
            </span>
          )}
        </div>

        {/* Chart + Side Panel Grid */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          {/* Chart Container */}
          <div className="relative h-[400px] w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 backdrop-blur-sm">
            <svg
              ref={svgRef}
              viewBox={`0 0 1000 ${chartHeight}`}
              className="sales-chart-svg h-full w-full"
            >
              {/* Grid lines */}
              <g className="opacity-40">
                {yAxisTicks.map((tick, index) => (
                  <line
                    key={`grid-y-${index}-${tick}`}
                    x1={padding.left}
                    y1={yScale(tick)}
                    x2={1000 - padding.right}
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
                  d={getAreaPathData(1000)}
                  fill="url(#stockGradient)"
                  opacity="0.5"
                />
              )}

              {/* Stock line */}
              {showStockLine && (
                <path
                  d={getPathData(1000)}
                  fill="none"
                  stroke={colors.stockLine}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {showStockLine && stockDataPoints.map((point, index) => {
                const isHovered = hoveredStock?.weekNumber === point.weekNumber
                return (
                  <g key={`point-${index}`}>
                    <circle
                      cx={xScale(point.weekNumber, 1000)}
                      cy={yScale(point.stockEnd)}
                      r="16"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredStock(point)
                        setTooltipPosition({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => {
                        setHoveredStock(null)
                        setTooltipPosition(null)
                      }}
                    />
                    <circle
                      cx={xScale(point.weekNumber, 1000)}
                      cy={yScale(point.stockEnd)}
                      r={isHovered ? 6 : 4}
                      fill={colors.stockLine}
                      opacity={isHovered ? 1 : 0.7}
                      className="pointer-events-none transition-all duration-150"
                    />
                  </g>
                )
              })}

              {/* Shipment markers */}
              {showShipments && shipmentMarkers.map((marker, index) => {
                const x = xScale(marker.weekNumber, 1000)
                const isHovered = hoveredShipment?.weekNumber === marker.weekNumber

                return (
                  <g key={`shipment-${index}`}>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={chartHeight - padding.bottom}
                      stroke="transparent"
                      strokeWidth="24"
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredShipment(marker)
                        setTooltipPosition({ x: e.clientX, y: e.clientY })
                      }}
                      onMouseMove={(e) => setTooltipPosition({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => {
                        setHoveredShipment(null)
                        setTooltipPosition(null)
                      }}
                    />
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={chartHeight - padding.bottom}
                      stroke={colors.shipmentLine}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeDasharray="6 4"
                      opacity={isHovered ? 1 : 0.6}
                      className="pointer-events-none transition-all duration-150"
                    />
                    <circle
                      cx={x}
                      cy={padding.top - 8}
                      r={isHovered ? 7 : 5}
                      fill={colors.shipmentLine}
                      opacity={isHovered ? 1 : 0.7}
                      className="pointer-events-none transition-all duration-150"
                    />
                  </g>
                )
              })}

              {/* Y-axis */}
              <g>
                {yAxisTicks.map((tick, index) => (
                  <text
                    key={`y-tick-${index}-${tick}`}
                    x={padding.left - 10}
                    y={yScale(tick)}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="text-[11px] font-medium fill-slate-500 dark:fill-[#6F7B8B]"
                  >
                    {tick.toLocaleString()}
                  </text>
                ))}
              </g>

              {/* X-axis */}
              <g>
                <line
                  x1={padding.left}
                  x2={1000 - padding.right}
                  y1={chartHeight - padding.bottom}
                  y2={chartHeight - padding.bottom}
                  stroke="rgba(100, 116, 139, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {xAxisTicks.map((tick, index) => (
                  <g key={`x-tick-${index}-${tick.weekNumber}`}>
                    <text
                      x={xScale(tick.weekNumber, 1000)}
                      y={chartHeight - padding.bottom + 16}
                      textAnchor="middle"
                      className="text-[10px] font-medium fill-slate-500 dark:fill-[#6F7B8B]"
                    >
                      W{tick.weekNumber}
                    </text>
                    <text
                      x={xScale(tick.weekNumber, 1000)}
                      y={chartHeight - padding.bottom + 28}
                      textAnchor="middle"
                      className="text-[9px] fill-slate-400 dark:fill-[#6F7B8B]/70"
                    >
                      {tick.weekDate}
                    </text>
                  </g>
                ))}
              </g>

              {/* Gradient definition */}
              <defs>
                <linearGradient id="stockGradient" gradientTransform="rotate(90)">
                  <stop offset="0%" stopColor={colors.stockLine} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={colors.stockLine} stopOpacity={0.05} />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Side Stats Panel */}
          <aside className="space-y-4 rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 p-4 text-sm backdrop-blur-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Latest week</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {stats.latestWeek ? `W${stats.latestWeek}` : '—'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-200/80">{stats.latestDate ?? ''}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Current stock</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {stats.currentStock.toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-200/80">units</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Peak stock</p>
              <p className="text-lg font-medium text-slate-900 dark:text-white">
                {stats.peakStock.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Avg stock</p>
              <p className="text-lg font-medium text-slate-900 dark:text-white">
                {stats.avgStock.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300/80">Shipments</p>
              <p className="text-lg font-medium text-slate-900 dark:text-white">
                {stats.shipmentsCount} <span className="text-xs font-normal text-slate-600 dark:text-slate-200/80">arrivals</span>
              </p>
            </div>
          </aside>
        </div>
      </article>

      {/* Portal-based tooltips that follow cursor */}
      {mounted && tooltipPosition && hoveredStock && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
          style={{
            left: `${tooltipPosition.x + 16}px`,
            top: `${tooltipPosition.y - 16}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="rounded-lg border border-cyan-600 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-[#00C2B9] dark:bg-[#0d2a3f]/95 max-w-xs">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-600 dark:bg-[#00C2B9]" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Stock Level</h4>
            </div>
            <div className="space-y-0.5 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-white">Week {hoveredStock.weekNumber}</span> · {hoveredStock.weekDate}
              </p>
              <p className="text-lg font-bold text-cyan-700 dark:text-[#00C2B9]">
                {Math.round(hoveredStock.stockEnd).toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">units</span>
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && tooltipPosition && hoveredShipment && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
          style={{
            left: `${tooltipPosition.x + 16}px`,
            top: `${tooltipPosition.y - 16}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="rounded-lg border border-emerald-600 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-emerald-500 dark:bg-[#0d2a3f]/95 max-w-sm">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Shipment Arrival</h4>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-white">Week {hoveredShipment.weekNumber}</span> · {hoveredShipment.weekDate}
              </p>
              <div className="mt-1.5 rounded bg-slate-100 p-2 dark:bg-[#041324]/60">
                <p className="whitespace-pre-line text-xs text-slate-700 dark:text-emerald-100">
                  {hoveredShipment.arrivalDetail}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
