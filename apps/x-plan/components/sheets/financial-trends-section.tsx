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
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SEGMENTED,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar'

export type TrendGranularity = 'monthly' | 'quarterly'
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
}

export function FinancialTrendsSection({ title, description, metrics, defaultMetricKey }: FinancialTrendsSectionProps) {
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly')
  const [activeMetric, setActiveMetric] = useState<string>(defaultMetricKey ?? metrics[0]?.key ?? '')

  const granularityAvailability = useMemo(() => {
    return metrics.reduce(
      (availability, metric) => {
        if (metric.series.monthly.values.some((value) => Number.isFinite(value))) {
          availability.monthly = true
        }
        if (metric.series.quarterly.values.some((value) => Number.isFinite(value))) {
          availability.quarterly = true
        }
        return availability
      },
      { monthly: false, quarterly: false }
    )
  }, [metrics])

  useEffect(() => {
    if (!granularityAvailability[granularity]) {
      const fallback: TrendGranularity | null = granularityAvailability.monthly
        ? 'monthly'
        : granularityAvailability.quarterly
          ? 'quarterly'
          : null
      if (fallback && granularity !== fallback) {
        setGranularity(fallback)
      }
    }
  }, [granularity, granularityAvailability])

  useEffect(() => {
    if (!metrics.length) return
    const target = metrics.find((metric) => metric.key === activeMetric)
    if (!target) {
      setActiveMetric(metrics[0]?.key ?? '')
    }
  }, [metrics, activeMetric])

  const resolvedMetric = useMemo(() => {
    return metrics.find((metric) => metric.key === activeMetric) ?? metrics[0] ?? null
  }, [activeMetric, metrics])

  if (!metrics.length || !resolvedMetric) {
    return (
      <section className="rounded-3xl border border-[#0b3a52] bg-[#041324] p-6 text-sm text-slate-400 shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
        <header className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">{title}</p>
          <h2 className="text-xl font-semibold text-white">{description}</h2>
        </header>
        <p className="mt-4">No data available yet.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6 rounded-3xl border border-[#0b3a52] bg-[#041324] p-6 shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
      <header className="space-y-4 lg:flex lg:items-end lg:justify-between lg:space-y-0">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">{title}</p>
          <h2 className="text-xl font-semibold text-white">{description}</h2>
          {resolvedMetric.helper ? (
            <p className="text-sm text-slate-200/80">{resolvedMetric.helper}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <MetricSelect options={metrics} value={resolvedMetric.key} onChange={setActiveMetric} />
          <GranularityToggle value={granularity} onChange={setGranularity} availability={granularityAvailability} />
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
              className={`${SHEET_TOOLBAR_BUTTON} rounded-none first:rounded-l-full last:rounded-r-full ${
                isActive
                  ? 'border-[#00c2b9] bg-[#00c2b9]/15 text-cyan-100 shadow-[0_12px_24px_rgba(0,194,185,0.15)]'
                  : 'text-slate-200 hover:text-cyan-100'
              } ${!isAvailable ? 'cursor-not-allowed opacity-50 hover:text-slate-400' : ''}`}
              onClick={() => isAvailable && onChange(option.value)}
              aria-pressed={isActive}
              aria-disabled={!isAvailable}
              title={!isAvailable ? 'No data available for this cadence yet' : option.helper}
            >
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
    hex: '#0ea5e9',
    badge: 'bg-sky-100 text-sky-700',
    badgeDark: 'dark:bg-sky-500/10 dark:text-sky-300',
  },
  emerald: {
    hex: '#10b981',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeDark: 'dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  violet: {
    hex: '#8b5cf6',
    badge: 'bg-violet-100 text-violet-700',
    badgeDark: 'dark:bg-violet-500/10 dark:text-violet-300',
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
  const height = 320
  const paddingX = 32
  const paddingY = 24
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2
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
      ? paddingY + innerHeight - ((0 - domainMin) / range) * innerHeight
      : null
  const points = useMemo(
    () =>
      values.map((value, index) => {
        const x = paddingX + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
        const normalized = range === 0 ? 0.5 : (value - domainMin) / range
        const y = paddingY + innerHeight - normalized * innerHeight
        return { x, y }
      }),
    [values, paddingX, paddingY, innerHeight, innerWidth, range, domainMin]
  )
  const latestPoint = points.at(-1)
  const activePoint = activeIndex != null ? points[activeIndex] ?? null : null
  const ariaLabel = `${title} trend: ${values
    .map((value, index) => `${labels[index] ?? `Point ${index + 1}`}: ${formatSimpleValue(value, format)}`)
    .join(', ')}`

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const scaleX = bounds.width / width || 1
    const paddingXPx = paddingX * scaleX
    const clampedX = Math.max(paddingXPx, Math.min(bounds.width - paddingXPx, relativeX))
    const normalized = (clampedX - paddingXPx) / Math.max(1, bounds.width - paddingXPx * 2)
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
        <span className="text-sm text-slate-200/80">{description}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div ref={chartRef} className="relative h-80 w-full overflow-hidden rounded-3xl border border-[#0b3a52] bg-[#06182b]/85 backdrop-blur-sm">
          <TrendChartSvg
            width={width}
            height={height}
            paddingX={paddingX}
            paddingY={paddingY}
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
            ariaLabel={ariaLabel}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
          />
        </div>
        <aside className="space-y-4 rounded-3xl border border-[#0b3a52] bg-[#06182b]/85 p-4 text-sm text-slate-200/80 backdrop-blur-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">Latest cadence</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {labels.at(-1) ?? '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">Current value</p>
            <p className="text-2xl font-semibold text-white">
              {formatSimpleValue(snappedValues.at(-1) ?? NaN, format)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">Change vs. prior</p>
            <p className="text-lg font-medium text-white">
              {change == null ? '—' : formatChangeValue(change, format)}
            </p>
            <p className="text-xs text-slate-200/80">
              {changePercent == null ? '—' : formatPercentValue(changePercent)}
            </p>
          </div>
          {helper ? <p className="text-xs text-slate-200/80">{helper}</p> : null}
        </aside>
      </div>
    </article>
  )
}

function TrendChartSvg({
  width,
  height,
  paddingX,
  paddingY,
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
  ariaLabel,
  onPointerMove,
  onPointerLeave,
  onKeyDown,
}: {
  width: number
  height: number
  paddingX: number
  paddingY: number
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
  ariaLabel: string
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full"
      tabIndex={0}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <linearGradient id={gradientId} gradientTransform="rotate(90)">
        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
      <path
        d={`M${paddingX} ${height - paddingY} ${points
          .map((point) => `L${point.x} ${point.y}`)
          .join(' ')} L${width - paddingX} ${height - paddingY} Z`}
        fill={`url(#${gradientId})`}
        opacity={0.6}
      />
      {zeroLineY != null ? (
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={zeroLineY}
          y2={zeroLineY}
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === activeIndex ? 5 : 3}
          fill={color}
          opacity={index === activeIndex ? 1 : 0.4}
        />
      ))}
      {activePoint ? (
        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={paddingY}
          y2={height - paddingY}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.45}
        />
      ) : null}
      {latestPoint ? (
        <circle cx={latestPoint.x} cy={latestPoint.y} r={4.5} fill={color} opacity={activeIndex == null ? 1 : 0.4} />
      ) : null}
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={height - paddingY}
        y2={height - paddingY}
        stroke="rgba(148, 163, 184, 0.25)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
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
