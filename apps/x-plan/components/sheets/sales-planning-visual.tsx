'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar'

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

export function SalesPlanningVisual({ rows, columnMeta, columnKeys, productOptions }: SalesPlanningVisualProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>(productOptions[0]?.id ?? '')
  const [hoveredShipment, setHoveredShipment] = useState<ShipmentMarker | null>(null)
  const [hoveredStock, setHoveredStock] = useState<{ weekNumber: number; weekDate: string; stockEnd: number } | null>(null)
  const [showShipments, setShowShipments] = useState(true)
  const [showStockLine, setShowStockLine] = useState(true)

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

    const minStock = Math.min(...stockValues)
    const maxStock = Math.max(...stockValues)
    const minWeek = Math.min(...weekNumbers)
    const maxWeek = Math.max(...weekNumbers)

    const stockPadding = (maxStock - minStock) * 0.1
    return {
      minStock: Math.max(0, minStock - stockPadding),
      maxStock: maxStock + stockPadding,
      minWeek,
      maxWeek,
    }
  }, [stockDataPoints])

  const chartHeight = 600
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
    const ticks: number[] = []
    const tickCount = 6
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(chartBounds.minStock + (i * (chartBounds.maxStock - chartBounds.minStock)) / tickCount)
    }
    return ticks
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
      <div className="rounded-2xl border border-dashed border-[#6F7B8B]/40 bg-[#002C51]/20 p-12 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className="text-6xl">📦</div>
          <h3 className="text-xl font-semibold text-white">No Products Available</h3>
          <p className="text-sm text-[#6F7B8B]">
            Set up your first product in the Product Setup sheet to start tracking stock levels and sales planning.
          </p>
          <a
            href="/sheet/1-product-setup"
            className="inline-flex items-center gap-2 rounded-lg border border-[#00C2B9] bg-[#00C2B9]/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00C2B9]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2B9]"
          >
            <span>→</span> Go to Product Setup
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className={SHEET_TOOLBAR_LABEL}>Product</span>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className={SHEET_TOOLBAR_SELECT}
          >
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className={SHEET_TOOLBAR_GROUP}>
          <span className={SHEET_TOOLBAR_LABEL}>Show</span>
          <button
            type="button"
            onClick={() => setShowStockLine(!showStockLine)}
            className={`px-2 py-1 text-xs font-medium transition ${showStockLine ? 'text-[#00C2B9]' : 'text-[#6F7B8B]'}`}
          >
            Stock
          </button>
          <button
            type="button"
            onClick={() => setShowShipments(!showShipments)}
            className={`px-2 py-1 text-xs font-medium transition ${showShipments ? 'text-[#f97316]' : 'text-[#6F7B8B]'}`}
          >
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
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#00C2B9]/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00C2B9]"
        >
          <span>⬇</span> Export SVG
        </button>
      </div>

      <div className="rounded-2xl border border-[#0b3a52] bg-[#06182b]/60 p-6 backdrop-blur-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Stock Level Over Time</h3>
          <p className="text-sm text-[#6F7B8B]">
            Tracking inventory levels with shipment arrival markers
          </p>
        </div>

        <div className="w-full">
          <svg
            width="100%"
            height={chartHeight}
            className="sales-chart-svg text-white"
            preserveAspectRatio="none"
            viewBox={`0 0 1400 ${chartHeight}`}
          >
            {/* Grid lines */}
            <g className="opacity-20">
              {yAxisTicks.map((tick) => (
                <line
                  key={`grid-y-${tick}`}
                  x1={padding.left}
                  y1={yScale(tick)}
                  x2={1400 - padding.right}
                  y2={yScale(tick)}
                  stroke="#6F7B8B"
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
                d={getPathData(1400)}
                fill="none"
                stroke="#00C2B9"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {showStockLine && stockDataPoints.map((point, index) => {
              const isHovered = hoveredStock?.weekNumber === point.weekNumber
              return (
                <circle
                  key={`point-${index}`}
                  cx={xScale(point.weekNumber, 1400)}
                  cy={yScale(point.stockEnd)}
                  r={isHovered ? "6" : "4"}
                  fill="#00C2B9"
                  stroke="#041324"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredStock(point)}
                  onMouseLeave={() => setHoveredStock(null)}
                />
              )
            })}

            {/* Shipment markers */}
            {showShipments && shipmentMarkers.map((marker, index) => {
              const x = xScale(marker.weekNumber, 1400)
              const isHovered = hoveredShipment?.weekNumber === marker.weekNumber

              return (
                <g key={`shipment-${index}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={chartHeight - padding.bottom}
                    stroke="#f97316"
                    strokeWidth={isHovered ? "3" : "2"}
                    strokeDasharray="6 4"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredShipment(marker)}
                    onMouseLeave={() => setHoveredShipment(null)}
                  />
                  <circle
                    cx={x}
                    cy={padding.top - 10}
                    r={isHovered ? "8" : "6"}
                    fill="#f97316"
                    stroke="#041324"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredShipment(marker)}
                    onMouseLeave={() => setHoveredShipment(null)}
                  />
                </g>
              )
            })}

            {/* Y-axis */}
            <g>
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={chartHeight - padding.bottom}
                stroke="#6F7B8B"
                strokeWidth="2"
              />
              {yAxisTicks.map((tick) => (
                <g key={`y-tick-${tick}`}>
                  <line
                    x1={padding.left - 5}
                    y1={yScale(tick)}
                    x2={padding.left}
                    y2={yScale(tick)}
                    stroke="#6F7B8B"
                    strokeWidth="2"
                  />
                  <text
                    x={padding.left - 10}
                    y={yScale(tick)}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="fill-[#6F7B8B] text-xs font-mono"
                  >
                    {Math.round(tick)}
                  </text>
                </g>
              ))}
              <text
                x={20}
                y={chartHeight / 2}
                textAnchor="middle"
                className="fill-white text-sm font-semibold"
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
                x2={1400 - padding.right}
                y2={chartHeight - padding.bottom}
                stroke="#6F7B8B"
                strokeWidth="2"
              />
              {xAxisTicks.map((tick) => (
                <g key={`x-tick-${tick.weekNumber}`}>
                  <line
                    x1={xScale(tick.weekNumber, 1400)}
                    y1={chartHeight - padding.bottom}
                    x2={xScale(tick.weekNumber, 1400)}
                    y2={chartHeight - padding.bottom + 5}
                    stroke="#6F7B8B"
                    strokeWidth="2"
                  />
                  <text
                    x={xScale(tick.weekNumber, 1400)}
                    y={chartHeight - padding.bottom + 20}
                    textAnchor="middle"
                    className="fill-[#6F7B8B] text-xs"
                  >
                    W{tick.weekNumber}
                  </text>
                  {tick.weekDate && (
                    <text
                      x={xScale(tick.weekNumber, 1400)}
                      y={chartHeight - padding.bottom + 35}
                      textAnchor="middle"
                      className="fill-[#6F7B8B] text-[10px]"
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

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 border-t border-[#0b3a52] pt-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 rounded-sm bg-[#00C2B9]" />
            <span className="text-xs text-[#6F7B8B]">Stock Level</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 border-2 border-dashed border-[#f97316] rounded-sm" />
            <span className="text-xs text-[#6F7B8B]">Shipment Arrival</span>
          </div>
        </div>
      </div>

      {/* Tooltips - positioned to avoid viewport edges */}
      <div className="flex flex-wrap gap-4">
        {/* Stock hover tooltip */}
        {hoveredStock && (
          <div className="rounded-xl border border-[#00C2B9] bg-[#002C51]/95 p-4 shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#00C2B9]" />
              <h4 className="font-semibold text-white">Stock Level</h4>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-[#6F7B8B]">
                <span className="font-medium text-white">Week:</span> {hoveredStock.weekNumber}
              </p>
              <p className="text-[#6F7B8B]">
                <span className="font-medium text-white">Date:</span> {hoveredStock.weekDate}
              </p>
              <p className="text-[#6F7B8B]">
                <span className="font-medium text-white">Stock:</span> <span className="text-[#00C2B9] font-bold">{Math.round(hoveredStock.stockEnd)}</span> units
              </p>
            </div>
          </div>
        )}

        {/* Shipment hover tooltip */}
        {hoveredShipment && (
          <div className="rounded-xl border border-[#f97316] bg-[#002C51]/95 p-4 shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#f97316]" />
              <h4 className="font-semibold text-white">Shipment Arrival</h4>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-[#6F7B8B]">
                <span className="font-medium text-white">Week:</span> {hoveredShipment.weekNumber}
              </p>
              <p className="text-[#6F7B8B]">
                <span className="font-medium text-white">Date:</span> {hoveredShipment.weekDate}
              </p>
              <div className="mt-2 rounded-lg bg-[#041324]/60 p-2">
                <p className="whitespace-pre-line text-xs text-cyan-100">
                  {hoveredShipment.arrivalDetail}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
