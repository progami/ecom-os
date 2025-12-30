"use client"

import {
  useId,
  useMemo,
  useState,
} from 'react'
import { Check, Download, Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react'
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

const statusConfig: Record<POStatus, { label: string; color: string; glow: string }> = {
  PLANNED: { label: 'Planned', color: '#64748b', glow: 'rgba(100, 116, 139, 0.4)' },
  PRODUCTION: { label: 'Production', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  IN_TRANSIT: { label: 'Transit', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  ARRIVED: { label: 'Arrived', color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  CLOSED: { label: 'Closed', color: '#00C2B9', glow: 'rgba(0, 194, 185, 0.4)' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
}

export function POProfitabilitySection({
  data,
  title = 'PO Profitability Observatory',
  description = 'Real-time profitability monitoring across purchase orders',
}: POProfitabilitySectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null)
  const gradientId = useId()

  const filteredData = useMemo(() => {
    if (statusFilter === 'ALL') return data
    return data.filter((po) => po.status === statusFilter)
  }, [data, statusFilter])

  const sortedByProfit = useMemo(() => {
    return [...filteredData].sort((a, b) => b.netMarginPercent - a.netMarginPercent)
  }, [filteredData])

  const selectedPO = useMemo(() => {
    if (selectedPOId) return filteredData.find((po) => po.id === selectedPOId) ?? null
    return sortedByProfit[0] ?? null
  }, [selectedPOId, filteredData, sortedByProfit])

  const summary = useMemo(() => {
    if (filteredData.length === 0) {
      return { totalPOs: 0, totalRevenue: 0, totalProfit: 0, avgMargin: 0, avgROI: 0 }
    }
    const totalRevenue = filteredData.reduce((sum, po) => sum + po.grossRevenue, 0)
    const totalProfit = filteredData.reduce((sum, po) => sum + po.netProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgROI = filteredData.reduce((sum, po) => sum + po.roi, 0) / filteredData.length
    return { totalPOs: filteredData.length, totalRevenue, totalProfit, avgMargin, avgROI }
  }, [filteredData])

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  if (data.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#0b3a52] bg-[#06182b] p-8">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #0b3a52 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />
        <div className="relative flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-[#0b3a52]/50 p-4">
            <Activity className="h-8 w-8 text-[#00C2B9]" />
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-[#6F7B8B]">No Data Available</p>
          <p className="mt-2 text-xs text-[#4a5568]">Awaiting purchase order telemetry...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#00C2B9]">Filter</span>
          {(['ALL', 'PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED'] as const).map((status) => {
            const isActive = statusFilter === status
            const label = status === 'ALL' ? 'All' : statusConfig[status as POStatus]?.label ?? status
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-[#00C2B9]/20 text-[#00C2B9] shadow-[0_0_12px_rgba(0,194,185,0.3)]'
                    : 'text-[#6F7B8B] hover:bg-[#0b3a52]/50 hover:text-[#00C2B9]'
                }`}
              >
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#00C2B9] shadow-[0_0_6px_#00C2B9]" />}
                {label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const svg = document.querySelector('.po-observatory-svg') as SVGElement
            if (!svg) return
            const svgData = new XMLSerializer().serializeToString(svg)
            const blob = new Blob([svgData], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `po-profitability-${Date.now()}.svg`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 rounded border border-[#0b3a52] bg-[#06182b]/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#6F7B8B] transition-all hover:border-[#00C2B9]/50 hover:text-[#00C2B9] hover:shadow-[0_0_12px_rgba(0,194,185,0.2)]"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
      </div>

      {/* Main Observatory Grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left: Visualization Area */}
        <div className="relative overflow-hidden rounded-2xl border border-[#0b3a52] bg-[#06182b]">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `
              linear-gradient(to right, #0b3a52 1px, transparent 1px),
              linear-gradient(to bottom, #0b3a52 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }} />

          {/* Radial glow */}
          <div className="pointer-events-none absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(0, 194, 185, 0.08) 0%, transparent 60%)',
          }} />

          <div className="relative p-6">
            {/* Title */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#00C2B9]">{title}</h3>
                <p className="mt-1 text-xs text-[#4a5568]">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#10b981]">Live</span>
              </div>
            </div>

            {/* Summary Stats Row */}
            <div className="mb-6 grid grid-cols-5 gap-3">
              <StatBlock label="Total POs" value={summary.totalPOs.toString()} accent="#00C2B9" />
              <StatBlock label="Revenue" value={formatCurrency(summary.totalRevenue)} accent="#00C2B9" />
              <StatBlock label="Net Profit" value={formatCurrency(summary.totalProfit)} accent={summary.totalProfit >= 0 ? '#10b981' : '#ef4444'} />
              <StatBlock label="Avg Margin" value={formatPercent(summary.avgMargin)} accent={summary.avgMargin >= 0 ? '#10b981' : '#ef4444'} />
              <StatBlock label="Avg ROI" value={formatPercent(summary.avgROI)} accent={summary.avgROI >= 0 ? '#10b981' : '#ef4444'} />
            </div>

            {/* PO Cards Grid - The Main Visualization */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sortedByProfit.length, 8)}, 1fr)` }}>
              {sortedByProfit.slice(0, 16).map((po, index) => {
                const isSelected = selectedPO?.id === po.id
                const isProfitable = po.netProfit >= 0
                const profitRatio = Math.min(Math.abs(po.netMarginPercent) / 30, 1)
                const barHeight = 40 + profitRatio * 80

                return (
                  <button
                    key={po.id}
                    type="button"
                    onClick={() => setSelectedPOId(po.id)}
                    className={`group relative flex flex-col items-center rounded-lg border p-2 transition-all duration-300 ${
                      isSelected
                        ? 'border-[#00C2B9] bg-[#00C2B9]/10 shadow-[0_0_20px_rgba(0,194,185,0.3)]'
                        : 'border-[#0b3a52]/50 bg-[#0b3a52]/20 hover:border-[#0b3a52] hover:bg-[#0b3a52]/40'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className={`absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                      index === 0 ? 'bg-[#fbbf24] text-[#06182b]' :
                      index === 1 ? 'bg-[#94a3b8] text-[#06182b]' :
                      index === 2 ? 'bg-[#cd7f32] text-[#06182b]' :
                      'bg-[#0b3a52] text-[#6F7B8B]'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Profit Bar */}
                    <div className="relative mb-2 w-full" style={{ height: `${barHeight}px` }}>
                      <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t" style={{ height: `${barHeight}px` }}>
                        <div
                          className="absolute inset-x-0 bottom-0 transition-all duration-500"
                          style={{
                            height: `${profitRatio * 100}%`,
                            background: isProfitable
                              ? `linear-gradient(to top, #10b981, rgba(16, 185, 129, 0.3))`
                              : `linear-gradient(to top, #ef4444, rgba(239, 68, 68, 0.3))`,
                            boxShadow: isProfitable
                              ? '0 0 20px rgba(16, 185, 129, 0.4)'
                              : '0 0 20px rgba(239, 68, 68, 0.4)',
                          }}
                        />
                        {/* Grid lines */}
                        <div className="absolute inset-0 opacity-20" style={{
                          backgroundImage: 'linear-gradient(to bottom, #0b3a52 1px, transparent 1px)',
                          backgroundSize: '100% 10px',
                        }} />
                      </div>
                    </div>

                    {/* Order Code */}
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#6F7B8B] group-hover:text-[#00C2B9]">
                      {po.orderCode}
                    </span>

                    {/* Margin */}
                    <span className={`font-mono text-[10px] font-bold ${isProfitable ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {formatPercent(po.netMarginPercent)}
                    </span>

                    {/* Status Dot */}
                    <div
                      className="mt-1 h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: statusConfig[po.status].color,
                        boxShadow: `0 0 6px ${statusConfig[po.status].glow}`,
                      }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Flow Diagram for Selected PO */}
            {selectedPO && (
              <div className="mt-6 rounded-xl border border-[#0b3a52] bg-[#06182b]/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#00C2B9]" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#00C2B9]">
                    Profit Flow Analysis: {selectedPO.orderCode}
                  </span>
                </div>

                <svg
                  className="po-observatory-svg w-full"
                  viewBox="0 0 800 120"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id={`${gradientId}-revenue`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00C2B9" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#00C2B9" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-cost`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#64748b" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#64748b" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-profit`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={selectedPO.netProfit >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={selectedPO.netProfit >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                    </linearGradient>
                    <filter id={`${gradientId}-glow`}>
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Revenue Block */}
                  <g>
                    <rect x="0" y="30" width="120" height="60" rx="4" fill={`url(#${gradientId}-revenue)`} filter={`url(#${gradientId}-glow)`} />
                    <text x="60" y="55" textAnchor="middle" className="fill-white text-[10px] font-bold">REVENUE</text>
                    <text x="60" y="72" textAnchor="middle" className="fill-white/80 text-[11px]" fontFamily="monospace">{formatCurrency(selectedPO.grossRevenue)}</text>
                  </g>

                  {/* Arrow 1 */}
                  <path d="M 130 60 L 170 60" stroke="#0b3a52" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* COGS Block */}
                  <g>
                    <rect x="180" y="10" width="100" height="40" rx="4" fill="#64748b" opacity="0.6" />
                    <text x="230" y="28" textAnchor="middle" className="fill-white/80 text-[9px]">COGS</text>
                    <text x="230" y="42" textAnchor="middle" className="fill-white text-[10px]" fontFamily="monospace">-{formatCurrency(selectedPO.supplierCostTotal)}</text>
                  </g>

                  {/* Amazon Fees Block */}
                  <g>
                    <rect x="180" y="55" width="100" height="40" rx="4" fill="#d97706" opacity="0.6" />
                    <text x="230" y="73" textAnchor="middle" className="fill-white/80 text-[9px]">AMAZON FEES</text>
                    <text x="230" y="87" textAnchor="middle" className="fill-white text-[10px]" fontFamily="monospace">-{formatCurrency(selectedPO.amazonFeesTotal)}</text>
                  </g>

                  {/* Arrow 2 */}
                  <path d="M 290 60 L 330 60" stroke="#0b3a52" strokeWidth="2" />

                  {/* Gross Profit */}
                  <g>
                    <rect x="340" y="30" width="100" height="60" rx="4" fill={selectedPO.grossProfit >= 0 ? '#10b981' : '#ef4444'} opacity="0.4" />
                    <text x="390" y="50" textAnchor="middle" className="fill-white/80 text-[9px]">GROSS PROFIT</text>
                    <text x="390" y="67" textAnchor="middle" className="fill-white text-[11px] font-bold" fontFamily="monospace">{formatCurrency(selectedPO.grossProfit)}</text>
                    <text x="390" y="82" textAnchor="middle" className="fill-white/60 text-[9px]">{formatPercent(selectedPO.grossMarginPercent)}</text>
                  </g>

                  {/* Arrow 3 */}
                  <path d="M 450 60 L 490 60" stroke="#0b3a52" strokeWidth="2" />

                  {/* PPC Block */}
                  <g>
                    <rect x="500" y="30" width="100" height="60" rx="4" fill="#7c3aed" opacity="0.5" />
                    <text x="550" y="55" textAnchor="middle" className="fill-white/80 text-[9px]">PPC COST</text>
                    <text x="550" y="72" textAnchor="middle" className="fill-white text-[10px]" fontFamily="monospace">-{formatCurrency(selectedPO.ppcCost)}</text>
                  </g>

                  {/* Arrow 4 */}
                  <path d="M 610 60 L 650 60" stroke="#0b3a52" strokeWidth="2" />

                  {/* Net Profit Block */}
                  <g filter={`url(#${gradientId}-glow)`}>
                    <rect x="660" y="20" width="130" height="80" rx="6" fill={`url(#${gradientId}-profit)`} />
                    <text x="725" y="45" textAnchor="middle" className="fill-white text-[10px] font-bold">NET PROFIT</text>
                    <text x="725" y="68" textAnchor="middle" className="fill-white text-[14px] font-bold" fontFamily="monospace">{formatCurrency(selectedPO.netProfit)}</text>
                    <text x="725" y="88" textAnchor="middle" className="fill-white/80 text-[11px]">{formatPercent(selectedPO.netMarginPercent)} margin</text>
                  </g>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="relative overflow-hidden rounded-2xl border border-[#0b3a52] bg-[#06182b]">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0b3a52 1px, transparent 0)`,
            backgroundSize: '16px 16px',
          }} />

          <div className="relative p-5">
            {selectedPO ? (
              <>
                {/* Header */}
                <div className="mb-5 border-b border-[#0b3a52] pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6F7B8B]">Selected PO</span>
                    <div
                      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                      style={{
                        backgroundColor: `${statusConfig[selectedPO.status].color}20`,
                        color: statusConfig[selectedPO.status].color,
                        boxShadow: `0 0 10px ${statusConfig[selectedPO.status].glow}`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusConfig[selectedPO.status].color }} />
                      {statusConfig[selectedPO.status].label}
                    </div>
                  </div>
                  <h4 className="mt-2 font-mono text-xl font-bold tracking-wide text-white">{selectedPO.orderCode}</h4>
                  <p className="mt-1 text-xs text-[#6F7B8B]">{selectedPO.productName}</p>
                </div>

                {/* ROI Gauge */}
                <div className="mb-5 flex justify-center">
                  <ROIGauge value={selectedPO.roi} />
                </div>

                {/* Key Metrics */}
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <MetricCard label="Revenue" value={formatCurrency(selectedPO.grossRevenue)} accent="#00C2B9" />
                  <MetricCard label="Net Profit" value={formatCurrency(selectedPO.netProfit)} accent={selectedPO.netProfit >= 0 ? '#10b981' : '#ef4444'} />
                  <MetricCard label="Gross Margin" value={formatPercent(selectedPO.grossMarginPercent)} accent="#00C2B9" />
                  <MetricCard label="Net Margin" value={formatPercent(selectedPO.netMarginPercent)} accent={selectedPO.netMarginPercent >= 0 ? '#10b981' : '#ef4444'} />
                </div>

                {/* Cost Breakdown */}
                <div className="rounded-lg border border-[#0b3a52] bg-[#0b3a52]/20 p-3">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6F7B8B]">Cost Breakdown</span>
                  <div className="mt-3 space-y-2">
                    <CostRow label="Quantity" value={`${selectedPO.quantity.toLocaleString()} units`} />
                    <CostRow label="Unit Price" value={formatCurrency(selectedPO.sellingPrice)} />
                    <CostRow label="Landed Cost" value={formatCurrency(selectedPO.landedUnitCost)} color="#64748b" />
                    <CostRow label="COGS Total" value={formatCurrency(selectedPO.supplierCostTotal)} color="#64748b" />
                    <CostRow label="Amazon Fees" value={formatCurrency(selectedPO.amazonFeesTotal)} color="#d97706" />
                    <CostRow label="PPC Spend" value={formatCurrency(selectedPO.ppcCost)} color="#7c3aed" />
                  </div>
                </div>

                {/* Performance Indicator */}
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#0b3a52] bg-[#0b3a52]/20 p-3">
                  {selectedPO.netProfit >= 0 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-[#10b981]" />
                      <span className="font-mono text-xs text-[#10b981]">Profitable Order</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-[#ef4444]" />
                      <span className="font-mono text-xs text-[#ef4444]">Loss-Making Order</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-3 h-8 w-8 text-[#0b3a52]" />
                <span className="font-mono text-xs text-[#6F7B8B]">Select a PO to view details</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 rounded-xl border border-[#0b3a52] bg-[#06182b]/60 p-3">
        <LegendItem color="#00C2B9" label="Revenue" />
        <LegendItem color="#64748b" label="COGS" />
        <LegendItem color="#d97706" label="Amazon Fees" />
        <LegendItem color="#7c3aed" label="PPC Cost" />
        <LegendItem color="#10b981" label="Profit" />
        <LegendItem color="#ef4444" label="Loss" />
      </div>
    </div>
  )
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#0b3a52] bg-[#0b3a52]/30 p-3 text-center">
      <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[#6F7B8B]">{label}</span>
      <span className="mt-1 block font-mono text-lg font-bold" style={{ color: accent }}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#0b3a52] bg-[#0b3a52]/20 p-3">
      <span className="block font-mono text-[8px] uppercase tracking-[0.15em] text-[#6F7B8B]">{label}</span>
      <span className="mt-1 block font-mono text-sm font-bold" style={{ color: accent }}>{value}</span>
    </div>
  )
}

function CostRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#6F7B8B]">{label}</span>
      <span className="font-mono text-xs font-medium" style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-6 rounded-sm" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#6F7B8B]">{label}</span>
    </div>
  )
}

function ROIGauge({ value }: { value: number }) {
  const normalizedValue = Math.min(Math.max(value, -100), 200)
  const angle = ((normalizedValue + 100) / 300) * 180 - 90
  const isPositive = value >= 0
  const color = isPositive ? '#10b981' : '#ef4444'

  return (
    <div className="relative h-32 w-48">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <defs>
          <linearGradient id="gauge-bg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="33%" stopColor="#fbbf24" stopOpacity={0.3} />
            <stop offset="66%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.5} />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gauge-bg)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {[-100, -50, 0, 50, 100, 150, 200].map((tick) => {
          const tickAngle = ((tick + 100) / 300) * 180 - 90
          const rad = (tickAngle * Math.PI) / 180
          const x1 = 100 + 70 * Math.cos(rad)
          const y1 = 100 + 70 * Math.sin(rad)
          const x2 = 100 + 80 * Math.cos(rad)
          const y2 = 100 + 80 * Math.sin(rad)
          return (
            <g key={tick}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b3a52" strokeWidth="2" />
              <text
                x={100 + 58 * Math.cos(rad)}
                y={100 + 58 * Math.sin(rad)}
                textAnchor="middle"
                alignmentBaseline="middle"
                className="fill-[#6F7B8B] text-[8px]"
                fontFamily="monospace"
              >
                {tick}%
              </text>
            </g>
          )
        })}

        {/* Needle */}
        <g filter="url(#gauge-glow)">
          <line
            x1="100"
            y1="100"
            x2={100 + 65 * Math.cos((angle * Math.PI) / 180)}
            y2={100 + 65 * Math.sin((angle * Math.PI) / 180)}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="6" fill={color} />
        </g>

        {/* Value display */}
        <text x="100" y="85" textAnchor="middle" className="fill-white text-xl font-bold" fontFamily="monospace">
          {value.toFixed(1)}%
        </text>
        <text x="100" y="100" textAnchor="middle" className="fill-[#6F7B8B] text-[10px] uppercase tracking-wider">
          ROI
        </text>
      </svg>
    </div>
  )
}
