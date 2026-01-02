"use client"

import { useEffect, useMemo, useState } from 'react'
import { Check, Download } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const accentColors: Record<TrendAccent, { stroke: string; fill: string }> = {
  sky: { stroke: 'hsl(var(--chart-1))', fill: 'hsl(var(--chart-1))' },
  emerald: { stroke: 'hsl(var(--chart-2))', fill: 'hsl(var(--chart-2))' },
  violet: { stroke: 'hsl(var(--chart-3))', fill: 'hsl(var(--chart-3))' },
  amber: { stroke: 'hsl(var(--chart-4))', fill: 'hsl(var(--chart-4))' },
  rose: { stroke: 'hsl(var(--chart-5))', fill: 'hsl(var(--chart-5))' },
}

const granularityOptions: Array<{ value: TrendGranularity; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
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

  // Transform data for Recharts
  const chartData = useMemo(() => {
    const labels = enabledMetrics[0]?.series[granularity].labels ?? []
    return labels.map((label, index) => {
      const dataPoint: Record<string, string | number> = { label: getShortLabel(label) }
      enabledMetrics.forEach((metric) => {
        dataPoint[metric.key] = metric.series[granularity].values[index] ?? 0
      })
      return dataPoint
    })
  }, [enabledMetrics, granularity])

  const hoveredIndex = activeIndex ?? (chartData.length > 0 ? chartData.length - 1 : null)

  const formatValue = (value: number, format: TrendFormat) => {
    if (!Number.isFinite(value)) return '—'
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(value)
    }
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const formatAxisValue = (value: number) => {
    const format = enabledMetrics[0]?.format ?? 'currency'
    if (format === 'currency') {
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
      return `$${value.toFixed(0)}`
    }
    if (format === 'percent') return `${(value * 100).toFixed(0)}%`
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toFixed(0)
  }

  if (!metrics.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-medium text-muted-foreground">Cadence</span>
          {granularityOptions.map((option) => {
            const isActive = option.value === granularity
            const isAvailable = granularityAvailability[option.value]
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => isAvailable && setGranularity(option.value)}
                disabled={!isAvailable}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isAvailable
                      ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      : 'cursor-not-allowed text-muted-foreground/50'
                }`}
              >
                {isActive && <Check className="h-3 w-3" />}
                {option.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => exportChart(title, granularity)}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Chart Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
            {/* Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  onMouseMove={(state) => {
                    if (typeof state?.activeTooltipIndex === 'number') {
                      setActiveIndex(state.activeTooltipIndex)
                    }
                  }}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <defs>
                    {enabledMetrics.map((metric) => (
                      <linearGradient key={metric.key} id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColors[metric.accent].fill} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={accentColors[metric.accent].fill} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={formatAxisValue}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="mb-1 text-xs font-medium">{label}</p>
                          {payload.map((entry) => (
                            <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
                              {metrics.find(m => m.key === entry.dataKey)?.title}: {formatValue(entry.value as number, metrics.find(m => m.key === entry.dataKey)?.format ?? 'currency')}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {enabledMetrics.map((metric) => (
                    <Area
                      key={metric.key}
                      type="monotone"
                      dataKey={metric.key}
                      stroke={accentColors[metric.accent].stroke}
                      fill={`url(#gradient-${metric.key})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {activeIndex !== null ? 'Selected' : 'Latest'}
                </p>
                <p className="text-sm font-semibold">
                  {hoveredIndex !== null ? chartData[hoveredIndex]?.label : '—'}
                </p>
              </div>
              {metrics.map((metric) => {
                const isEnabled = enabledMetrics.some((m) => m.key === metric.key)
                const value = hoveredIndex !== null
                  ? metric.series[granularity].values[hoveredIndex]
                  : metric.series[granularity].values.at(-1)
                const prevValue = hoveredIndex !== null && hoveredIndex > 0
                  ? metric.series[granularity].values[hoveredIndex - 1]
                  : metric.series[granularity].values.at(-2)
                const change = value !== undefined && prevValue !== undefined ? value - prevValue : null

                return (
                  <div key={metric.key} className={!isEnabled ? 'opacity-40' : ''}>
                    <p className="text-xs font-medium text-muted-foreground">{metric.title}</p>
                    <p className="text-xl font-semibold">
                      {formatValue(value ?? NaN, metric.format)}
                    </p>
                    {change !== null && (
                      <p className={`text-xs ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}{formatValue(change, metric.format)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
            {metrics.map((metric) => {
              const isEnabled = enabledMetrics.some((m) => m.key === metric.key)
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => toggleMetric(metric.key)}
                  className="flex items-center gap-2"
                >
                  <div
                    className="h-3 w-6 rounded-sm transition-opacity"
                    style={{
                      backgroundColor: accentColors[metric.accent].stroke,
                      opacity: isEnabled ? 1 : 0.3
                    }}
                  />
                  <span className={`text-xs ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {metric.title}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getShortLabel(label: string) {
  const parts = label.split(' · ')
  return parts[0] || label
}

function exportChart(title: string, granularity: string) {
  const chartElement = document.querySelector('.recharts-wrapper svg') as SVGElement
  if (!chartElement) return
  const data = new XMLSerializer().serializeToString(chartElement)
  const blob = new Blob([data], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${granularity}.svg`
  a.click()
  URL.revokeObjectURL(url)
}
