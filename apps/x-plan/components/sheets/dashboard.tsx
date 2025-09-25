"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'

import type {
  CashFlowSummaryRow,
  FinancialSummaryRow,
  PipelineBucket,
} from '@/lib/calculations'

interface DashboardInventoryRow {
  productName: string
  stockEnd: number
  stockWeeks: number
}

interface DashboardData {
  overview: {
    revenueYTD: number
    netProfitYTD: number
    cashBalance: number
    netMargin: number
  }
  pipeline: PipelineBucket[]
  inventory: DashboardInventoryRow[]
  rollups: {
    profitAndLoss: {
      monthly: FinancialSummaryRow[]
      quarterly: FinancialSummaryRow[]
    }
    cashFlow: {
      monthly: CashFlowSummaryRow[]
      quarterly: CashFlowSummaryRow[]
    }
  }
}

type MetricDefinition = {
  label: string
  helper: string
  value: number
  format: 'currency' | 'percent'
  tone?: 'neutral' | 'positive' | 'negative'
}

type TrendGranularity = 'monthly' | 'quarterly'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const unitFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const weeksFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function DashboardSheet({ data }: { data: DashboardData }) {
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly')
  const metrics: MetricDefinition[] = [
    {
      label: 'Revenue YTD',
      helper: 'Gross sales captured across all SKUs',
      value: data.overview.revenueYTD,
      format: 'currency',
    },
    {
      label: 'Net Profit YTD',
      helper: 'After COGS, platform fees, ad spend, and fixed costs',
      value: data.overview.netProfitYTD,
      format: 'currency',
      tone: data.overview.netProfitYTD >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Cash Balance',
      helper: 'Projected ending cash from the cash flow model',
      value: data.overview.cashBalance,
      format: 'currency',
    },
    {
      label: 'Net Margin',
      helper: 'Net profit divided by revenue',
      value: data.overview.netMargin,
      format: 'percent',
      tone: data.overview.netMargin >= 0 ? 'positive' : 'negative',
    },
  ]

  const pipelineBuckets = [...data.pipeline].sort((a, b) => b.quantity - a.quantity)
  const pipelineTotal = pipelineBuckets.reduce((sum, bucket) => sum + bucket.quantity, 0)

  const inventoryRows = [...data.inventory]
    .sort((a, b) => b.stockEnd - a.stockEnd)
    .slice(0, 6)

  const pnlMonthly = limitRows(data.rollups.profitAndLoss.monthly, 12)
  const pnlQuarterly = limitRows(data.rollups.profitAndLoss.quarterly, 8)
  const cashMonthly = limitRows(data.rollups.cashFlow.monthly, 12)
  const cashQuarterly = limitRows(data.rollups.cashFlow.quarterly, 8)

  const revenueTrend = useMemo(
    () => ({
      monthly: buildTrendSeries(pnlMonthly, 'revenue'),
      quarterly: buildTrendSeries(pnlQuarterly, 'revenue'),
    }),
    [pnlMonthly, pnlQuarterly]
  )
  const netProfitTrend = useMemo(
    () => ({
      monthly: buildTrendSeries(pnlMonthly, 'netProfit'),
      quarterly: buildTrendSeries(pnlQuarterly, 'netProfit'),
    }),
    [pnlMonthly, pnlQuarterly]
  )
  const cashBalanceTrend = useMemo(
    () => ({
      monthly: buildTrendSeries(cashMonthly, 'closingCash'),
      quarterly: buildTrendSeries(cashQuarterly, 'closingCash'),
    }),
    [cashMonthly, cashQuarterly]
  )
  const granularityAvailability = useMemo(
    () => ({
      monthly:
        pnlMonthly.some((row) => Number.isFinite(row.revenue)) ||
        pnlMonthly.some((row) => Number.isFinite(row.netProfit)) ||
        cashMonthly.some((row) => Number.isFinite(row.closingCash)),
      quarterly:
        pnlQuarterly.some((row) => Number.isFinite(row.revenue)) ||
        pnlQuarterly.some((row) => Number.isFinite(row.netProfit)) ||
        cashQuarterly.some((row) => Number.isFinite(row.closingCash)),
    }),
    [pnlMonthly, pnlQuarterly, cashMonthly, cashQuarterly]
  )

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

  return (
    <div className="space-y-10">
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Workbook overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor headline performance and keep planning tabs focused on data entry. Monthly and quarterly rollups now live
            here for quick reviews.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-5">
        <PipelineCard pipeline={pipelineBuckets} total={pipelineTotal} />
        <InventoryCard rows={inventoryRows} />
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-4 lg:flex lg:items-end lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Performance graphs</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Visualize headline trends</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track revenue, profitability, and cash balance at a glance. These visuals update with the same data that powers the planning grids.
            </p>
          </div>
          <GranularityToggle
            value={granularity}
            onChange={setGranularity}
            availability={granularityAvailability}
          />
        </header>
        <div className="space-y-6">
          <TrendCard
            title="Revenue"
            description="Monthly booked revenue"
            series={revenueTrend}
            granularity={granularity}
            format="currency"
            accent="sky"
          />
          <TrendCard
            title="Net Profit"
            description="Profit after COGS and OpEx"
            series={netProfitTrend}
            granularity={granularity}
            format="currency"
            accent="emerald"
          />
          <TrendCard
            title="Cash Balance"
            description="Ending cash from the cash flow model"
            series={cashBalanceTrend}
            granularity={granularity}
            format="currency"
            accent="violet"
          />
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, helper, value, format, tone = 'neutral' }: MetricDefinition) {
  const formatted = format === 'currency' ? formatCurrency(value) : formatPercentValue(value)
  const accentClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-slate-50'

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClass}`}>{formatted}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
    </article>
  )
}

function PipelineCard({ pipeline, total }: { pipeline: PipelineBucket[]; total: number }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pipeline by status</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status mix across all open purchase orders</p>

      <div className="mt-4 space-y-3">
        {pipeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No purchase orders in the model yet.
          </div>
        ) : (
          pipeline.map((bucket) => {
            const share = total > 0 ? Math.round((bucket.quantity / total) * 100) : 0
            return (
              <div key={bucket.status}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{formatStatus(bucket.status)}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {bucket.quantity.toLocaleString()} ({share}%)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-sky-500 dark:bg-sky-400"
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}

function InventoryCard({ rows }: { rows: DashboardInventoryRow[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory snapshot</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Highest on-hand SKUs with weeks of cover</p>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">Showing top {rows.length} products</span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No inventory rows available yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase dark:bg-slate-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-400">Product</th>
                <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Units</th>
                <th className="px-3 py-2 text-right font-semibold tracking-wide text-slate-500 dark:text-slate-400">Weeks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((item) => (
                <tr key={item.productName} className="text-slate-700 dark:text-slate-200">
                  <td className="px-3 py-2 font-medium">{item.productName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUnits(item.stockEnd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatWeeks(item.stockWeeks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return '—'
  const formatter = Math.abs(value) < 1000 ? preciseCurrencyFormatter : currencyFormatter
  return formatter.format(value)
}

function formatPercentValue(value: number) {
  if (!Number.isFinite(value)) return '—'
  const normalized = Math.abs(value) > 1 ? value / 100 : value
  return `${(normalized * 100).toFixed(1)}%`
}

function formatUnits(value: number) {
  if (!Number.isFinite(value)) return '—'
  return unitFormatter.format(value)
}

function formatWeeks(value: number) {
  if (!Number.isFinite(value)) return '—'
  return weeksFormatter.format(value)
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function limitRows<T>(rows: T[], limit: number) {
  if (rows.length <= limit) return rows
  return rows.slice(-limit)
}

type TrendSeries = Record<TrendGranularity, { labels: string[]; values: number[] }>

type TrendCardProps = {
  title: string
  description: string
  series: TrendSeries
  granularity: TrendGranularity
  format: 'currency' | 'number' | 'percent'
  accent: 'sky' | 'emerald' | 'violet'
}

const granularityOptions: { value: TrendGranularity; label: string; helper: string }[] = [
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
    <div className="flex flex-col items-end gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium uppercase tracking-wide">Rollup cadence</span>
      <div
        role="group"
        aria-label="Select performance granularity"
        className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/60"
      >
        {granularityOptions.map((option) => {
          const isActive = option.value === value
          const isAvailable = availability[option.value]
          return (
            <button
              key={option.value}
              type="button"
              className={`relative rounded-full px-4 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              } ${!isAvailable ? 'cursor-not-allowed opacity-50 hover:text-slate-500 dark:hover:text-slate-400' : ''}`}
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

const accentPalette: Record<TrendCardProps['accent'], { hex: string; badge: string; badgeDark: string }> = {
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

function TrendCard({ title, description, series, granularity, format, accent }: TrendCardProps) {
  const palette = accentPalette[accent]
  const [hover, setHover] = useState<TrendHover>(null)
  const { labels, values } = series[granularity]

  useEffect(() => {
    setHover(null)
  }, [granularity, series])

  const { activeIndex, change, changePercent } = useMemo(() => {
    if (!values.length) return { activeIndex: null, change: null, changePercent: null }

    const index = hover?.index ?? values.length - 1
    const previousIndex = index > 0 ? index - 1 : null
    const previousValue = previousIndex != null ? values[previousIndex] ?? null : null
    const activeValue = values[index] ?? null

    if (activeValue == null || previousValue == null) {
      return { activeIndex: index, change: null, changePercent: null }
    }

    const delta = activeValue - previousValue
    const deltaPercent = previousValue !== 0 ? delta / Math.abs(previousValue) : null

    return { activeIndex: index, change: delta, changePercent: deltaPercent }
  }, [hover, values])

  const activeValue = activeIndex != null ? values[activeIndex] ?? null : null
  const activeLabel = activeIndex != null ? labels[activeIndex] ?? null : null
  const changeDisplay = change != null ? formatChangeValue(change, format) : null
  const percentDisplay =
    changePercent != null
      ? `${changePercent >= 0 ? '+' : '−'}${formatPercentValue(Math.abs(changePercent))}`
      : null

  const latestLabel = labels.at(-1)

  return (
    <article className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {granularity === 'quarterly' ? 'Quarterly rollup' : 'Monthly rollup'}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {activeLabel ?? latestLabel ?? '—'}
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900 dark:text-slate-50">
              {activeValue != null ? formatSimpleValue(activeValue, format) : '—'}
            </p>
          </div>
        </div>

        {changeDisplay ? (
          <span
            className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${palette.badge} ${palette.badgeDark}`}
          >
            {changeDisplay}
            {percentDisplay ? <span className="ml-1 text-[11px] opacity-80">({percentDisplay})</span> : null}
          </span>
        ) : (
          <span className="mt-4 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            Waiting for more data
          </span>
        )}
      </div>

      <div className="relative mt-8 h-48">
        {values.length >= 2 ? (
          <>
            <Sparkline
              values={values}
              labels={labels}
              color={palette.hex}
              format={format}
              title={title}
              activeIndex={activeIndex}
              onHover={setHover}
              onLeave={() => setHover(null)}
            />
            {hover && activeValue != null ? (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                style={{ left: hover.x, top: hover.y }}
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {labels[hover.index] ?? '—'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {formatSimpleValue(values[hover.index] ?? 0, format)}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            Add at least two periods to view this trend.
          </div>
        )}
      </div>

      <dl className="mt-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          <dt className="font-medium text-slate-600 dark:text-slate-300">First period</dt>
          <dd className="mt-1">{labels[0] ?? '—'}</dd>
        </div>
        <div className="text-right">
          <dt className="font-medium text-slate-600 dark:text-slate-300">Latest period</dt>
          <dd className="mt-1">{latestLabel ?? '—'}</dd>
        </div>
      </dl>
    </article>
  )
}

type SparklineProps = {
  values: number[]
  labels: string[]
  color: string
  title: string
  format: TrendCardProps['format']
  activeIndex: number | null
  onHover: (hover: TrendHover) => void
  onLeave: () => void
}

function Sparkline({ values, labels, color, title, format, activeIndex, onHover, onLeave }: SparklineProps) {
  const gradientId = useId()
  const height = 220
  const width = 360
  const padding = 18
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerHeight = height - padding * 2
  const innerWidth = width - padding * 2
  const points = useMemo(
    () =>
      values.map((value, index) => {
        const x = padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
        const normalized = range === 0 ? 0.5 : (value - min) / range
        const y = padding + innerHeight - normalized * innerHeight
        return { x, y }
      }),
    [values, padding, innerHeight, innerWidth, range, min]
  )
  const latestPoint = points.at(-1)
  const activePoint = activeIndex != null ? points[activeIndex] ?? null : null
  const ariaLabel = `${title} trend: ${values
    .map((value, index) => `${labels[index] ?? `Point ${index + 1}`}: ${formatSimpleValue(value, format)}`)
    .join(', ')}`

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = event.clientX - bounds.left
    const clampedX = Math.max(padding, Math.min(bounds.width - padding, relativeX))
    const normalized = (clampedX - padding) / Math.max(1, bounds.width - padding * 2)
    const maxIndex = Math.max(0, values.length - 1)
    const index = Math.round(normalized * maxIndex)
    const point = points[index]
    if (!point) return

    const px = (point.x / width) * bounds.width
    const py = (point.y / height) * bounds.height
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
    onHover({
      index: nextIndex,
      x: (point.x / width) * (bounds.width || width),
      y: (point.y / height) * (bounds.height || height),
    })
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <title>{title} trend</title>
      <linearGradient id={gradientId} gradientTransform="rotate(90)">
        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
      <path
        d={`M${padding} ${height - padding} ${points
          .map((point) => `L${point.x} ${point.y}`)
          .join(' ')} L${width - padding} ${height - padding} Z`}
        fill={`url(#${gradientId})`}
        opacity={0.6}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
      />
      {values.map((_, index) => {
        const point = points[index]
        if (!point) return null
        const isActive = index === activeIndex
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={isActive ? 5 : 3}
            fill={color}
            opacity={isActive ? 1 : 0.4}
          />
        )
      })}
      {activePoint ? (
        <line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={padding}
          y2={height - padding}
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
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="rgba(148, 163, 184, 0.25)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
    </svg>
  )
}

function buildTrendSeries<T extends { periodLabel: string }>(rows: T[], key: Extract<keyof T, string>) {
  const labels: string[] = []
  const values: number[] = []

  for (const row of rows) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      labels.push(row.periodLabel)
      values.push(value)
    }
  }

  return { labels, values }
}

function formatSimpleValue(value: number, format: TrendCardProps['format']) {
  if (format === 'currency') return formatCurrency(value)
  if (format === 'percent') return formatPercentValue(value)
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function formatChangeValue(value: number, format: TrendCardProps['format']) {
  const formatted = formatSimpleValue(value, format)
  if (value > 0 && !formatted.startsWith('+')) {
    return `+${formatted}`
  }
  return formatted
}
