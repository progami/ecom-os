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
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar'
import { usePersistentState } from '@/hooks/usePersistentState'

export type TrendGranularity = 'weekly' | 'monthly' | 'quarterly'
export type TrendSeries = Record<TrendGranularity, { labels: string[]; values: number[] }>
export type TrendFormat = 'currency' | 'number' | 'percent'
export type TrendAccent = 'sky' | 'emerald' | 'violet'

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

export function FinancialTrendsSection({ title, description, metrics, defaultMetricKey, storageKey }: FinancialTrendsSectionProps) {
  const storagePrefix = storageKey ?? `xplan:financial-trends:${title}`
  const [granularity, setGranularity, granularityHydrated] = usePersistentState<TrendGranularity>(
    `${storagePrefix}:granularity`,
    'weekly',
  )
  const [activeMetric, setActiveMetric, metricHydrated] = usePersistentState<string>(
    `${storagePrefix}:metric`,
    () => defaultMetricKey ?? metrics[0]?.key ?? '',
  )
  const hydrated = granularityHydrated && metricHydrated

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

  useEffect(() => {
    if (!hydrated || !metrics.length) return
    const target = metrics.find((metric) => metric.key === activeMetric)
    if (!target) {
      setActiveMetric(metrics[0]?.key ?? '')
    }
  }, [metrics, activeMetric, hydrated, setActiveMetric])

  const resolvedMetric = useMemo(() => {
    return metrics.find((metric) => metric.key === activeMetric) ?? metrics[0] ?? null
  }, [activeMetric, metrics])

  if (!metrics.length || !resolvedMetric) {
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
          {resolvedMetric.helper ? (
            <p className="text-sm text-slate-700 dark:text-slate-200/80">{resolvedMetric.helper}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <MetricSelect options={metrics} value={resolvedMetric.key} onChange={setActiveMetric} />
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
              a.download = `${safeName}-${resolvedMetric.key}-${granularity}.svg`
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
      <TrendChart
        key={resolvedMetric.key}
        title={resolvedMetric.title}
        description={resolvedMetric.description}
        helper={resolvedMetric.helper}
        series={resolvedMetric.series}
        granularity={granularity}
        format={resolvedMetric.format}
        accent={resolvedMetric.accent}
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

function MetricSelect({
  options,
  value,
  onChange,
}: {
  options: FinancialMetricDefinition[]
  value: string
  onChange: (value: string) => void
}) {
  if (options.length === 0) {
    return null
  }

  return (
    <label className={`${SHEET_TOOLBAR_GROUP} cursor-pointer`}>
      <span className={SHEET_TOOLBAR_LABEL}>Metric</span>
      <select
        className={`${SHEET_TOOLBAR_SELECT} min-w-[9rem]`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.title}
          </option>
        ))}
      </select>
    </label>
  )
}

const accentPalette: Record<TrendAccent, { hex: string; badge: string; badgeDark: string }> = {
  sky: {
    hex: '#0891b2',
    badge: 'bg-cyan-100 text-cyan-800',
    badgeDark: 'dark:bg-cyan-500/20 dark:text-cyan-200',
  },
  emerald: {
    hex: '#059669',
    badge: 'bg-emerald-100 text-emerald-800',
    badgeDark: 'dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  violet: {
    hex: '#7c3aed',
    badge: 'bg-violet-100 text-violet-800',
    badgeDark: 'dark:bg-violet-500/20 dark:text-violet-200',
  },
}

type TrendHover = { index: number; x: number; y: number } | null

type TrendChartProps = {
  title: string
  description: string
  helper?: string
  series: TrendSeries
  granularity: TrendGranularity
  format: TrendFormat
  accent: TrendAccent
}

function TrendChart({ title, description, helper, series, granularity, format, accent }: TrendChartProps) {
  const palette = accentPalette[accent]
  const [hover, setHover] = useState<TrendHover>(null)
  const { labels, values } = series[granularity]
  const snappedValues = useMemo(() => values.map(snapNearZero), [values])
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  useEffect(() => {
    setHover(null)
  }, [granularity, series])

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

  const { activeIndex, change, changePercent } = useMemo(() => {
    if (!snappedValues.length) return { activeIndex: null, change: null, changePercent: null }

    const index = hover?.index ?? snappedValues.length - 1
    const previousIndex = index > 0 ? index - 1 : null
    const previousValue = previousIndex != null ? snappedValues[previousIndex] ?? null : null
    const activeValue = snappedValues[index] ?? null

    if (activeValue == null || previousValue == null) {
      return { activeIndex: index, change: null, changePercent: null }
    }

    const delta = activeValue - previousValue
    const percent = previousValue === 0 ? null : delta / Math.abs(previousValue)
    return { activeIndex: index, change: delta, changePercent: percent }
  }, [hover, snappedValues])

  const gradientId = useId()
  const width = Math.max(640, chartSize.width || 640)
  const height = 500
  const padding = { top: 32, right: 24, bottom: 56, left: 70 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const color = palette.hex

  const { domainMin, domainMax, minValue, maxValue } = useMemo(() => {
    if (!values.length) {
      return { domainMin: -1, domainMax: 1, minValue: 0, maxValue: 0 }
    }

    let minBound = Math.min(...values)
    let maxBound = Math.max(...values)

    if (!Number.isFinite(minBound)) minBound = 0
    if (!Number.isFinite(maxBound)) maxBound = 0

    const minValue = minBound
    const maxValue = maxBound

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

    return { domainMin: minBound, domainMax: maxBound, minValue, maxValue }
  }, [values])

  const range = domainMax - domainMin || 1
  const zeroLineY =
    minValue <= 0 && domainMin < 0 && domainMax > 0
      ? padding.top + innerHeight - ((0 - domainMin) / range) * innerHeight
      : null
  const points = useMemo(
    () =>
      values.map((value, index) => {
        const x = padding.left + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
        const normalized = range === 0 ? 0.5 : (value - domainMin) / range
        const y = padding.top + innerHeight - normalized * innerHeight
        return { x, y }
      }),
    [values, padding.left, padding.top, innerHeight, innerWidth, range, domainMin]
  )

  // Calculate Y-axis ticks using nice scale
  const yAxisTicks = useMemo(() => {
    if (!values.length) return [0]
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    return niceScale(Math.min(0, minVal), maxVal, 6)
  }, [values])

  // Calculate X-axis tick indices (show subset to avoid crowding)
  const xAxisTickIndices = useMemo(() => {
    const count = labels.length
    if (count <= 6) return labels.map((_, i) => i)
    const stride = Math.max(1, Math.floor(count / 6))
    const indices: number[] = []
    for (let i = 0; i < count; i += stride) {
      indices.push(i)
    }
    // Always include the last point
    if (indices[indices.length - 1] !== count - 1) {
      indices.push(count - 1)
    }
    return indices
  }, [labels])
  const latestPoint = points.at(-1)
  const activePoint = activeIndex != null ? points[activeIndex] ?? null : null
  const ariaLabel = `${title} trend: ${values
    .map((value, index) => `${labels[index] ?? `Point ${index + 1}`}: ${formatSimpleValue(value, format)}`)
    .join(', ')}`

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / width || 1
    const paddingLeftPx = padding.left * scaleX
    const paddingRightPx = padding.right * scaleX
    const clampedX = Math.max(paddingLeftPx, Math.min(bounds.width - paddingRightPx, relativeX))
    const normalized = (clampedX - paddingLeftPx) / Math.max(1, bounds.width - paddingLeftPx - paddingRightPx)
    const maxIndex = Math.max(0, values.length - 1)
    const index = Math.round(normalized * maxIndex)
    const point = points[index]
    if (!point) return

    const scaleY = bounds.height / height || 1
    const px = point.x * scaleX
    const py = point.y * scaleY
    onHover({ index, x: px, y: py })
  }

  const handlePointerLeave = () => {
    onLeave()
  }

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const nextIndex = (() => {
      if (activeIndex == null) {
        return event.key === 'ArrowLeft' ? values.length - 1 : 0
      }
      if (event.key === 'ArrowLeft') {
        return Math.max(0, activeIndex - 1)
      }
      return Math.min(values.length - 1, activeIndex + 1)
    })()
    const point = points[nextIndex]
    if (!point) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const scaleX = bounds.width / width || 1
    const scaleY = bounds.height / height || 1
    onHover({
      index: nextIndex,
      x: point.x * scaleX,
      y: point.y * scaleY,
    })
  }

  const onHover = (value: TrendHover) => setHover(value)
  const onLeave = () => setHover(null)

  return (
    <article className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${palette.badge} ${palette.badgeDark}`}
        >
          {title}
        </span>
        <span className="text-sm text-slate-700 dark:text-slate-200/80">{description}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div ref={chartRef} className="relative aspect-[7/3] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 backdrop-blur-sm">
          <TrendChartSvg
            width={width}
            height={height}
            padding={padding}
            color={color}
            gradientId={gradientId}
            points={points}
            zeroLineY={zeroLineY}
            latestPoint={latestPoint}
            activePoint={activePoint}
            activeIndex={activeIndex}
            labels={labels}
            values={values}
            format={format}
            yAxisTicks={yAxisTicks}
            xAxisTickIndices={xAxisTickIndices}
            domainMin={domainMin}
            domainMax={domainMax}
            ariaLabel={ariaLabel}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
          />
        </div>
        <aside className="space-y-4 rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/85 p-4 text-sm backdrop-blur-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Latest cadence</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {labels.at(-1) ?? '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Current value</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {formatSimpleValue(snappedValues.at(-1) ?? NaN, format)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Change vs. prior</p>
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              {change == null ? '—' : formatChangeValue(change, format)}
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-200/80">
              {changePercent == null ? '—' : formatPercentValue(changePercent)}
            </p>
          </div>
          {helper ? <p className="text-xs text-slate-700 dark:text-slate-200/80">{helper}</p> : null}
        </aside>
      </div>
    </article>
  )
}

function TrendChartSvg({
  width,
  height,
  padding,
  color,
  gradientId,
  points,
  zeroLineY,
  latestPoint,
  activePoint,
  activeIndex,
  labels,
  values,
  format,
  yAxisTicks,
  xAxisTickIndices,
  domainMin,
  domainMax,
  ariaLabel,
  onPointerMove,
  onPointerLeave,
  onKeyDown,
}: {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  color: string
  gradientId: string
  points: Array<{ x: number; y: number }>
  zeroLineY: number | null
  latestPoint: { x: number; y: number } | undefined
  activePoint: { x: number; y: number } | null
  activeIndex: number | null
  labels: string[]
  values: number[]
  format: TrendFormat
  yAxisTicks: number[]
  xAxisTickIndices: number[]
  domainMin: number
  domainMax: number
  ariaLabel: string
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void
}) {
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const range = domainMax - domainMin || 1

  // Helper to convert a value to Y coordinate
  const valueToY = (value: number) => {
    const normalized = range === 0 ? 0.5 : (value - domainMin) / range
    return padding.top + innerHeight - normalized * innerHeight
  }

  // Format axis label based on format type
  const formatAxisLabel = (value: number) => {
    if (format === 'currency') {
      if (Math.abs(value) >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`
      }
      if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`
      }
      return `$${value.toFixed(0)}`
    }
    if (format === 'percent') {
      return `${(value * 100).toFixed(0)}%`
    }
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`
    }
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className="financial-trend-svg h-full w-full"
      tabIndex={0}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <linearGradient id={gradientId} gradientTransform="rotate(90)">
        <stop offset="0%" stopColor={color} stopOpacity={0.4} />
        <stop offset="100%" stopColor={color} stopOpacity={0.05} />
      </linearGradient>

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

      {/* Area fill */}
      <path
        d={`M${padding.left} ${height - padding.bottom} ${points
          .map((point) => `L${point.x} ${point.y}`)
          .join(' ')} L${width - padding.right} ${height - padding.bottom} Z`}
        fill={`url(#${gradientId})`}
        opacity={0.85}
      />

      {/* Line */}
      <path
        d={`M${points[0]?.x ?? padding.left} ${points[0]?.y ?? height - padding.bottom} ${points
          .slice(1)
          .map((point) => `L${point.x} ${point.y}`)
          .join(' ')}`}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Zero line if needed */}
      {zeroLineY != null ? (
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroLineY}
          y2={zeroLineY}
          stroke="rgba(100, 116, 139, 0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      ) : null}

      {/* Data points */}
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === activeIndex ? 6 : 4}
          fill={color}
          opacity={index === activeIndex ? 1 : 0.7}
        />
      ))}

      {/* Active point indicator */}
      {activePoint ? (
        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      ) : null}

      {/* Latest point highlight */}
      {latestPoint ? (
        <circle cx={latestPoint.x} cy={latestPoint.y} r={5} fill={color} opacity={activeIndex == null ? 1 : 0.7} />
      ) : null}

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
          const point = points[tickIndex]
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

function formatChangeValue(value: number, format: TrendFormat) {
  const formatted = formatSimpleValue(value, format)
  if (value > 0 && !formatted.startsWith('+')) {
    return `+${formatted}`
  }
  return formatted
}

function formatPercentValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
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
