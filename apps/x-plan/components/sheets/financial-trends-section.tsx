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
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SEGMENTED,
} from '@/components/sheet-toolbar'
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
      // Don't allow disabling all metrics
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
      <section className="rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 text-sm text-slate-400 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">{title}</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{description}</h2>
        </header>
        <p className="mt-4">No data available yet.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
      <header className="space-y-4 lg:flex lg:items-end lg:justify-between lg:space-y-0">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">{title}</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{description}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <GranularityToggle value={granularity} onChange={setGranularity} availability={granularityAvailability} />
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
      </header>
      <MultiMetricChart
        metrics={metrics}
        enabledMetrics={enabledMetrics}
        granularity={granularity}
        onToggleMetric={toggleMetric}
      />
    </section>
  )
}

const granularityOptions: Array<{ value: TrendGranularity; label: string; helper: string }> = [
  { value: 'weekly', label: 'Weekly', helper: 'View week-over-week results' },
  { value: 'monthly', label: 'Monthly', helper: 'View month-over-month results' },
  { value: 'quarterly', label: 'Quarterly', helper: 'Review quarter-close pacing' },
]

function GranularityToggle({
  value,
  onChange,
  availability,
}: {
  value: TrendGranularity
  onChange: (value: TrendGranularity) => void
  availability: Record<TrendGranularity, boolean>
}) {
  return (
    <div className={SHEET_TOOLBAR_GROUP}>
      <span className={SHEET_TOOLBAR_LABEL}>Rollup cadence</span>
      <div
        role="group"
        aria-label="Select performance granularity"
        className={SHEET_TOOLBAR_SEGMENTED}
      >
        {granularityOptions.map((option) => {
          const isActive = option.value === value
          const isAvailable = availability[option.value]
          return (
            <button
              key={option.value}
              type="button"
              className={`${SHEET_TOOLBAR_BUTTON} flex items-center gap-1.5 rounded-none first:rounded-l-full last:rounded-r-full ${
                isActive
                  ? 'border-[#00c2b9] bg-cyan-600 text-white shadow-[0_12px_24px_rgba(0,194,185,0.15)] dark:bg-[#00c2b9]/15 dark:text-cyan-100'
                  : 'text-slate-700 hover:text-cyan-700 dark:text-slate-200 dark:hover:text-cyan-100'
              } ${!isAvailable ? 'cursor-not-allowed opacity-50 hover:text-slate-500 dark:hover:text-slate-400' : ''}`}
              onClick={() => isAvailable && onChange(option.value)}
              aria-pressed={isActive}
              aria-disabled={!isAvailable}
              title={!isAvailable ? 'No data available for this cadence yet' : option.helper}
            >
              {isActive && <Check className="h-3 w-3" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const accentPalette: Record<TrendAccent, { hex: string; hexDark: string; bg: string; text: string }> = {
  sky: {
    hex: '#0891b2',
    hexDark: '#22d3ee',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
  },
  emerald: {
    hex: '#059669',
    hexDark: '#34d399',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
  violet: {
    hex: '#7c3aed',
    hexDark: '#a78bfa',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-800 dark:text-violet-200',
  },
  amber: {
    hex: '#d97706',
    hexDark: '#fbbf24',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-200',
  },
  rose: {
    hex: '#e11d48',
    hexDark: '#fb7185',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-800 dark:text-rose-200',
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
  const [chartSize, setChartSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const baseGradientId = useId()

  useEffect(() => {
    setHover(null)
  }, [granularity, enabledMetrics])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const element = chartRef.current
    if (!element) return

    const applySize = (width: number, height: number) => {
      setChartSize((prev) => {
        if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
          return prev
        }
        return { width, height }
      })
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      applySize(width, height)
    })

    observer.observe(element)
    const initialRect = element.getBoundingClientRect()
    applySize(initialRect.width, initialRect.height)
    return () => observer.disconnect()
  }, [])

  const width = Math.max(640, chartSize.width || 640)
  const height = 500
  const padding = { top: 32, right: 24, bottom: 56, left: 70 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  // Get labels from first metric (they should all have same labels)
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
  }, [enabledMetrics, granularity, domainMin, range, padding.left, padding.top, innerWidth, innerHeight])

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

  // X-axis tick indices
  const xAxisTickIndices = useMemo(() => {
    const count = labels.length
    if (count <= 6) return labels.map((_, i) => i)
    const stride = Math.max(1, Math.floor(count / 6))
    const indices: number[] = []
    for (let i = 0; i < count; i += stride) {
      indices.push(i)
    }
    if (indices[indices.length - 1] !== count - 1) {
      indices.push(count - 1)
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
    const scaleX = bounds.width / width || 1
    const paddingLeftPx = padding.left * scaleX
    const paddingRightPx = padding.right * scaleX
    const clampedX = Math.max(paddingLeftPx, Math.min(bounds.width - paddingRightPx, relativeX))
    const normalized = (clampedX - paddingLeftPx) / Math.max(1, bounds.width - paddingLeftPx - paddingRightPx)
    const maxIndex = Math.max(0, labels.length - 1)
    const index = Math.round(normalized * maxIndex)
    const firstMetricPoints = metricData[0]?.points ?? []
    const point = firstMetricPoints[index]
    if (!point) return

    const scaleY = bounds.height / height || 1
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
    const scaleX = bounds.width / width || 1
    const scaleY = bounds.height / height || 1
    setHover({ index: nextIndex, x: point.x * scaleX, y: point.y * scaleY })
  }

  const zeroLineY = domainMin < 0 && domainMax > 0
    ? padding.top + innerHeight - ((0 - domainMin) / range) * innerHeight
    : null

  // Get format from first enabled metric (assume all same format)
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

  return (
    <article className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div ref={chartRef} className="relative aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 backdrop-blur-sm">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Financial trends chart"
            className="financial-trend-svg h-full w-full"
            tabIndex={0}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
          >
            {/* Gradient definitions */}
            {metricData.map(({ metric }, idx) => {
              const palette = accentPalette[metric.accent]
              return (
                <linearGradient key={metric.key} id={`${baseGradientId}-${idx}`} gradientTransform="rotate(90)">
                  <stop offset="0%" stopColor={palette.hex} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={palette.hex} stopOpacity={0.02} />
                </linearGradient>
              )
            })}

            {/* Horizontal grid lines */}
            <g className="opacity-40">
              {yAxisTicks.map((tick, index) => (
                <line
                  key={`grid-y-${index}-${tick}`}
                  x1={padding.left}
                  y1={valueToY(tick)}
                  x2={width - padding.right}
                  y2={valueToY(tick)}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}
            </g>

            {/* Area fills for each metric */}
            {metricData.map(({ metric, points }, idx) => (
              <path
                key={`area-${metric.key}`}
                d={`M${padding.left} ${height - padding.bottom} ${points
                  .map((p) => `L${p.x} ${p.y}`)
                  .join(' ')} L${width - padding.right} ${height - padding.bottom} Z`}
                fill={`url(#${baseGradientId}-${idx})`}
                opacity={0.6}
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
                      y2={height - padding.bottom}
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
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? height - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={palette.hex}
                  strokeWidth={2.5}
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
                  d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? height - padding.bottom} ${points
                    .slice(1)
                    .map((p) => `L${p.x} ${p.y}`)
                    .join(' ')}`}
                  fill="none"
                  stroke={palette.hexDark}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="hidden dark:block"
                />
              )
            })}

            {/* Zero line */}
            {zeroLineY != null && (
              <line
                x1={padding.left}
                x2={width - padding.right}
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
              return points.map((point, index) => (
                <circle
                  key={`point-${metric.key}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === activeIndex ? 5 : 3}
                  fill={palette.hex}
                  opacity={index === activeIndex ? 1 : 0.6}
                  className="dark:hidden"
                />
              ))
            })}
            {metricData.map(({ metric, points }) => {
              const palette = accentPalette[metric.accent]
              return points.map((point, index) => (
                <circle
                  key={`point-dark-${metric.key}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === activeIndex ? 5 : 3}
                  fill={palette.hexDark}
                  opacity={index === activeIndex ? 1 : 0.6}
                  className="hidden dark:block"
                />
              ))
            })}

            {/* Active point indicator line */}
            {activeIndex != null && metricData[0]?.points[activeIndex] && (
              <line
                x1={metricData[0].points[activeIndex].x}
                x2={metricData[0].points[activeIndex].x}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.5}
              />
            )}

            {/* Y-axis */}
            <g>
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth="1.5"
              />
              {yAxisTicks.map((tick, index) => (
                <g key={`y-tick-${index}-${tick}`}>
                  <line
                    x1={padding.left - 4}
                    y1={valueToY(tick)}
                    x2={padding.left}
                    y2={valueToY(tick)}
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <text
                    x={padding.left - 8}
                    y={valueToY(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
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
                y1={height - padding.bottom}
                x2={width - padding.right}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth="1.5"
              />
              {xAxisTickIndices.map((tickIndex) => {
                const point = metricData[0]?.points[tickIndex]
                const label = labels[tickIndex]
                if (!point || !label) return null
                return (
                  <g key={`x-tick-${tickIndex}`}>
                    <line
                      x1={point.x}
                      y1={height - padding.bottom}
                      x2={point.x}
                      y2={height - padding.bottom + 4}
                      stroke="#64748b"
                      strokeWidth="1.5"
                    />
                    <text
                      x={point.x}
                      y={height - padding.bottom + 16}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px]"
                    >
                      {label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Sidebar with values */}
        <aside className="space-y-4 rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 p-4 text-sm backdrop-blur-sm">
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
            return (
              <div key={metric.key} className="space-y-0.5">
                <p className={`text-xs font-bold uppercase tracking-[0.28em] ${palette.text}`}>
                  {metric.title}
                </p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatSimpleValue(value ?? NaN, metric.format)}
                </p>
                {change != null && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {change >= 0 ? '+' : ''}{formatSimpleValue(change, metric.format)}
                  </p>
                )}
              </div>
            )
          })}
        </aside>
      </div>

      {/* Bottom legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
        {metrics.map((metric) => {
          const palette = accentPalette[metric.accent]
          const isEnabled = enabledMetrics.some((m) => m.key === metric.key)
          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => onToggleMetric(metric.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isEnabled
                  ? `${palette.bg} ${palette.text}`
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              <div
                className="h-3 w-6 rounded-sm"
                style={{ backgroundColor: isEnabled ? palette.hex : '#94a3b8' }}
              />
              {metric.title}
              {isEnabled && <Check className="h-3 w-3" />}
            </button>
          )
        })}
      </div>
    </article>
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
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
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
