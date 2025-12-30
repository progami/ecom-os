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
import { Check, Download } from 'lucide-react'
import { SHEET_TOOLBAR_GROUP } from '@/components/sheet-toolbar'
import { usePersistentState } from '@/hooks/usePersistentState'

export type TrendGranularity = 'weekly' | 'monthly' | 'quarterly'
export type TrendSeries = Record<TrendGranularity, { labels: string[]; values: number[]; impactFlags?: boolean[] }>
export type TrendFormat = 'currency' | 'number' | 'percent'
export type TrendAccent = 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'

export interface FinancialMetricDefinition {
  key: string
  title: string
  description: string
  helper?: string
  series: TrendSeries
  format: TrendFormat
  accent: TrendAccent
}

interface FinancialTrendsSectionProps {
  title: string
  description: string
  metrics: FinancialMetricDefinition[]
  defaultMetricKey?: string
  storageKey?: string
}

export function FinancialTrendsSection({ title, description, metrics, storageKey }: FinancialTrendsSectionProps) {
  const storagePrefix = storageKey ?? `xplan:financial-trends:${title}`
  const [granularity, setGranularity, granularityHydrated] = usePersistentState<TrendGranularity>(
    `${storagePrefix}:granularity`,
    'weekly',
  )
  const [disabledMetrics, setDisabledMetrics, disabledHydrated] = usePersistentState<string[]>(
    `${storagePrefix}:disabled`,
    [],
  )
  const hydrated = granularityHydrated && disabledHydrated

  const enabledMetrics = useMemo(() => {
    return metrics.filter((m) => !disabledMetrics.includes(m.key))
  }, [metrics, disabledMetrics])

  const toggleMetric = (key: string) => {
    setDisabledMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key)
      }
      if (enabledMetrics.length <= 1) return prev
      return [...prev, key]
    })
  }

  const granularityAvailability = useMemo(() => {
    return metrics.reduce(
      (availability, metric) => {
        if (metric.series.weekly.values.some((value) => Number.isFinite(value))) {
          availability.weekly = true
        }
        if (metric.series.monthly.values.some((value) => Number.isFinite(value))) {
          availability.monthly = true
        }
        if (metric.series.quarterly.values.some((value) => Number.isFinite(value))) {
          availability.quarterly = true
        }
        return availability
      },
      { weekly: false, monthly: false, quarterly: false }
    )
  }, [metrics])

  useEffect(() => {
    if (!hydrated) return
    if (!granularityAvailability[granularity]) {
      const fallback: TrendGranularity | null = granularityAvailability.weekly
        ? 'weekly'
        : granularityAvailability.monthly
          ? 'monthly'
          : granularityAvailability.quarterly
            ? 'quarterly'
            : null
      if (fallback && granularity !== fallback) {
        setGranularity(fallback)
      }
    }
  }, [granularity, granularityAvailability, hydrated, setGranularity])

  if (!metrics.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
        </div>
        <p className="mt-4">No data available yet.</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls bar - matching Sales Planning structure */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">Cadence</span>
          {granularityOptions.map((option) => {
            const isActive = option.value === granularity
            const isAvailable = granularityAvailability[option.value]
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => isAvailable && setGranularity(option.value)}
                disabled={!isAvailable}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                  isActive
                    ? 'bg-cyan-100 text-cyan-800 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-200'
                    : isAvailable
                      ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                      : 'cursor-not-allowed text-slate-400 opacity-50 dark:text-slate-500'
                }`}
                title={!isAvailable ? 'No data available for this cadence' : option.helper}
              >
                {isActive && <Check className="h-3 w-3" />}
                {option.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const svg = document.querySelector('.financial-trend-svg') as SVGElement
            if (!svg) return
            const data = new XMLSerializer().serializeToString(svg)
            const blob = new Blob([data], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const safeName = title.toLowerCase().replace(/\s+/g, '-')
            a.download = `${safeName}-${granularity}.svg`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#00C2B9]/50 dark:hover:text-cyan-100 dark:focus-visible:outline-[#00C2B9]"
        >
          <Download className="h-3.5 w-3.5" />
          Export SVG
        </button>
      </div>

      {/* Main card - matching Sales Planning structure */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/60">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-600 dark:text-[#6F7B8B]">{description}</p>
        </div>

        <MultiMetricChart
          metrics={metrics}
          enabledMetrics={enabledMetrics}
          granularity={granularity}
          onToggleMetric={toggleMetric}
        />
      </div>
    </div>
  )
}

const granularityOptions: Array<{ value: TrendGranularity; label: string; helper: string }> = [
  { value: 'weekly', label: 'Weekly', helper: 'View week-over-week results' },
  { value: 'monthly', label: 'Monthly', helper: 'View month-over-month results' },
  { value: 'quarterly', label: 'Quarterly', helper: 'Review quarter-close pacing' },
]

const accentPalette: Record<TrendAccent, { hex: string; hexDark: string; labelClass: string }> = {
  sky: {
    hex: '#0891b2',
    hexDark: '#00C2B9',
    labelClass: 'text-cyan-700 dark:text-cyan-300/80',
  },
  emerald: {
    hex: '#059669',
    hexDark: '#10b981',
    labelClass: 'text-emerald-700 dark:text-emerald-300/80',
  },
  violet: {
    hex: '#7c3aed',
    hexDark: '#a78bfa',
    labelClass: 'text-violet-700 dark:text-violet-300/80',
  },
  amber: {
    hex: '#d97706',
    hexDark: '#fbbf24',
    labelClass: 'text-amber-700 dark:text-amber-300/80',
  },
  rose: {
    hex: '#e11d48',
    hexDark: '#fb7185',
    labelClass: 'text-rose-700 dark:text-rose-300/80',
  },
}

type TrendHover = { index: number; x: number; y: number } | null

interface MultiMetricChartProps {
  metrics: FinancialMetricDefinition[]
  enabledMetrics: FinancialMetricDefinition[]
  granularity: TrendGranularity
  onToggleMetric: (key: string) => void
}

function MultiMetricChart({ metrics, enabledMetrics, granularity, onToggleMetric }: MultiMetricChartProps) {
  const [hover, setHover] = useState<TrendHover>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const baseGradientId = useId()

  useEffect(() => {
    setHover(null)
  }, [granularity, enabledMetrics])

  // Chart dimensions - matching Sales Planning exactly
  const viewBoxWidth = 1400
  const chartHeight = 600
  const padding = { top: 40, right: 40, bottom: 60, left: 80 }
  const innerWidth = viewBoxWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  // Get labels from first metric
  const labels = enabledMetrics[0]?.series[granularity].labels ?? []
  const impactFlags = enabledMetrics[0]?.series[granularity].impactFlags

  // Calculate domain across all enabled metrics
  const { domainMin, domainMax } = useMemo(() => {
    if (!enabledMetrics.length) return { domainMin: -1, domainMax: 1 }

    let minBound = Infinity
    let maxBound = -Infinity

    for (const metric of enabledMetrics) {
      const values = metric.series[granularity].values
      for (const value of values) {
        if (Number.isFinite(value)) {
          if (value < minBound) minBound = value
          if (value > maxBound) maxBound = value
        }
      }
    }

    if (!Number.isFinite(minBound)) minBound = 0
    if (!Number.isFinite(maxBound)) maxBound = 0

    const hasPositive = maxBound > 0
    const hasNegative = minBound < 0

    const span = maxBound - minBound
    const basePadding = span === 0 ? Math.max(1, Math.abs(maxBound) || Math.abs(minBound) || 1) * 0.1 : span * 0.1

    if (hasPositive && !hasNegative) {
      minBound -= basePadding
    } else if (!hasPositive && hasNegative) {
      maxBound += basePadding
    } else if (hasPositive && hasNegative) {
      minBound -= basePadding * 0.5
      maxBound += basePadding * 0.5
    } else {
      minBound = -1
      maxBound = 1
    }

    if (minBound === maxBound) {
      minBound -= 1
      maxBound += 1
    }

    return { domainMin: minBound, domainMax: maxBound }
  }, [enabledMetrics, granularity])

  const range = domainMax - domainMin || 1

  // Calculate points for each enabled metric
  const metricData = useMemo(() => {
    return enabledMetrics.map((metric) => {
      const values = metric.series[granularity].values
      const snappedValues = values.map(snapNearZero)
      const points = values.map((value, index) => {
        const x = padding.left + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
        const normalized = range === 0 ? 0.5 : (value - domainMin) / range
        const y = padding.top + innerHeight - normalized * innerHeight
        return { x, y }
      })
      return { metric, values, snappedValues, points }
    })
  }, [enabledMetrics, granularity, domainMin, range, innerWidth, innerHeight])

  const activeIndex = hover?.index ?? (labels.length > 0 ? labels.length - 1 : null)

  // Y-axis ticks
  const yAxisTicks = useMemo(() => {
    if (!enabledMetrics.length) return [0]
    let minVal = Infinity
    let maxVal = -Infinity
    for (const metric of enabledMetrics) {
      const values = metric.series[granularity].values
      for (const v of values) {
        if (Number.isFinite(v)) {
          if (v < minVal) minVal = v
          if (v > maxVal) maxVal = v
        }
      }
    }
    if (!Number.isFinite(minVal)) minVal = 0
    if (!Number.isFinite(maxVal)) maxVal = 0
    return niceScale(Math.min(0, minVal), maxVal, 6)
  }, [enabledMetrics, granularity])

  // X-axis tick indices - matching Sales Planning spacing (every ~4 weeks for 52 weeks)
  const xAxisTickIndices = useMemo(() => {
    const count = labels.length
    if (count <= 12) return labels.map((_, i) => i)
    const stride = Math.max(1, Math.floor(count / 12))
    const indices: number[] = []
    for (let i = 0; i < count; i += stride) {
      indices.push(i)
    }
    return indices
  }, [labels])

  const valueToY = (value: number) => {
    const normalized = range === 0 ? 0.5 : (value - domainMin) / range
    return padding.top + innerHeight - normalized * innerHeight
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (labels.length === 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / viewBoxWidth || 1
    const paddingLeftPx = padding.left * scaleX
    const paddingRightPx = padding.right * scaleX
    const clampedX = Math.max(paddingLeftPx, Math.min(bounds.width - paddingRightPx, relativeX))
    const normalized = (clampedX - paddingLeftPx) / Math.max(1, bounds.width - paddingLeftPx - paddingRightPx)
    const maxIndex = Math.max(0, labels.length - 1)
    const index = Math.round(normalized * maxIndex)
    const firstMetricPoints = metricData[0]?.points ?? []
    const point = firstMetricPoints[index]
    if (!point) return

    const scaleY = bounds.height / chartHeight || 1
    const px = point.x * scaleX
    const py = point.y * scaleY
    setHover({ index, x: px, y: py })
  }

  const handlePointerLeave = () => setHover(null)

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (labels.length === 0) return
    event.preventDefault()
    const currentIndex = activeIndex ?? labels.length - 1
    const nextIndex = event.key === 'ArrowLeft'
      ? Math.max(0, currentIndex - 1)
      : Math.min(labels.length - 1, currentIndex + 1)
    const firstMetricPoints = metricData[0]?.points ?? []
    const point = firstMetricPoints[nextIndex]
    if (!point) return
    const bounds = chartRef.current?.getBoundingClientRect()
    if (!bounds) return
    const scaleX = bounds.width / viewBoxWidth || 1
    const scaleY = bounds.height / chartHeight || 1
    setHover({ index: nextIndex, x: point.x * scaleX, y: point.y * scaleY })
  }

  const zeroLineY = domainMin < 0 && domainMax > 0
    ? padding.top + innerHeight - ((0 - domainMin) / range) * innerHeight
    : null

  // Get format from first enabled metric
  const format = enabledMetrics[0]?.format ?? 'currency'

  const formatAxisLabel = (value: number) => {
    if (format === 'currency') {
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
      return `$${value.toFixed(0)}`
    }
    if (format === 'percent') return `${(value * 100).toFixed(0)}%`
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  // Get week label from full label (e.g., "W1 · Jan 5 2026" -> "W1")
  const getWeekLabel = (label: string) => {
    const parts = label.split(' · ')
    return parts[0] || label
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        {/* Chart area */}
        <div ref={chartRef} className="aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-[#0b3a52] dark:bg-[#06182b]/85">
          <svg
            className="financial-trend-svg h-full w-full"
            viewBox={`0 0 ${viewBoxWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Financial trends chart"
            tabIndex={0}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
          >
            {/* Gradient definitions */}
            <defs>
              {metricData.map(({ metric }, idx) => {
                const palette = accentPalette[metric.accent]
                return (
                  <linearGradient key={metric.key} id={`${baseGradientId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.hexDark} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={palette.hexDark} stopOpacity={0.05} />
                  </linearGradient>
                )
              })}
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

            {/* Area fills for each metric */}
            {metricData.map(({ metric, points }, idx) => (
              <path
                key={`area-${metric.key}`}
                d={`M${padding.left} ${chartHeight - padding.bottom} ${points
                  .map((p) => `L${p.x} ${p.y}`)
                  .join(' ')} L${viewBoxWidth - padding.right} ${chartHeight - padding.bottom} Z`}
                fill={`url(#${baseGradientId}-${idx})`}
                opacity={0.3}
              />
            ))}

            {/* Impact indicator lines */}
            {impactFlags && impactFlags.length > 0 && metricData[0] && (
              <g className="impact-indicators">
                {metricData[0].points.map((point, index) => {
                  if (!impactFlags[index]) return null
                  return (
                    <line
                      key={`impact-${index}`}
                      x1={point.x}
                      x2={point.x}
                      y1={padding.top}
                      y2={chartHeight - padding.bottom}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeOpacity={0.35}
                    />
                  )
                })}
              </g>
            )}

            {/* Lines for each metric */}
            {metricData.map(({ metric, points }) => {
              const palette = accentPalette[metric.accent]
              return (
                <path
                  key={`line-${metric.key}`}
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? chartHeight - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={palette.hex}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="dark:hidden"
                />
              )
            })}
            {metricData.map(({ metric, points }) => {
              const palette = accentPalette[metric.accent]
              return (
                <path
                  key={`line-dark-${metric.key}`}
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? chartHeight - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={palette.hexDark}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="hidden dark:block"
                />
              )
            })}

            {/* Active week indicator */}
            {activeIndex != null && metricData[0]?.points[activeIndex] && (
              <line
                x1={metricData[0].points[activeIndex].x}
                x2={metricData[0].points[activeIndex].x}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke="#0891b2"
                strokeWidth={3}
                strokeDasharray="6 4"
                opacity={0.35}
                className="pointer-events-none dark:hidden"
              />
            )}
            {activeIndex != null && metricData[0]?.points[activeIndex] && (
              <line
                x1={metricData[0].points[activeIndex].x}
                x2={metricData[0].points[activeIndex].x}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke="#00C2B9"
                strokeWidth={3}
                strokeDasharray="6 4"
                opacity={0.35}
                className="pointer-events-none hidden dark:block"
              />
            )}

            {/* Zero line */}
            {zeroLineY != null && (
              <line
                x1={padding.left}
                x2={viewBoxWidth - padding.right}
                y1={zeroLineY}
                y2={zeroLineY}
                stroke="rgba(100, 116, 139, 0.5)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {/* Data points */}
            {metricData.map(({ metric, points }) => {
              const palette = accentPalette[metric.accent]
              return points.map((point, index) => {
                const isHovered = activeIndex === index
                return (
                  <circle
                    key={`point-${metric.key}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 7 : 5}
                    fill={palette.hex}
                    stroke="#ffffff"
                    strokeWidth="2"
                    opacity={isHovered ? 1 : 0.75}
                    className="pointer-events-none transition-all duration-150 dark:hidden"
                  />
                )
              })
            })}
            {metricData.map(({ metric, points }) => {
              const palette = accentPalette[metric.accent]
              return points.map((point, index) => {
                const isHovered = activeIndex === index
                return (
                  <circle
                    key={`point-dark-${metric.key}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 7 : 5}
                    fill={palette.hexDark}
                    stroke="#041324"
                    strokeWidth="2"
                    opacity={isHovered ? 1 : 0.75}
                    className="pointer-events-none hidden transition-all duration-150 dark:block"
                  />
                )
              })
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
                    {formatAxisLabel(tick)}
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
                const label = labels[tickIndex]
                if (!point || !label) return null
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
                      className="fill-[#6F7B8B] text-xs"
                    >
                      {getWeekLabel(label)}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Sidebar - matching Sales Planning exactly */}
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/85">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
              {hover ? 'Selected week' : 'Latest week'}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {activeIndex != null ? labels[activeIndex] ?? '—' : '—'}
            </p>
          </div>
          {metricData.map(({ metric, snappedValues }) => {
            const palette = accentPalette[metric.accent]
            const value = activeIndex != null ? snappedValues[activeIndex] : snappedValues.at(-1)
            const prevValue = activeIndex != null && activeIndex > 0 ? snappedValues[activeIndex - 1] : (snappedValues.length > 1 ? snappedValues.at(-2) : null)
            const change = value != null && prevValue != null ? value - prevValue : null
            const changePercent = value != null && prevValue != null && prevValue !== 0
              ? ((value - prevValue) / Math.abs(prevValue)) * 100
              : null

            return (
              <div key={metric.key} className="space-y-1">
                <p className={`text-xs font-bold uppercase tracking-[0.28em] ${palette.labelClass}`}>
                  {metric.title}
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatSimpleValue(value ?? NaN, metric.format)}
                  {metric.format === 'number' && (
                    <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">units</span>
                  )}
                </p>
                {change != null && (
                  <p className={`text-xs ${
                    change > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                    change < 0 ? 'text-red-600 dark:text-red-400' :
                    'text-slate-500 dark:text-slate-400'
                  }`}>
                    {change >= 0 ? '+' : ''}{formatSimpleValue(change, metric.format)}
                    {changePercent != null && (
                      <span className="ml-1 text-slate-500 dark:text-slate-400">
                        ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )
          })}
        </aside>
      </div>

      {/* Legend - matching Sales Planning style */}
      <div className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
        {metrics.map((metric) => {
          const palette = accentPalette[metric.accent]
          const isEnabled = enabledMetrics.some((m) => m.key === metric.key)
          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => onToggleMetric(metric.key)}
              className="flex items-center gap-2"
            >
              <div
                className="h-3 w-8 rounded-sm"
                style={{ backgroundColor: isEnabled ? palette.hex : '#94a3b8' }}
              />
              <span className={`text-xs ${isEnabled ? 'text-slate-600 dark:text-[#6F7B8B]' : 'text-slate-400 dark:text-slate-500'}`}>
                {metric.title}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

const ZERO_EPSILON = 0.0001

function snapNearZero(value: number) {
  return Math.abs(value) < ZERO_EPSILON ? 0 : value
}

function formatSimpleValue(value: number, format: TrendFormat) {
  if (!Number.isFinite(value)) return '—'
  if (format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
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
