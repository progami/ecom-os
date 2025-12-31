"use client"

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, Download, ChevronDown, ChevronUp } from 'lucide-react'
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
type SortField = 'orderCode' | 'grossRevenue' | 'netProfit' | 'netMarginPercent' | 'roi'
type SortDirection = 'asc' | 'desc'

type MetricKey = 'grossMarginPercent' | 'netMarginPercent' | 'roi'

const metricConfig: Record<MetricKey, { label: string; hex: string; hexDark: string; labelClass: string }> = {
  grossMarginPercent: {
    label: 'Gross Margin %',
    hex: '#0891b2',
    hexDark: '#00C2B9',
    labelClass: 'text-cyan-700 dark:text-cyan-300/80',
  },
  netMarginPercent: {
    label: 'Net Margin %',
    hex: '#059669',
    hexDark: '#10b981',
    labelClass: 'text-emerald-700 dark:text-emerald-300/80',
  },
  roi: {
    label: 'ROI %',
    hex: '#7c3aed',
    hexDark: '#a78bfa',
    labelClass: 'text-violet-700 dark:text-violet-300/80',
  },
}

const statusLabels: Record<POStatus, string> = {
  PLANNED: 'Planned',
  PRODUCTION: 'Production',
  IN_TRANSIT: 'Transit',
  ARRIVED: 'Arrived',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export function POProfitabilitySection({
  data,
  title = 'PO Profitability Analysis',
  description = 'Compare purchase order performance and profitability metrics',
}: POProfitabilitySectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>(['grossMarginPercent', 'netMarginPercent', 'roi'])
  const [sortField, setSortField] = useState<SortField>('grossRevenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const chartRef = useRef<HTMLDivElement>(null)
  const gradientId = useId()

  const filteredData = useMemo(() => {
    let result = statusFilter === 'ALL' ? data : data.filter((po) => po.status === statusFilter)
    // Sort by arrival date for chart (oldest first)
    return [...result].sort((a, b) => {
      const dateA = a.availableDate ? new Date(a.availableDate).getTime() : 0
      const dateB = b.availableDate ? new Date(b.availableDate).getTime() : 0
      return dateA - dateB
    })
  }, [data, statusFilter])

  const tableSortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = typeof aVal === 'number' ? aVal : 0
      const bNum = typeof bVal === 'number' ? bVal : 0
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
  }, [filteredData, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const hoveredIndex = activeIndex ?? (filteredData.length > 0 ? filteredData.length - 1 : null)
  const selectedPO = hoveredIndex !== null ? filteredData[hoveredIndex] : null

  // Chart dimensions
  const viewBoxWidth = 1400
  const chartHeight = 500
  const padding = { top: 40, right: 40, bottom: 60, left: 80 }
  const innerWidth = viewBoxWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Calculate domain across enabled metrics
  const { domainMin, domainMax } = useMemo(() => {
    if (!filteredData.length || !enabledMetrics.length) return { domainMin: -10, domainMax: 100 }

    let minBound = Infinity
    let maxBound = -Infinity

    for (const po of filteredData) {
      for (const key of enabledMetrics) {
        const value = po[key]
        if (Number.isFinite(value)) {
          if (value < minBound) minBound = value
          if (value > maxBound) maxBound = value
        }
      }
    }

    if (!Number.isFinite(minBound)) minBound = 0
    if (!Number.isFinite(maxBound)) maxBound = 100

    const span = maxBound - minBound
    const basePadding = span === 0 ? 10 : span * 0.1
    minBound -= basePadding
    maxBound += basePadding

    return { domainMin: minBound, domainMax: maxBound }
  }, [filteredData, enabledMetrics])

  const range = domainMax - domainMin || 1

  // Calculate points for each metric
  const metricData = useMemo(() => {
    return enabledMetrics.map((key) => {
      const config = metricConfig[key]
      const values = filteredData.map((po) => po[key])
      const points = values.map((value, index) => {
        const x = padding.left + (filteredData.length === 1 ? innerWidth / 2 : (index / (filteredData.length - 1)) * innerWidth)
        const normalized = (value - domainMin) / range
        const y = padding.top + innerHeight - normalized * innerHeight
        return { x, y }
      })
      return { key, config, values, points }
    })
  }, [enabledMetrics, filteredData, domainMin, range, innerWidth, innerHeight])

  // Y-axis ticks
  const yAxisTicks = useMemo(() => {
    return niceScale(domainMin, domainMax, 6)
  }, [domainMin, domainMax])

  // X-axis tick indices
  const xAxisTickIndices = useMemo(() => {
    const count = filteredData.length
    if (count <= 12) return filteredData.map((_, i) => i)
    const stride = Math.max(1, Math.floor(count / 12))
    const indices: number[] = []
    for (let i = 0; i < count; i += stride) {
      indices.push(i)
    }
    return indices
  }, [filteredData])

  const valueToY = (value: number) => {
    const normalized = (value - domainMin) / range
    return padding.top + innerHeight - normalized * innerHeight
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (filteredData.length === 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / viewBoxWidth || 1
    const paddingLeftPx = padding.left * scaleX
    const paddingRightPx = padding.right * scaleX
    const clampedX = Math.max(paddingLeftPx, Math.min(bounds.width - paddingRightPx, relativeX))
    const normalized = (clampedX - paddingLeftPx) / Math.max(1, bounds.width - paddingLeftPx - paddingRightPx)
    const maxIndex = Math.max(0, filteredData.length - 1)
    const index = Math.round(normalized * maxIndex)
    setActiveIndex(index)
  }

  const handlePointerLeave = () => setActiveIndex(null)

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (filteredData.length === 0) return
    event.preventDefault()
    const currentIndex = hoveredIndex ?? filteredData.length - 1
    const nextIndex = event.key === 'ArrowLeft'
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredData.length - 1, currentIndex + 1)
    setActiveIndex(nextIndex)
  }

  const toggleMetric = (key: MetricKey) => {
    setEnabledMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  const zeroLineY = domainMin < 0 && domainMax > 0
    ? padding.top + innerHeight - ((0 - domainMin) / range) * innerHeight
    : null

  // Summary stats
  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalRevenue: 0, totalProfit: 0, avgMargin: 0, avgROI: 0 }
    const totalRevenue = filteredData.reduce((sum, po) => sum + po.grossRevenue, 0)
    const totalProfit = filteredData.reduce((sum, po) => sum + po.netProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgROI = filteredData.reduce((sum, po) => sum + po.roi, 0) / filteredData.length
    return { totalRevenue, totalProfit, avgMargin, avgROI }
  }, [filteredData])

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
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">Status</span>
          {(['ALL', 'PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED'] as const).map((status) => {
            const isActive = statusFilter === status
            const label = status === 'ALL' ? 'All' : statusLabels[status]
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

      {/* Chart Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Margin Trends</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">Performance across purchase orders by arrival date</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          {/* Chart area */}
          <div ref={chartRef} className="aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-[#0b3a52] dark:bg-[#06182b]/85">
            <svg
              className="po-profitability-svg h-full w-full"
              viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="PO Profitability Trends Chart"
              tabIndex={0}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onKeyDown={handleKeyDown}
            >
              {/* Gradient definitions */}
              <defs>
                {metricData.map(({ key, config }, idx) => (
                  <linearGradient key={key} id={`${gradientId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={config.hexDark} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={config.hexDark} stopOpacity={0.05} />
                  </linearGradient>
                ))}
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

              {/* Zero line */}
              {zeroLineY != null && (
                <line
                  x1={padding.left}
                  x2={viewBoxWidth - padding.right}
                  y1={zeroLineY}
                  y2={zeroLineY}
                  stroke="rgba(100, 116, 139, 0.6)"
                  strokeWidth={2}
                />
              )}

              {/* Area fills */}
              {metricData.map(({ key, points }, idx) => (
                <path
                  key={`area-${key}`}
                  d={`M${padding.left} ${chartHeight - padding.bottom} ${points
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')} L${viewBoxWidth - padding.right} ${chartHeight - padding.bottom} Z`}
                  fill={`url(#${gradientId}-${idx})`}
                  opacity={0.3}
                />
              ))}

              {/* Lines - light mode */}
              {metricData.map(({ key, config, points }) => (
                <path
                  key={`line-${key}`}
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? chartHeight - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={config.hex}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="dark:hidden"
                />
              ))}
              {/* Lines - dark mode */}
              {metricData.map(({ key, config, points }) => (
                <path
                  key={`line-dark-${key}`}
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? chartHeight - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={config.hexDark}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="hidden dark:block"
                />
              ))}

              {/* Active index indicator */}
              {hoveredIndex != null && metricData[0]?.points[hoveredIndex] && (
                <>
                  <line
                    x1={metricData[0].points[hoveredIndex].x}
                    x2={metricData[0].points[hoveredIndex].x}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                    stroke="#0891b2"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.5}
                    className="pointer-events-none dark:hidden"
                  />
                  <line
                    x1={metricData[0].points[hoveredIndex].x}
                    x2={metricData[0].points[hoveredIndex].x}
                    y1={padding.top}
                    y2={chartHeight - padding.bottom}
                    stroke="#00C2B9"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.5}
                    className="pointer-events-none hidden dark:block"
                  />
                </>
              )}

              {/* Data points - light mode */}
              {metricData.map(({ key, config, points }) =>
                points.map((point, index) => {
                  const isHovered = hoveredIndex === index
                  return (
                    <circle
                      key={`point-${key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={isHovered ? 7 : 4}
                      fill={config.hex}
                      stroke="#ffffff"
                      strokeWidth="2"
                      opacity={isHovered ? 1 : 0.7}
                      className="pointer-events-none transition-all duration-150 dark:hidden"
                    />
                  )
                })
              )}
              {/* Data points - dark mode */}
              {metricData.map(({ key, config, points }) =>
                points.map((point, index) => {
                  const isHovered = hoveredIndex === index
                  return (
                    <circle
                      key={`point-dark-${key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={isHovered ? 7 : 4}
                      fill={config.hexDark}
                      stroke="#041324"
                      strokeWidth="2"
                      opacity={isHovered ? 1 : 0.7}
                      className="pointer-events-none hidden transition-all duration-150 dark:block"
                    />
                  )
                })
              )}

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
                      {formatPercent(tick)}
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
                {xAxisTickIndices.map((tickIndex) => {
                  const point = metricData[0]?.points[tickIndex]
                  const po = filteredData[tickIndex]
                  if (!point || !po) return null
                  return (
                    <g key={`x-tick-${tickIndex}`}>
                      <line
                        x1={point.x}
                        y1={chartHeight - padding.bottom}
                        x2={point.x}
                        y2={chartHeight - padding.bottom + 5}
                        stroke="#6F7B8B"
                        strokeWidth="2"
                      />
                      <text
                        x={point.x}
                        y={chartHeight - padding.bottom + 20}
                        textAnchor="middle"
                        className="fill-[#6F7B8B] text-[11px]"
                      >
                        {po.orderCode}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/85">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
                {activeIndex !== null ? 'Selected PO' : 'Latest PO'}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {selectedPO?.orderCode ?? '—'}
              </p>
              {selectedPO && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={selectedPO.productName}>
                  {selectedPO.productName}
                </p>
              )}
            </div>

            {enabledMetrics.map((key) => {
              const config = metricConfig[key]
              const value = selectedPO ? selectedPO[key] : null
              return (
                <div key={key} className="space-y-1">
                  <p className={`text-xs font-bold uppercase tracking-[0.28em] ${config.labelClass}`}>
                    {config.label}
                  </p>
                  <p className={`text-2xl font-semibold ${value !== null && value < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                    {value !== null ? formatPercent(value) : '—'}
                  </p>
                </div>
              )
            })}

            <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-[#0b3a52]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Summary
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Revenue</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedPO ? formatCurrency(selectedPO.grossRevenue) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Net Profit</span>
                  <span className={`font-medium ${selectedPO && selectedPO.netProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {selectedPO ? formatCurrency(selectedPO.netProfit) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
          {(Object.keys(metricConfig) as MetricKey[]).map((key) => {
            const config = metricConfig[key]
            const isEnabled = enabledMetrics.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleMetric(key)}
                className="flex items-center gap-2"
              >
                <div
                  className="h-3 w-8 rounded-sm transition-colors"
                  style={{ backgroundColor: isEnabled ? config.hex : '#94a3b8' }}
                />
                <span className={`text-xs ${isEnabled ? 'text-slate-600 dark:text-[#6F7B8B]' : 'text-slate-400 dark:text-slate-500'}`}>
                  {config.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* P&L Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">P&L Breakdown</h3>
            <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">Detailed profitability by purchase order</p>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>Total Revenue: <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyFull(summary.totalRevenue)}</span></div>
            <div>Total Profit: <span className={`font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrencyFull(summary.totalProfit)}</span></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#0b3a52]">
                <th className="whitespace-nowrap px-3 py-2 text-left">
                  <button onClick={() => handleSort('orderCode')} className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                    PO Code
                    {sortField === 'orderCode' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Units</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => handleSort('grossRevenue')} className="ml-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200">
                    Revenue
                    {sortField === 'grossRevenue' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">COGS</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Amz Fees</th>
                <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">PPC</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => handleSort('netProfit')} className="ml-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200">
                    Net Profit
                    {sortField === 'netProfit' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => handleSort('netMarginPercent')} className="ml-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                    Margin
                    {sortField === 'netMarginPercent' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => handleSort('roi')} className="ml-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200">
                    ROI
                    {sortField === 'roi' && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableSortedData.map((po) => (
                <tr key={po.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#0b3a52]/50 dark:hover:bg-[#06182b]/40">
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="font-medium text-slate-900 dark:text-white">{po.orderCode}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400" style={{ maxWidth: '150px' }} title={po.productName}>
                      {po.productName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      po.status === 'ARRIVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      po.status === 'CLOSED' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
                      po.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      po.status === 'PRODUCTION' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                      po.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300'
                    }`}>
                      {statusLabels[po.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {po.quantity.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-medium text-cyan-700 dark:text-cyan-300">
                    {formatCurrencyFull(po.grossRevenue)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrencyFull(po.supplierCostTotal)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrencyFull(po.amazonFeesTotal)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrencyFull(po.ppcCost)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-medium ${po.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrencyFull(po.netProfit)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${po.netMarginPercent >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPercent(po.netMarginPercent)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-medium ${po.roi >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatPercent(po.roi)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-[#0b3a52] dark:bg-[#06182b]/40">
                <td className="whitespace-nowrap px-3 py-2 text-slate-900 dark:text-white">Total ({filteredData.length} POs)</td>
                <td className="px-3 py-2" />
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                  {filteredData.reduce((sum, po) => sum + po.quantity, 0).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-cyan-700 dark:text-cyan-300">
                  {formatCurrencyFull(summary.totalRevenue)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                  {formatCurrencyFull(filteredData.reduce((sum, po) => sum + po.supplierCostTotal, 0))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                  {formatCurrencyFull(filteredData.reduce((sum, po) => sum + po.amazonFeesTotal, 0))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                  {formatCurrencyFull(filteredData.reduce((sum, po) => sum + po.ppcCost, 0))}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrencyFull(summary.totalProfit)}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${summary.avgMargin >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercent(summary.avgMargin)}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-right font-mono ${summary.avgROI >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercent(summary.avgROI)}
                </td>
              </tr>
            </tfoot>
          </table>
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
