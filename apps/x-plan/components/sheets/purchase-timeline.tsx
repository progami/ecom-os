'use client'

import { useMemo } from 'react'
import { addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { clsx } from 'clsx'
import { Info } from 'lucide-react'
import type { PurchaseTimelineProps } from '@/lib/planning/timeline'
import { PurchaseTimelineOrder, TimelineStageKey } from '@/lib/planning/timeline'

const stagePalette: Record<TimelineStageKey, { label: string; barClass: string }> = {
  production: {
    label: 'Production',
    barClass: 'bg-sky-500',
  },
  source: {
    label: 'Source',
    barClass: 'bg-amber-500',
  },
  ocean: {
    label: 'Ocean',
    barClass: 'bg-indigo-500',
  },
  final: {
    label: 'Final',
    barClass: 'bg-emerald-500',
  },
}

const WEEK_OPTIONS = { weekStartsOn: 0 as const }

type TimelineComputedSegment = PurchaseTimelineOrder['segments'][number] & { startDate: Date; endDate: Date }

type TimelineComputedOrder = {
  id: string
  orderCode: string
  productName: string
  quantity: number
  status: string
  availableDate: Date | null
  shipName: string | null
  containerNumber: string | null
  segments: TimelineComputedSegment[]
  orderStart: Date | null
  orderEnd: Date | null
}

type WeekColumn = {
  key: string
  weekNumber: string
  start: Date
  end: Date
}

export function PurchaseTimeline({ orders, activeOrderId, onSelectOrder, header, months }: PurchaseTimelineProps) {
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
          shipName: order.shipName ?? null,
          containerNumber: order.containerNumber ?? null,
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
    const starts = timelineOrders
      .map((order) => order.orderStart?.getTime())
      .filter((value): value is number => typeof value === 'number')
    const ends = timelineOrders.map((order) => order.orderEnd?.getTime()).filter((value): value is number => typeof value === 'number')
    if (starts.length === 0 || ends.length === 0) return null
    const rangeStart = startOfWeek(new Date(Math.min(...starts)), WEEK_OPTIONS)
    const rangeEnd = endOfWeek(new Date(Math.max(...ends)), WEEK_OPTIONS)
    return { rangeStart, rangeEnd }
  }, [timelineOrders])

  const monthBuckets = useMemo(() => {
    if (!months || months.length === 0) return null

    const buckets = months
      .map((month) => {
        const start = startOfMonth(new Date(month.start))
        if (Number.isNaN(start.getTime())) return null
        const endSource = month.end ? new Date(month.end) : start
        const end = endOfMonth(endSource)
        return {
          start,
          end,
          label: month.label,
          duration: Math.max(1, differenceInCalendarDays(end, start) + 1),
        }
      })
      .filter((bucket): bucket is { start: Date; end: Date; label: string; duration: number } => Boolean(bucket))

    return buckets.length ? buckets : null
  }, [months])

  const weekColumns = useMemo(() => {
    if (!timelineBounds) return []
    const weeks: WeekColumn[] = []
    let cursor = timelineBounds.rangeStart
    while (cursor.getTime() <= timelineBounds.rangeEnd.getTime()) {
      const start = cursor
      const end = endOfWeek(start, WEEK_OPTIONS)
      weeks.push({
        key: start.toISOString(),
        weekNumber: format(start, 'w'),
        start,
        end,
      })
      cursor = addWeeks(start, 1)
    }
    return weeks
  }, [timelineBounds])

  const timelineStart = monthBuckets?.[0]?.start ?? timelineBounds?.rangeStart ?? null
  const timelineEnd = monthBuckets?.[monthBuckets.length - 1]?.end ?? timelineBounds?.rangeEnd ?? null
  const totalDurationMs = timelineStart && timelineEnd ? Math.max(timelineEnd.getTime() - timelineStart.getTime(), 1) : null

  const renderStageBlock = (order: TimelineComputedOrder, segment: TimelineComputedSegment) => {
    if (!timelineStart || !timelineEnd || !totalDurationMs) return null
    const rawStart = segment.startDate.getTime()
    const rawEnd = segment.endDate.getTime()
    const clampedStart = Math.min(Math.max(rawStart, timelineStart.getTime()), timelineEnd.getTime())
    const clampedEnd = Math.min(Math.max(rawEnd, timelineStart.getTime()), timelineEnd.getTime())
    if (clampedEnd <= clampedStart) return null

    const palette = stagePalette[segment.key] ?? stagePalette.production
    const leftPercent = ((clampedStart - timelineStart.getTime()) / totalDurationMs) * 100
    const widthPercent = ((clampedEnd - clampedStart) / totalDurationMs) * 100

    return (
      <div
        key={`${order.id}-${segment.key}-${segment.start}`}
        className={clsx(
          'absolute h-full rounded cursor-pointer transition-opacity hover:opacity-80',
          palette.barClass,
          activeOrderId === order.id && 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-white dark:ring-offset-[#041324]'
        )}
        style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 0.8)}%` }}
        onClick={() => onSelectOrder?.(order.id)}
        title={`${segment.label}: ${format(segment.startDate, 'MMM d')} – ${format(segment.endDate, 'MMM d')}`}
      />
    )
  }

  const renderTimelineBackground = () => {
    // Calculate week positions for dividers
    const weekDividers: { position: number; isMonthStart: boolean }[] = []
    if (timelineStart && timelineEnd && totalDurationMs && monthBuckets) {
      let cursor = startOfWeek(timelineStart, WEEK_OPTIONS)
      while (cursor.getTime() <= timelineEnd.getTime()) {
        const position = ((cursor.getTime() - timelineStart.getTime()) / totalDurationMs) * 100
        if (position > 0 && position < 100) {
          const isMonthStart = cursor.getDate() <= 7 && cursor.getDate() >= 1
          weekDividers.push({ position, isMonthStart })
        }
        cursor = addWeeks(cursor, 1)
      }
    }

    return (
      <div className="h-full rounded-lg bg-slate-100 dark:bg-[#06182b]/60 relative overflow-hidden">
        {/* Week divider lines */}
        {weekDividers.map((divider, i) => (
          <div
            key={i}
            className={clsx(
              'absolute top-0 bottom-0 w-px',
              divider.isMonthStart
                ? 'bg-slate-300 dark:bg-slate-600'
                : 'bg-slate-200 dark:bg-slate-700/50'
            )}
            style={{ left: `${divider.position}%` }}
          />
        ))}
      </div>
    )
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 dark:border-[#0b3a52] bg-white dark:bg-[#041324] p-6 shadow-lg dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)]">
      {header ?? (
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">Purchase orders</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">PO timeline</h2>
        </header>
      )}

      <div className="grid items-end gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400" style={{ gridTemplateColumns: 'minmax(180px, 220px) 1fr' }}>
        <span className="px-2 text-slate-600 dark:text-slate-400">Order</span>
        {monthBuckets ? (
          <div className="relative h-8 rounded-lg bg-slate-100 dark:bg-[#06182b]/60 overflow-hidden">
            {/* Month labels positioned absolutely */}
            {monthBuckets.map((month, idx) => {
              if (!timelineStart || !totalDurationMs) return null
              const monthMid = month.start.getTime() + (month.end.getTime() - month.start.getTime()) / 2
              const position = ((monthMid - timelineStart.getTime()) / totalDurationMs) * 100
              return (
                <span
                  key={`${month.label}-${month.start.toISOString()}-header`}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  style={{ left: `${Math.min(Math.max(position, 4), 96)}%` }}
                >
                  {month.label}
                </span>
              )
            })}
            {/* Month divider lines */}
            {monthBuckets.slice(1).map((month, idx) => {
              if (!timelineStart || !totalDurationMs) return null
              const position = ((month.start.getTime() - timelineStart.getTime()) / totalDurationMs) * 100
              return (
                <div
                  key={`divider-${idx}`}
                  className="absolute top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-600"
                  style={{ left: `${position}%` }}
                />
              )
            })}
          </div>
        ) : (
          <div className="relative h-8 rounded-lg bg-slate-100 dark:bg-[#06182b]/60" />
        )}
      </div>

      <ul className="space-y-3 pt-3">
        {timelineOrders.map((order) => {
          const isActive = activeOrderId === order.id
          return (
            <li
              key={order.id}
              className={clsx(
                'rounded-2xl border border-slate-200 dark:border-[#0b3a52] bg-slate-50 dark:bg-[#06182b]/40 px-4 py-3 backdrop-blur-sm transition',
                isActive && 'border-cyan-400 shadow-[0_12px_24px_rgba(0,194,185,0.15)]'
              )}
            >
              <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(180px, 220px) 1fr' }}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onSelectOrder?.(order.id)} className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:underline">
                      {order.orderCode}
                    </button>
                    {(order.shipName || order.containerNumber) ? (
                      <span
                        className="inline-flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help"
                        title={[order.shipName && `Ship: ${order.shipName}`, order.containerNumber && `Container: ${order.containerNumber}`].filter(Boolean).join('\n')}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {order.productName} · {order.quantity.toLocaleString('en-US')} units
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    {order.availableDate ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        ETA {format(order.availableDate, 'MMM d')}
                      </span>
                    ) : null}
                  </div>
                  {order.segments.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Add milestone dates to plot on timeline.</p>
                  ) : null}
                </div>

                <div className="relative h-12">
                  {renderTimelineBackground()}
                  <div className="absolute inset-0">
                    {order.segments.map((segment) => renderStageBlock(order, segment))}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
