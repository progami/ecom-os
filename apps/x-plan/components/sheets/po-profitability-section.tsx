"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Check, Download, TrendingUp, TrendingDown, Package, DollarSign, BarChart3 } from 'lucide-react'
import { SHEET_TOOLBAR_GROUP } from '@/components/sheet-toolbar'

export type POStatus = 'PLANNED' | 'PRODUCTION' | 'IN_TRANSIT' | 'ARRIVED' | 'CLOSED' | 'CANCELLED'

export interface POProfitabilityData {
  id: string
  orderCode: string
  productId: string
  productName: string
  quantity: number
  status: POStatus

  // Costs
  manufacturingCost: number
  freightCost: number
  tariffCost: number
  landedUnitCost: number
  supplierCostTotal: number

  // Revenue & Pricing
  sellingPrice: number
  grossRevenue: number

  // Fees
  fbaFee: number
  amazonReferralRate: number
  amazonFeesTotal: number
  tacosPercent: number
  ppcCost: number

  // Profit Metrics
  grossProfit: number
  grossMarginPercent: number
  netProfit: number
  netMarginPercent: number
  roi: number

  // Timeline
  productionStart: Date | null
  availableDate: Date | null
  totalLeadDays: number
}

interface POProfitabilitySectionProps {
  data: POProfitabilityData[]
  title?: string
  description?: string
}

type SortField = 'orderCode' | 'quantity' | 'grossRevenue' | 'grossProfit' | 'netProfit' | 'grossMarginPercent' | 'netMarginPercent' | 'roi'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'ALL' | POStatus

const statusColors: Record<POStatus, { bg: string; text: string; dot: string }> = {
  PLANNED: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400' },
  PRODUCTION: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  IN_TRANSIT: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  ARRIVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  CLOSED: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
}

const metricColors = {
  revenue: { hex: '#0891b2', hexDark: '#00C2B9', label: 'Revenue' },
  cogs: { hex: '#64748b', hexDark: '#94a3b8', label: 'COGS' },
  fees: { hex: '#d97706', hexDark: '#fbbf24', label: 'Amazon Fees' },
  ppc: { hex: '#7c3aed', hexDark: '#a78bfa', label: 'PPC Cost' },
  profit: { hex: '#059669', hexDark: '#10b981', label: 'Net Profit' },
}

