"use client"

import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, Download } from 'lucide-react'
import { SHEET_TOOLBAR_GROUP } from '@/components/sheet-toolbar'

export type POStatus = 'PLANNED' | 'PRODUCTION' | 'IN_TRANSIT' | 'ARRIVED' | 'CLOSED' | 'CANCELLED'

export interface POProfitabilityData {
  id: string
  orderCode: string
  productId: string
  productName: string
  quantity: number
  status: POStatus
  manufacturingCost: number
  freightCost: number
  tariffCost: number
  landedUnitCost: number
  supplierCostTotal: number
  sellingPrice: number
  grossRevenue: number
  fbaFee: number
  amazonReferralRate: number
  amazonFeesTotal: number
  tacosPercent: number
  ppcCost: number
  grossProfit: number
  grossMarginPercent: number
  netProfit: number
  netMarginPercent: number
  roi: number
  productionStart: Date | null
  availableDate: Date | null
  totalLeadDays: number
}

interface POProfitabilitySectionProps {
  data: POProfitabilityData[]
  title?: string
  description?: string
}

type StatusFilter = 'ALL' | POStatus

const statusColors: Record<POStatus, string> = {
  PLANNED: '#64748b',
  PRODUCTION: '#f59e0b',
  IN_TRANSIT: '#3b82f6',
  ARRIVED: '#10b981',
  CLOSED: '#0891b2',
  CANCELLED: '#ef4444',
}

const accentPalette = {
  revenue: { hex: '#0891b2', hexDark: '#00C2B9', label: 'Revenue' },
  cogs: { hex: '#64748b', hexDark: '#94a3b8', label: 'COGS' },
  profit: { hex: '#059669', hexDark: '#10b981', label: 'Net Profit' },
}

