'use client'

import { useMemo } from 'react'
import { addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { clsx } from 'clsx'
import type { PurchaseTimelineProps } from '@/lib/planning/timeline'
import { PurchaseTimelineOrder, TimelineStageKey } from '@/lib/planning/timeline'

const stagePalette: Record<TimelineStageKey, { label: string; barClass: string; textClass: string }> = {
  production: {
    label: 'Production',
    barClass: 'bg-sky-500/90 hover:bg-sky-500 focus-visible:outline-sky-400',
    textClass: 'text-sky-100',
  },
  source: {
    label: 'Source',
    barClass: 'bg-amber-500/90 hover:bg-amber-500 focus-visible:outline-amber-400',
    textClass: 'text-amber-50',
  },
  ocean: {
    label: 'Ocean',
    barClass: 'bg-indigo-500/90 hover:bg-indigo-500 focus-visible:outline-indigo-400',
    textClass: 'text-indigo-100',
  },
  final: {
    label: 'Final',
    barClass: 'bg-emerald-500/90 hover:bg-emerald-500 focus-visible:outline-emerald-400',
    textClass: 'text-emerald-50',
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

  const renderStageButton = (order: TimelineComputedOrder, segment: TimelineComputedSegment) => {
    if (!timelineStart || !timelineEnd || !totalDurationMs) return null
    const rawStart = segment.startDate.getTime()
    const rawEnd = segment.endDate.getTime()
    const clampedStart = Math.min(Math.max(rawStart, timelineStart.getTime()), timelineEnd.getTime())
    const clampedEnd = Math.min(Math.max(rawEnd, timelineStart.getTime()), timelineEnd.getTime())
    if (clampedEnd <= clampedStart) return null

    const palette = stagePalette[segment.key] ?? stagePalette.production
    const leftPercent = ((clampedStart - timelineStart.getTime()) / totalDurationMs) * 100
    const widthPercent = ((clampedEnd - clampedStart) / totalDurationMs) * 100
    const rangeLabel = `${format(segment.startDate, 'MMM d yyyy')} – ${format(segment.endDate, 'MMM d yyyy')}`

    return (
      <button
        key={`${order.id}-${segment.key}-${segment.start}`}
        type="button"
        onClick={() => onSelectOrder?.(order.id)}
        className={clsx(
          'absolute flex h-full flex-col justify-center rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          palette.barClass,
          activeOrderId === order.id && 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-white]'
        )}
        style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 1.5)}%` }}
        aria-label={`${segment.label} · ${rangeLabel}`}
        title={`${segment.label} · ${rangeLabel}`}
      >
        <span className="truncate text-xs">{segment.label}</span>
        <span className={clsx('truncate text-xs font-normal uppercase tracking-wide', palette.textClass)}>
          {format(segment.startDate, 'MMM d')} – {format(segment.endDate, 'MMM d')}
        </span>
      </button>
    )
  }

  const renderTimelineBackground = () => {
    if (monthBuckets && monthBuckets.length > 0) {
      return (
        <div className="flex h-full gap-1">
          {monthBuckets.map((month) => (
            <div
              key={`${month.label}-${month.start.toISOString()}`}
              className="flex-1 rounded-md border border-dashed border-slate-200]/60 bg-slate-50]/40"
              style={{ flexGrow: month.duration, flexBasis: 0 }}
            />
          ))}
        </div>
      )
    }

    if (!weekColumns.length) {
      return <div className="h-full rounded-md border border-dashed border-slate-200]/60 bg-slate-50]/40" />
    }

    return (
      <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${weekColumns.length}, minmax(12px, 1fr))` }}>
        {weekColumns.map((week) => (
          <div
            key={week.key}
            className="rounded-md border border-dashed border-slate-200]/60 bg-slate-50]/40"
          />
        ))}
      </div>
    )
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200] bg-white] p-6 shadow-lg)]">
      {header ?? (
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Purchase orders</p>
          <h2 className="text-xl font-semibold text-slate-900">PO timeline</h2>
        </header>
      )}

      <div className="grid items-end gap-4 border-b border-slate-200] pb-2 text-xs font-medium uppercase tracking-wide text-slate-600" style={{ gridTemplateColumns: 'minmax(200px, 240px) 1fr' }}>
        <span className="px-2 text-slate-600">Order</span>
        {monthBuckets ? (
          <div className="flex items-end gap-1">
            {monthBuckets.map((month) => (
              <div
                key={`${month.label}-${month.start.toISOString()}-header`}
                className="flex flex-col items-center justify-end rounded-md border border-slate-200] bg-slate-50]/60 px-1 py-1 text-xs font-semibold text-slate-700"
                style={{ flexGrow: month.duration, flexBasis: 0 }}
              >
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weekColumns.length}, minmax(12px, 1fr))` }}>
            {weekColumns.map((week) => (
              <div key={week.key} className="text-center">
                <span className="block text-xs font-semibold text-slate-300">{format(week.start, 'MMM d')}</span>
                <span className="text-xs uppercase tracking-wide text-slate-500">W{week.weekNumber}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ul className="space-y-3 pt-3">
        {timelineOrders.map((order) => {
          const isActive = activeOrderId === order.id
          return (
            <li
              key={order.id}
              className={clsx(
                'rounded-2xl border border-slate-200] bg-slate-50]/40 px-4 py-3 backdrop-blur-sm transition',
                isActive && 'border-cyan-400 shadow-[0_12px_24px_rgba(0,194,185,0.15)]'
              )}
            >
              <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(200px, 240px) 1fr' }}>
                <div className="space-y-2">
                  <button type="button" onClick={() => onSelectOrder?.(order.id)} className="text-left text-sm font-semibold text-slate-900 hover:underline">
                    {order.orderCode}
                  </button>
                  <p className="text-xs text-slate-600">
                    {order.productName} · {order.quantity.toLocaleString('en-US')} units
                  </p>
                  {(order.shipName || order.containerNumber) ? (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      {order.shipName ? <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-medium">Ship: {order.shipName}</span> : null}
                      {order.containerNumber ? <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 font-medium">Container: {order.containerNumber}</span> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    {order.availableDate ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        ETA {format(order.availableDate, 'MMM d')}
                      </span>
                    ) : null}
                  </div>
                  {order.segments.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Add milestone dates to plot this purchase order on the timeline.</p>
                  ) : null}
                </div>

                <div className="relative h-12">
                  {renderTimelineBackground()}
                  <div className="absolute inset-0">
                    {order.segments.map((segment) => renderStageButton(order, segment))}
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