export function POProfitabilitySection({
  data,
  title = 'PO Profitability Analysis',
  description = 'Compare purchase order performance and profitability metrics',
}: POProfitabilitySectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortField, setSortField] = useState<SortField>('grossRevenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedPOIndex, setSelectedPOIndex] = useState<number | null>(null)
  const [hoveredPOIndex, setHoveredPOIndex] = useState<number | null>(null)

  const chartRef = useRef<HTMLDivElement>(null)
  const gradientId = useId()

  // Filter and sort data
  const filteredData = useMemo(() => {
    let result = data
    if (statusFilter !== 'ALL') {
      result = result.filter((po) => po.status === statusFilter)
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data, statusFilter, sortField, sortDirection])

  // Calculate summary metrics
  const summary = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalPOs: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgMargin: 0,
        bestPerformer: null as POProfitabilityData | null,
        worstPerformer: null as POProfitabilityData | null,
        plannedCount: 0,
        arrivedCount: 0,
      }
    }

    const totalRevenue = filteredData.reduce((sum, po) => sum + po.grossRevenue, 0)
    const totalProfit = filteredData.reduce((sum, po) => sum + po.netProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const sorted = [...filteredData].sort((a, b) => b.netMarginPercent - a.netMarginPercent)
    const bestPerformer = sorted[0] ?? null
    const worstPerformer = sorted[sorted.length - 1] ?? null

    const plannedCount = filteredData.filter((po) => po.status === 'PLANNED' || po.status === 'PRODUCTION').length
    const arrivedCount = filteredData.filter((po) => po.status === 'ARRIVED' || po.status === 'CLOSED').length

    return {
      totalPOs: filteredData.length,
      totalRevenue,
      totalProfit,
      avgMargin,
      bestPerformer,
      worstPerformer,
      plannedCount,
      arrivedCount,
    }
  }, [filteredData])

  // Chart dimensions - matching existing sheets exactly
  const viewBoxWidth = 1400
  const chartHeight = 600
  const padding = { top: 40, right: 40, bottom: 80, left: 80 }
  const innerWidth = viewBoxWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Calculate chart scales
  const { maxValue, barWidth, barGap, groupWidth } = useMemo(() => {
    const maxRevenue = Math.max(...filteredData.map((po) => po.grossRevenue), 1)
    const maxCogs = Math.max(...filteredData.map((po) => po.supplierCostTotal), 1)
    const maxValue = Math.max(maxRevenue, maxCogs) * 1.1

    const numPOs = Math.max(filteredData.length, 1)
    const totalBarSpace = innerWidth / numPOs
    const groupWidth = Math.min(totalBarSpace * 0.85, 120)
    const barWidth = groupWidth / 5
    const barGap = barWidth * 0.1

    return { maxValue, barWidth, barGap, groupWidth }
  }, [filteredData, innerWidth])

  const valueToY = (value: number) => {
    return padding.top + innerHeight - (value / maxValue) * innerHeight
  }

  const activeIndex = hoveredPOIndex ?? selectedPOIndex ?? (filteredData.length > 0 ? filteredData.length - 1 : null)
  const activePO = activeIndex !== null ? filteredData[activeIndex] : null

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (filteredData.length === 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / viewBoxWidth || 1
    const svgX = relativeX / scaleX

    const chartLeft = padding.left
    const chartRight = viewBoxWidth - padding.right

    if (svgX < chartLeft || svgX > chartRight) {
      setHoveredPOIndex(null)
      return
    }

    const normalized = (svgX - chartLeft) / (chartRight - chartLeft)
    const index = Math.floor(normalized * filteredData.length)
    const clampedIndex = Math.max(0, Math.min(filteredData.length - 1, index))
    setHoveredPOIndex(clampedIndex)
  }

  const handlePointerLeave = () => setHoveredPOIndex(null)

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (filteredData.length === 0) return
    event.preventDefault()
    const currentIndex = activeIndex ?? 0
    const nextIndex = event.key === 'ArrowLeft'
      ? Math.max(0, currentIndex - 1)
      : Math.min(filteredData.length - 1, currentIndex + 1)
    setSelectedPOIndex(nextIndex)
  }

  // Y-axis ticks
  const yAxisTicks = useMemo(() => {
    const ticks: number[] = []
    const step = niceNumber(maxValue / 5, true)
    for (let tick = 0; tick <= maxValue; tick += step) {
      ticks.push(tick)
    }
    return ticks
  }, [maxValue])

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No purchase orders available for analysis</p>
          </div>
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
            const data = new XMLSerializer().serializeToString(svg)
            const blob = new Blob([data], { type: 'image/svg+xml' })
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={<Package className="h-5 w-5" />}
          label="Total POs"
          value={summary.totalPOs.toString()}
          subValue={`${summary.plannedCount} planned · ${summary.arrivedCount} arrived`}
          accentClass="text-cyan-600 dark:text-[#00C2B9]"
        />
        <SummaryCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          subValue={`Avg ${formatCurrency(summary.totalRevenue / Math.max(summary.totalPOs, 1))} per PO`}
          accentClass="text-cyan-600 dark:text-[#00C2B9]"
        />
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Total Profit"
          value={formatCurrency(summary.totalProfit)}
          subValue={`${formatPercent(summary.avgMargin)} avg margin`}
          accentClass={summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
        <SummaryCard
          icon={summary.bestPerformer && summary.bestPerformer.netMarginPercent > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          label="Best Performer"
          value={summary.bestPerformer?.orderCode ?? '—'}
          subValue={summary.bestPerformer ? `${formatPercent(summary.bestPerformer.netMarginPercent)} margin` : '—'}
          accentClass="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Main visualization card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          {/* Chart area */}
          <div ref={chartRef} className="aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-[#0b3a52] dark:bg-[#06182b]/85">
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
                  <stop offset="0%" stopColor="#00C2B9" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#00C2B9" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id={`${gradientId}-profit`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
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

              {/* Zero line */}
              <line
                x1={padding.left}
                y1={valueToY(0)}
                x2={viewBoxWidth - padding.right}
                y2={valueToY(0)}
                stroke="#6F7B8B"
                strokeWidth="2"
              />

              {/* Bars for each PO */}
              {filteredData.map((po, index) => {
                const groupX = padding.left + (index / filteredData.length) * innerWidth + (innerWidth / filteredData.length - groupWidth) / 2
                const isActive = index === activeIndex

                const revenueHeight = (po.grossRevenue / maxValue) * innerHeight
                const cogsHeight = (po.supplierCostTotal / maxValue) * innerHeight
                const feesHeight = (po.amazonFeesTotal / maxValue) * innerHeight
                const ppcHeight = (po.ppcCost / maxValue) * innerHeight
                const profitHeight = Math.abs(po.netProfit / maxValue) * innerHeight
                const profitIsNegative = po.netProfit < 0

                return (
                  <g key={po.id} className="transition-opacity duration-150" opacity={isActive ? 1 : 0.7}>
                    {/* Revenue bar */}
                    <rect
                      x={groupX}
                      y={valueToY(po.grossRevenue)}
                      width={barWidth}
                      height={revenueHeight}
                      fill={`url(#${gradientId}-revenue)`}
                      rx={2}
                    />
                    {/* COGS bar */}
                    <rect
                      x={groupX + barWidth + barGap}
                      y={valueToY(po.supplierCostTotal)}
                      width={barWidth}
                      height={cogsHeight}
                      fill="#64748b"
                      opacity={0.6}
                      rx={2}
                    />
                    {/* Amazon Fees bar */}
                    <rect
                      x={groupX + (barWidth + barGap) * 2}
                      y={valueToY(po.amazonFeesTotal)}
                      width={barWidth}
                      height={feesHeight}
                      fill="#d97706"
                      opacity={0.7}
                      rx={2}
                    />
                    {/* PPC bar */}
                    <rect
                      x={groupX + (barWidth + barGap) * 3}
                      y={valueToY(po.ppcCost)}
                      width={barWidth}
                      height={ppcHeight}
                      fill="#7c3aed"
                      opacity={0.7}
                      rx={2}
                    />
                    {/* Profit bar */}
                    <rect
                      x={groupX + (barWidth + barGap) * 4}
                      y={profitIsNegative ? valueToY(0) : valueToY(po.netProfit)}
                      width={barWidth}
                      height={profitHeight}
                      fill={profitIsNegative ? '#ef4444' : `url(#${gradientId}-profit)`}
                      rx={2}
                    />

                    {/* Hover highlight */}
                    {isActive && (
                      <rect
                        x={groupX - 4}
                        y={padding.top}
                        width={groupWidth + 8}
                        height={innerHeight}
                        fill="#00C2B9"
                        opacity={0.05}
                        rx={4}
                      />
                    )}
                  </g>
                )
              })}

              {/* Margin line overlay */}
              {filteredData.length > 1 && (
                <path
                  d={filteredData.map((po, index) => {
                    const x = padding.left + (index / filteredData.length) * innerWidth + groupWidth / 2
                    const marginValue = (po.netMarginPercent / 100) * maxValue
                    const y = valueToY(Math.max(0, marginValue))
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#00C2B9"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.6}
                  className="dark:stroke-[#00C2B9]"
                />
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
                  const x = padding.left + (index / filteredData.length) * innerWidth + groupWidth / 2
                  const showLabel = filteredData.length <= 12 || index % Math.ceil(filteredData.length / 12) === 0
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
                        className="fill-[#6F7B8B] text-[10px]"
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
                {hoveredPOIndex !== null ? 'Selected PO' : 'Latest PO'}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {activePO?.orderCode ?? '—'}
              </p>
              {activePO && (
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[activePO.status].bg} ${statusColors[activePO.status].text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusColors[activePO.status].dot}`} />
                    {activePO.status}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
                Revenue
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {activePO ? formatCurrency(activePO.grossRevenue) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePO ? `${activePO.quantity.toLocaleString()} units × ${formatCurrency(activePO.sellingPrice)}` : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300/80">
                Net Profit
              </p>
              <p className={`text-2xl font-semibold ${activePO && activePO.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {activePO ? formatCurrency(activePO.netProfit) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePO ? `${formatPercent(activePO.netMarginPercent)} margin` : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-300/80">
                ROI
              </p>
              <p className={`text-xl font-semibold ${activePO && activePO.roi >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                {activePO ? formatPercent(activePO.roi) : '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePO ? `on ${formatCurrency(activePO.supplierCostTotal)} invested` : '—'}
              </p>
            </div>

            <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-[#0b3a52]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Cost Breakdown
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">COGS</span>
                  <span className="font-medium text-slate-900 dark:text-white">{activePO ? formatCurrency(activePO.supplierCostTotal) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Amazon Fees</span>
                  <span className="font-medium text-slate-900 dark:text-white">{activePO ? formatCurrency(activePO.amazonFeesTotal) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">PPC Cost</span>
                  <span className="font-medium text-slate-900 dark:text-white">{activePO ? formatCurrency(activePO.ppcCost) : '—'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
          {Object.entries(metricColors).map(([key, { hex, label }]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="h-3 w-8 rounded-sm"
                style={{ backgroundColor: hex }}
              />
              <span className="text-xs text-slate-600 dark:text-[#6F7B8B]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  subValue,
  accentClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue: string
  accentClass: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-[#0b3a52] dark:bg-[#06182b]/60">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg bg-slate-100 p-2 dark:bg-slate-800 ${accentClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${accentClass}`}>{value}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subValue}</p>
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