export function POProfitabilitySection({
  data,
  title = 'PO Profitability Analysis',
  description = 'Compare purchase order performance and profitability metrics',
}: POProfitabilitySectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const gradientId = useId()

  const filteredData = useMemo(() => {
    let result = statusFilter === 'ALL' ? data : data.filter((po) => po.status === statusFilter)
    return [...result].sort((a, b) => b.grossRevenue - a.grossRevenue)
  }, [data, statusFilter])

  const hoveredIndex = activeIndex ?? (filteredData.length > 0 ? 0 : null)
  const selectedPO = hoveredIndex !== null ? filteredData[hoveredIndex] : null

  // Chart dimensions - matching existing sheets exactly
  const viewBoxWidth = 1400
  const chartHeight = 600
  const padding = { top: 40, right: 40, bottom: 80, left: 80 }
  const innerWidth = viewBoxWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Calculate scales
  const { maxValue, barWidth } = useMemo(() => {
    if (filteredData.length === 0) return { maxValue: 1, barWidth: 40 }
    const maxRevenue = Math.max(...filteredData.map((po) => po.grossRevenue), 1)
    const maxValue = maxRevenue * 1.1
    const numPOs = filteredData.length
    const groupWidth = Math.min(innerWidth / numPOs, 120)
    const barWidth = groupWidth * 0.25
    return { maxValue, barWidth }
  }, [filteredData, innerWidth])

  const valueToY = (value: number) => {
    return padding.top + innerHeight - (value / maxValue) * innerHeight
  }

  // Y-axis ticks
  const yAxisTicks = useMemo(() => {
    return niceScale(0, maxValue, 6)
  }, [maxValue])

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (filteredData.length === 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / viewBoxWidth || 1
    const svgX = relativeX / scaleX

    if (svgX < padding.left || svgX > viewBoxWidth - padding.right) {
      return
    }

    const normalized = (svgX - padding.left) / innerWidth
    const index = Math.floor(normalized * filteredData.length)
    setActiveIndex(Math.max(0, Math.min(filteredData.length - 1, index)))
  }

  const handlePointerLeave = () => setActiveIndex(null)

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (filteredData.length === 0) return
    event.preventDefault()
    const currentIndex = hoveredIndex ?? 0
    const nextIndex = event.key === 'ArrowLeft'
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredData.length - 1, currentIndex + 1)
    setActiveIndex(nextIndex)
  }

  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
          </div>
          <p className="mt-4 text-sm text-slate-400">No purchase orders available for analysis.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls bar - matching existing sheets */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">Status</span>
          {(['ALL', 'PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED'] as const).map((status) => {
            const isActive = statusFilter === status
            const label = status === 'ALL' ? 'All' : status === 'IN_TRANSIT' ? 'Transit' : status.charAt(0) + status.slice(1).toLowerCase()
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                  isActive
                    ? 'bg-cyan-100 text-cyan-800 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {isActive && <Check className="h-3 w-3" />}
                {label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const svg = document.querySelector('.po-profitability-svg') as SVGElement
            if (!svg) return
            const svgData = new XMLSerializer().serializeToString(svg)
            const blob = new Blob([svgData], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `po-profitability-${statusFilter.toLowerCase()}.svg`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#00C2B9]/50 dark:hover:text-cyan-100 dark:focus-visible:outline-[#00C2B9]"
        >
          <Download className="h-3.5 w-3.5" />
          Export SVG
        </button>
      </div>

      {/* Main card - matching existing sheets */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          {/* Chart area */}
          <div className="aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-[#0b3a52] dark:bg-[#06182b]/85">
            <svg
              className="po-profitability-svg h-full w-full"
              viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="PO Profitability Chart"
              tabIndex={0}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onKeyDown={handleKeyDown}
            >
              <defs>
                <linearGradient id={`${gradientId}-revenue`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="[stop-color:#0891b2] dark:[stop-color:#00C2B9]" stopOpacity={0.8} />
                  <stop offset="100%" className="[stop-color:#0891b2] dark:[stop-color:#00C2B9]" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id={`${gradientId}-profit`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="[stop-color:#059669] dark:[stop-color:#10b981]" stopOpacity={0.8} />
                  <stop offset="100%" className="[stop-color:#059669] dark:[stop-color:#10b981]" stopOpacity={0.3} />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              <g className="opacity-40">
                {yAxisTicks.map((tick, index) => (
                  <line
                    key={`grid-y-${index}-${tick}`}
                    x1={padding.left}
                    y1={valueToY(tick)}
                    x2={viewBoxWidth - padding.right}
                    y2={valueToY(tick)}
                    stroke="#6F7B8B"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}
              </g>

              {/* Bars for each PO */}
              {filteredData.map((po, index) => {
                const numPOs = filteredData.length
                const groupWidth = innerWidth / numPOs
                const groupX = padding.left + index * groupWidth + groupWidth * 0.1
                const actualBarWidth = groupWidth * 0.35
                const gap = groupWidth * 0.05
                const isActive = index === hoveredIndex

                const revenueHeight = (po.grossRevenue / maxValue) * innerHeight
                const profitHeight = Math.abs(po.netProfit / maxValue) * innerHeight
                const profitIsNegative = po.netProfit < 0

                return (
                  <g key={po.id} className="transition-opacity duration-150" opacity={isActive ? 1 : 0.7}>
                    {/* Revenue bar */}
                    <rect
                      x={groupX}
                      y={valueToY(po.grossRevenue)}
                      width={actualBarWidth}
                      height={revenueHeight}
                      fill={`url(#${gradientId}-revenue)`}
                      rx={3}
                    />
                    {/* Profit bar */}
                    <rect
                      x={groupX + actualBarWidth + gap}
                      y={profitIsNegative ? valueToY(0) : valueToY(po.netProfit)}
                      width={actualBarWidth}
                      height={profitHeight}
                      fill={profitIsNegative ? '#ef4444' : `url(#${gradientId}-profit)`}
                      rx={3}
                    />

                    {/* Hover highlight */}
                    {isActive && (
                      <rect
                        x={groupX - groupWidth * 0.05}
                        y={padding.top}
                        width={groupWidth * 0.8}
                        height={innerHeight}
                        className="fill-cyan-500/5 dark:fill-[#00C2B9]/5"
                        rx={4}
                      />
                    )}
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
                {yAxisTicks.map((tick, index) => (
                  <g key={`y-tick-${index}-${tick}`}>
                    <line
                      x1={padding.left - 5}
                      y1={valueToY(tick)}
                      x2={padding.left}
                      y2={valueToY(tick)}
                      stroke="#6F7B8B"
                      strokeWidth="2"
                    />
                    <text
                      x={padding.left - 10}
                      y={valueToY(tick)}
                      textAnchor="end"
                      alignmentBaseline="middle"
                      className="fill-slate-600 text-xs font-mono dark:fill-[#6F7B8B]"
                    >
                      {formatCurrency(tick)}
                    </text>
                  </g>
                ))}
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
                {filteredData.map((po, index) => {
                  const numPOs = filteredData.length
                  const groupWidth = innerWidth / numPOs
                  const x = padding.left + index * groupWidth + groupWidth * 0.4
                  const showLabel = numPOs <= 12 || index % Math.ceil(numPOs / 12) === 0
                  if (!showLabel) return null
                  return (
                    <g key={`x-tick-${index}`}>
                      <line
                        x1={x}
                        y1={chartHeight - padding.bottom}
                        x2={x}
                        y2={chartHeight - padding.bottom + 5}
                        stroke="#6F7B8B"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={chartHeight - padding.bottom + 20}
                        textAnchor="middle"
                        className="fill-[#6F7B8B] text-[11px]"
                      >
                        {po.orderCode}
                      </text>
                      <text
                        x={x}
                        y={chartHeight - padding.bottom + 36}
                        textAnchor="middle"
                        className="fill-[#6F7B8B] text-[10px]"
                      >
                        {formatPercent(po.netMarginPercent)}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          {/* Sidebar - matching existing sheets exactly */}
          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/85">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
                {activeIndex !== null ? 'Selected PO' : 'Top PO'}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {selectedPO?.orderCode ?? '—'}
              </p>
              {selectedPO && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedPO.productName}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
                Revenue
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {selectedPO ? formatCurrency(selectedPO.grossRevenue) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPO ? `${selectedPO.quantity.toLocaleString()} units` : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300/80">
                Net Profit
              </p>
              <p className={`text-2xl font-semibold ${selectedPO && selectedPO.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {selectedPO ? formatCurrency(selectedPO.netProfit) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPO ? `${formatPercent(selectedPO.netMarginPercent)} margin` : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                ROI
              </p>
              <p className={`text-xl font-semibold ${selectedPO && selectedPO.roi >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                {selectedPO ? formatPercent(selectedPO.roi) : '—'}
              </p>
            </div>

            <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-[#0b3a52]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Cost Breakdown
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">COGS</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedPO ? formatCurrency(selectedPO.supplierCostTotal) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Amazon Fees</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedPO ? formatCurrency(selectedPO.amazonFeesTotal) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">PPC Cost</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedPO ? formatCurrency(selectedPO.ppcCost) : '—'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Legend - matching existing sheets */}
        <div className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 rounded-sm bg-cyan-600 dark:bg-[#00C2B9]" />
            <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">Net Profit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-8 rounded-sm bg-red-500" />
            <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">Loss</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  if (max - min === 0) {
    return [min - 1, min, min + 1]
  }
  const range = niceNumber(max - min, false)
  const tickSpacing = niceNumber(range / (tickCount - 1), true)
  const niceMin = Math.floor(min / tickSpacing) * tickSpacing
  const niceMax = Math.ceil(max / tickSpacing) * tickSpacing

  const ticks: number[] = []
  for (let tick = niceMin; tick <= niceMax + tickSpacing * 0.5; tick += tickSpacing) {
    ticks.push(Math.round(tick * 100) / 100)
  }
  return ticks
}
