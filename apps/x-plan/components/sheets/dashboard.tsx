'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { clsx } from 'clsx'

import type { CashFlowSummaryRow, FinancialSummaryRow } from '@/lib/calculations'

interface DashboardInventoryRow {
  productName: string
  stockEnd: number
  stockWeeks: number
}

type TimelineStageKey = 'production' | 'sourcePrep' | 'oceanTransit' | 'finalMile'

interface DashboardTimelineSegment {
  key: TimelineStageKey
  label: string
  start: string | null
  end: string | null
}

interface DashboardTimelineOrder {
  id: string
  orderCode: string
  productName: string
  quantity: number
  status: string
  availableDate: string | null
  segments: DashboardTimelineSegment[]
}

interface DashboardData {
  orders: DashboardTimelineOrder[]
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

const stagePalette: Record<TimelineStageKey, { label: string; barClass: string; dotClass: string }> = {
  production: {
    label: 'Production',
    barClass: 'bg-sky-500 hover:bg-sky-400 focus-visible:outline-sky-500',
    dotClass: 'bg-sky-500',
  },
  sourcePrep: {
    label: 'Source Prep',
    barClass: 'bg-amber-500 hover:bg-amber-400 focus-visible:outline-amber-500',
    dotClass: 'bg-amber-500',
  },
  oceanTransit: {
    label: 'Ocean Transit',
    barClass: 'bg-indigo-500 hover:bg-indigo-400 focus-visible:outline-indigo-500',
    dotClass: 'bg-indigo-500',
  },
  finalMile: {
    label: 'Final Mile',
    barClass: 'bg-emerald-500 hover:bg-emerald-400 focus-visible:outline-emerald-500',
    dotClass: 'bg-emerald-500',
  },
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
const ZERO_EPSILON = 0.0001

function snapNearZero(value: number) {
  return Math.abs(value) < ZERO_EPSILON ? 0 : value
}

type TrendMetricKey = 'revenue' | 'netProfit' | 'cashBalance'

type TrendMetricOption = {
  key: TrendMetricKey
  title: string
  description: string
  helper: string
  series: TrendSeries
  format: 'currency' | 'number' | 'percent'
  accent: TrendCardProps['accent']
}

export function DashboardSheet({ data }: { data: DashboardData }) {
  const [granularity, setGranularity] = useState<TrendGranularity>('monthly')

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

  const metricOptions = useMemo<TrendMetricOption[]>(
    () => [
      {
        key: 'revenue',
        title: 'Revenue',
        description: 'Monthly booked revenue',
        helper: 'Gross sales captured across all SKUs',
        series: revenueTrend,
        format: 'currency',
        accent: 'sky',
      },
      {
        key: 'netProfit',
        title: 'Net Profit',
        description: 'Profit after COGS and OpEx',
        helper: 'Includes platform fees, ad spend, and fixed costs',
        series: netProfitTrend,
        format: 'currency',
        accent: 'emerald',
      },
      {
        key: 'cashBalance',
        title: 'Cash Balance',
        description: 'Ending cash from the cash flow model',
        helper: 'Projected liquidity after inflows and outflows',
        series: cashBalanceTrend,
        format: 'currency',
        accent: 'violet',
      },
    ],
    [revenueTrend, netProfitTrend, cashBalanceTrend]
  )

  const availableMetricOptions = useMemo(() => {
    const populated = metricOptions.filter((option) => {
      const monthlyHasData = option.series.monthly.values.some((value) => Number.isFinite(value))
      const quarterlyHasData = option.series.quarterly.values.some((value) => Number.isFinite(value))
      return monthlyHasData || quarterlyHasData
    })
    return populated.length > 0 ? populated : metricOptions
  }, [metricOptions])

  const [activeMetric, setActiveMetric] = useState<TrendMetricKey>('revenue')

  useEffect(() => {
    if (!availableMetricOptions.some((option) => option.key === activeMetric)) {
      setActiveMetric(availableMetricOptions[0]?.key ?? 'revenue')
    }
  }, [activeMetric, availableMetricOptions])

  const selectedMetric = availableMetricOptions.find((option) => option.key === activeMetric) ??
    availableMetricOptions[0] ??
    metricOptions[0]

  return (
    <div className="space-y-10">
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Workbook overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor operations and keep planning tabs focused on data entry. Use the purchase order timeline to understand where
            work is concentrated, then review inventory health and headline trends below.
          </p>
        </header>
      </section>

      <PurchaseTimeline orders={data.orders} />

      <InventoryCard rows={inventoryRows} />

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-4 lg:flex lg:items-end lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Performance graphs</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Visualize headline trends</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Explore revenue, profitability, and cash balance using the same data that powers the planning grids. Switch the metric or cadence to zero in on the signal you need.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <MetricSelect
              options={availableMetricOptions}
              value={selectedMetric?.key ?? activeMetric}
              onChange={setActiveMetric}
            />
            <GranularityToggle
              value={granularity}
              onChange={setGranularity}
              availability={granularityAvailability}
            />
          </div>
        </header>
        <TrendCard
          key={selectedMetric?.key ?? 'metric'}
          title={selectedMetric?.title ?? 'Revenue'}
          description={selectedMetric?.description ?? 'Monthly booked revenue'}
          helper={selectedMetric?.helper}
          series={selectedMetric?.series ?? revenueTrend}
          granularity={granularity}
          format={selectedMetric?.format ?? 'currency'}
          accent={selectedMetric?.accent ?? 'sky'}
        />
      </section>
    </div>
  )
}

function PurchaseTimeline({ orders }: { orders: DashboardTimelineOrder[] }) {
  type ActiveSegmentState = {
    orderId: string
    orderCode: string
    productName: string
    segmentKey: TimelineStageKey
    segmentLabel: string
    start: Date
    end: Date
    durationDays: number
  }

  type TimelineComputedSegment = DashboardTimelineSegment & { startDate: Date; endDate: Date }
  type TimelineComputedOrder = {
    id: string
    orderCode: string
    productName: string
    quantity: number
    status: string
    availableDate: Date | null
    segments: TimelineComputedSegment[]
    orderStart: Date | null
    orderEnd: Date | null
  }

  const timelineOrders = useMemo<TimelineComputedOrder[]>(() => {
    return orders
      .map((order) => {
        const segments = order.segments
          .map((segment) => {
            if (!segment.start || !segment.end) return null
            const startDate = new Date(segment.start)
            const endDate = new Date(segment.end)
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate.getTime() > endDate.getTime()) {
              return null
            }
            return { ...segment, startDate, endDate }
          })
          .filter((segment): segment is TimelineComputedSegment => Boolean(segment))
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

        const orderStart = segments[0]?.startDate ?? null
        const orderEnd = segments[segments.length - 1]?.endDate ?? null
        const availableDate = order.availableDate ? new Date(order.availableDate) : null

        return {
          id: order.id,
          orderCode: order.orderCode,
          productName: order.productName,
          quantity: order.quantity,
          status: order.status,
          availableDate: availableDate && !Number.isNaN(availableDate.getTime()) ? availableDate : null,
          segments,
          orderStart,
          orderEnd,
        }
      })
      .sort((a, b) => {
        const aTime = a.orderStart?.getTime() ?? Number.POSITIVE_INFINITY
        const bTime = b.orderStart?.getTime() ?? Number.POSITIVE_INFINITY
        if (aTime === bTime) return a.orderCode.localeCompare(b.orderCode)
        return aTime - bTime
      })
  }, [orders])

  const timelineBounds = useMemo(() => {
    const starts = timelineOrders.map((order) => order.orderStart?.getTime()).filter((value): value is number => typeof value === 'number')
    const ends = timelineOrders.map((order) => order.orderEnd?.getTime()).filter((value): value is number => typeof value === 'number')
    if (starts.length === 0 || ends.length === 0) return null
    return {
      start: new Date(Math.min(...starts)),
      end: new Date(Math.max(...ends)),
    }
  }, [timelineOrders])

  const rangeMs = timelineBounds ? Math.max(1, timelineBounds.end.getTime() - timelineBounds.start.getTime()) : 1
  const [activeSegment, setActiveSegment] = useState<ActiveSegmentState | null>(null)

  const showSegmentDetails = (order: TimelineComputedOrder, segment: TimelineComputedSegment) => {
    const durationDays = Math.max(1, differenceInCalendarDays(segment.endDate, segment.startDate) + 1)
    setActiveSegment({
      orderId: order.id,
      orderCode: order.orderCode,
      productName: order.productName,
      segmentKey: segment.key,
      segmentLabel: segment.label,
      start: segment.startDate,
      end: segment.endDate,
      durationDays,
    })
  }

  const clearSegmentDetails = () => {
    setActiveSegment(null)
  }

  const computePosition = (start: Date, end: Date) => {
    if (!timelineBounds) {
      return { left: 0, width: 100 }
    }
    const clampedStart = Math.max(start.getTime(), timelineBounds.start.getTime())
    const clampedEnd = Math.max(clampedStart, Math.min(end.getTime(), timelineBounds.end.getTime()))
    const left = ((clampedStart - timelineBounds.start.getTime()) / rangeMs) * 100
    let width = ((clampedEnd - clampedStart) / rangeMs) * 100
    const minWidth = 3
    if (width < minWidth) {
      width = minWidth
    }
    const adjustedLeft = Math.min(left, 100 - width)
    return { left: adjustedLeft, width }
  }

  const renderFallback = () => (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchase orders</p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Timeline</h2>
        <p>
          No purchase order stage dates are available yet. Once production or transit milestones are entered, the timeline will
          visualize each order’s progress.
        </p>
      </header>
      {orders.length > 0 ? (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
            >
              <span>{order.productName} · {order.orderCode}</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                {formatStatus(order.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )

  if (!timelineBounds || timelineOrders.length === 0) {
    return renderFallback()
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Purchase orders</p>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Production & logistics timeline</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Hover or focus a stage to see precise dates. The legend shows the colour assigned to each milestone across production,
          prep, ocean transit, and final-mile delivery.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap gap-3">
          {Object.entries(stagePalette).map(([key, palette]) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium dark:bg-slate-800/60">
              <span className={clsx('h-2.5 w-2.5 rounded-full', palette.dotClass)} />
              {palette.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span>{format(timelineBounds.start, 'MMM d, yyyy')}</span>
          <span aria-hidden="true">→</span>
          <span>{format(timelineBounds.end, 'MMM d, yyyy')}</span>
        </div>
      </div>

      <ul className="space-y-4">
        {timelineOrders.map((order) => (
          <li
            key={order.id}
            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
              <div className="lg:min-w-[14rem] lg:max-w-[16rem]">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{order.productName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {order.orderCode} · {order.quantity.toLocaleString('en-US')} units
                </p>
                <span className="mt-3 inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {formatStatus(order.status)}
                </span>
              </div>
              <div className="flex-1">
                <div className="relative h-12">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-800" />
                  {order.segments.map((segment) => {
                    const palette = stagePalette[segment.key] ?? stagePalette.production
                    const { left, width } = computePosition(segment.startDate, segment.endDate)
                    const ariaLabel = `${segment.label} for ${order.orderCode} from ${format(segment.startDate, 'MMM d, yyyy')} to ${format(segment.endDate, 'MMM d, yyyy')}`
                    return (
                      <button
                        key={`${order.id}-${segment.key}-${segment.start}`}
                        type="button"
                        className={clsx(
                          'absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full px-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                          palette.barClass
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        aria-label={ariaLabel}
                        title={ariaLabel}
                        onMouseEnter={() => showSegmentDetails(order, segment)}
                        onFocus={() => showSegmentDetails(order, segment)}
                        onMouseLeave={clearSegmentDetails}
                        onBlur={clearSegmentDetails}
                      >
                        <span className="pointer-events-none truncate">{segment.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span>{order.orderStart ? format(order.orderStart, 'MMM d, yyyy') : '—'}</span>
                  <span>{order.orderEnd ? format(order.orderEnd, 'MMM d, yyyy') : '—'}</span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400 lg:w-36">
                {order.availableDate ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    ETA {format(order.availableDate, 'MMM d')}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    ETA pending
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 shadow-inner dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
        {activeSegment ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeSegment.segmentLabel}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeSegment.orderCode} · {activeSegment.productName}
              </p>
            </div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {format(activeSegment.start, 'MMM d, yyyy')} – {format(activeSegment.end, 'MMM d, yyyy')}
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                {activeSegment.durationDays} day{activeSegment.durationDays === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        ) : (
          <span>Hover or focus a stage to see exact dates and duration.</span>
        )}
      </div>
    </section>
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
  helper?: string
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

function MetricSelect({
  options,
  value,
  onChange,
}: {
  options: TrendMetricOption[]
  value: TrendMetricKey
  onChange: (value: TrendMetricKey) => void
}) {
  if (options.length === 0) {
    return null
  }

  return (
    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Metric
      <select
        className="mt-1 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        value={value}
        onChange={(event) => onChange(event.target.value as TrendMetricKey)}
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

function TrendCard({ title, description, helper, series, granularity, format, accent }: TrendCardProps) {
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
    const deltaPercent = previousValue !== 0 ? delta / Math.abs(previousValue) : null

    return { activeIndex: index, change: delta, changePercent: deltaPercent }
  }, [hover, snappedValues])

  const activeValue = activeIndex != null ? snappedValues[activeIndex] ?? null : null
  const activeLabel = activeIndex != null ? labels[activeIndex] ?? null : null
  const changeDisplay = change != null ? formatChangeValue(change, format) : null
  const percentDisplay =
    changePercent != null
      ? `${changePercent >= 0 ? '+' : '−'}${formatPercentValue(Math.abs(changePercent))}`
      : null

  const latestLabel = labels.at(-1)
  const zeroSeries = snappedValues.length > 0 && snappedValues.every((value) => value === 0)

  return (
    <article className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            {helper ? (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{helper}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {granularity === 'quarterly' ? 'Quarterly rollup' : 'Monthly rollup'}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {activeLabel ?? latestLabel ?? '—'}
            </p>
            <p className="mt-3 text-5xl font-semibold text-slate-900 dark:text-slate-50 sm:text-6xl">
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

      <div ref={chartRef} className="relative mt-8 h-64 sm:h-72 lg:h-80">
        {snappedValues.length >= 2 ? (
          <>
            <Sparkline
              values={snappedValues}
              labels={labels}
              color={palette.hex}
              format={format}
              title={title}
              activeIndex={activeIndex}
              onHover={setHover}
              onLeave={() => setHover(null)}
              frameWidth={chartSize.width}
              frameHeight={chartSize.height}
            />
            {zeroSeries ? (
              <div
                className="pointer-events-none absolute inset-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/70 text-xs font-medium text-slate-500 shadow-inner dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-400"
                aria-hidden="true"
              >
                <span>All recorded periods are 0</span>
                <span className="mt-1 text-2xl font-semibold tracking-tight text-slate-400 dark:text-slate-500">0</span>
              </div>
            ) : null}
            {hover && activeValue != null ? (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                style={{ left: hover.x, top: hover.y }}
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {labels[hover.index] ?? '—'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {formatSimpleValue(snappedValues[hover.index] ?? 0, format)}
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
  frameWidth: number
  frameHeight: number
}

function Sparkline({ values, labels, color, title, format, activeIndex, onHover, onLeave, frameWidth, frameHeight }: SparklineProps) {
  const gradientId = useId()
  const fallbackWidth = 420
  const fallbackHeight = 240
  const width = Math.max(frameWidth || fallbackWidth, 180)
  const height = Math.max(frameHeight || fallbackHeight, 180)
  const paddingX = Math.max(8, Math.min(24, width * 0.03))
  const paddingY = Math.max(12, Math.min(28, height * 0.08))
  const innerHeight = height - paddingY * 2
  const innerWidth = width - paddingX * 2
  const { domainMin, domainMax, minValue, maxValue } = useMemo(() => {
    if (values.length === 0) {
      return { domainMin: -1, domainMax: 1, minValue: 0, maxValue: 0 }
    }

    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const hasPositive = values.some((value) => value > 0)
    const hasNegative = values.some((value) => value < 0)

    let minBound = minValue
    let maxBound = maxValue

    if (hasPositive) {
      minBound = Math.min(0, minBound)
    }
    if (hasNegative) {
      maxBound = Math.max(0, maxBound)
    }

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
