"use client"

import { useMemo, useState } from 'react'
import { Check, Download, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
type SortField = 'orderCode' | 'grossRevenue' | 'netProfit' | 'netMarginPercent' | 'roi'
type SortDirection = 'asc' | 'desc'
type MetricKey = 'grossMarginPercent' | 'netMarginPercent' | 'roi'

const metricConfig: Record<MetricKey, { label: string; color: string }> = {
  grossMarginPercent: { label: 'Gross Margin %', color: 'hsl(var(--chart-1))' },
  netMarginPercent: { label: 'Net Margin %', color: 'hsl(var(--chart-2))' },
  roi: { label: 'ROI %', color: 'hsl(var(--chart-3))' },
}

const statusLabels: Record<POStatus, string> = {
  PLANNED: 'Planned',
  PRODUCTION: 'Production',
  IN_TRANSIT: 'Transit',
  ARRIVED: 'Arrived',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

const statusFilters: StatusFilter[] = ['ALL', 'PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED']

export function POProfitabilitySection({
  data,
  title = 'PO Profitability Analysis',
  description = 'Compare purchase order performance and profitability metrics',
}: POProfitabilitySectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [skuFilter, setSkuFilter] = useState<string>('ALL')
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>(['grossMarginPercent', 'netMarginPercent', 'roi'])
  const [sortField, setSortField] = useState<SortField>('grossRevenue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Get unique products for SKU filter
  const productOptions = useMemo(() => {
    const productMap = new Map<string, string>()
    data.forEach((po) => {
      if (!productMap.has(po.productId)) {
        productMap.set(po.productId, po.productName)
      }
    })
    return Array.from(productMap.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  const filteredData = useMemo(() => {
    let result = data
    if (statusFilter !== 'ALL') {
      result = result.filter((po) => po.status === statusFilter)
    }
    if (skuFilter !== 'ALL') {
      result = result.filter((po) => po.productId === skuFilter)
    }
    return [...result].sort((a, b) => {
      const dateA = a.availableDate ? new Date(a.availableDate).getTime() : 0
      const dateB = b.availableDate ? new Date(b.availableDate).getTime() : 0
      return dateA - dateB
    })
  }, [data, statusFilter, skuFilter])

  const tableSortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const aNum = typeof aVal === 'number' ? aVal : 0
      const bNum = typeof bVal === 'number' ? bVal : 0
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
  }, [filteredData, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return filteredData.map((po) => ({
      name: po.orderCode,
      grossMarginPercent: po.grossMarginPercent,
      netMarginPercent: po.netMarginPercent,
      roi: po.roi,
    }))
  }, [filteredData])

  const toggleMetric = (key: MetricKey) => {
    setEnabledMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  // Summary stats
  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalRevenue: 0, totalProfit: 0, avgMargin: 0, avgROI: 0 }
    const totalRevenue = filteredData.reduce((sum, po) => sum + po.grossRevenue, 0)
    const totalProfit = filteredData.reduce((sum, po) => sum + po.netProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgROI = filteredData.reduce((sum, po) => sum + po.roi, 0) / filteredData.length
    return { totalRevenue, totalProfit, avgMargin, avgROI }
  }, [filteredData])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No purchase orders available for analysis.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          {statusFilters.map((status) => {
            const isActive = statusFilter === status
            const label = status === 'ALL' ? 'All' : statusLabels[status]
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {isActive && <Check className="h-3 w-3" />}
                {label}
              </button>
            )
          })}
        </div>

        {productOptions.length > 1 && (
          <div className={SHEET_TOOLBAR_GROUP}>
            <span className="text-xs font-medium text-muted-foreground">SKU</span>
            <button
              type="button"
              onClick={() => setSkuFilter('ALL')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                skuFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {skuFilter === 'ALL' && <Check className="h-3 w-3" />}
              All
            </button>
            {productOptions.map((product) => {
              const isActive = skuFilter === product.id
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSkuFilter(product.id)}
                  title={product.name}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-w-[120px] truncate ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {isActive && <Check className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{product.name}</span>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => exportChart('po-profitability', statusFilter)}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Chart Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Margin Trends</CardTitle>
          <CardDescription>Performance across purchase orders by arrival date</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="mb-1 text-xs font-medium">{label}</p>
                        {payload.map((entry) => (
                          <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
                            {metricConfig[entry.dataKey as MetricKey]?.label}: {formatPercent(entry.value as number)}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                {enabledMetrics.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={metricConfig[key].color}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
            {(Object.keys(metricConfig) as MetricKey[]).map((key) => {
              const isEnabled = enabledMetrics.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleMetric(key)}
                  className="flex items-center gap-2"
                >
                  <div
                    className="h-3 w-6 rounded-sm transition-opacity"
                    style={{
                      backgroundColor: metricConfig[key].color,
                      opacity: isEnabled ? 1 : 0.3
                    }}
                  />
                  <span className={`text-xs ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {metricConfig[key].label}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* P&L Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">P&L Breakdown</CardTitle>
              <CardDescription>Detailed profitability by purchase order</CardDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Total Revenue: <span className="font-semibold text-foreground">{formatCurrency(summary.totalRevenue)}</span></div>
              <div>Total Profit: <span className={`font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(summary.totalProfit)}</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton field="orderCode" current={sortField} direction={sortDirection} onClick={handleSort}>
                    PO Code
                  </SortButton>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">
                  <SortButton field="grossRevenue" current={sortField} direction={sortDirection} onClick={handleSort}>
                    Revenue
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Amz Fees</TableHead>
                <TableHead className="text-right">PPC</TableHead>
                <TableHead className="text-right">
                  <SortButton field="netProfit" current={sortField} direction={sortDirection} onClick={handleSort}>
                    Net Profit
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="netMarginPercent" current={sortField} direction={sortDirection} onClick={handleSort}>
                    Margin
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="roi" current={sortField} direction={sortDirection} onClick={handleSort}>
                    ROI
                  </SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableSortedData.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <div className="font-medium">{po.orderCode}</div>
                    <div className="truncate text-xs text-muted-foreground" style={{ maxWidth: '150px' }} title={po.productName}>
                      {po.productName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">{po.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(po.grossRevenue)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(po.supplierCostTotal)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(po.amazonFeesTotal)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(po.ppcCost)}</TableCell>
                  <TableCell className={`text-right font-mono font-medium ${po.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(po.netProfit)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${po.netMarginPercent < 0 ? 'text-red-600' : ''}`}>
                    {formatPercent(po.netMarginPercent)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-medium ${po.roi < 0 ? 'text-red-600' : ''}`}>
                    {formatPercent(po.roi)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total ({filteredData.length} POs)</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">
                  {filteredData.reduce((sum, po) => sum + po.quantity, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(summary.totalRevenue)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, po) => sum + po.supplierCostTotal, 0))}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, po) => sum + po.amazonFeesTotal, 0))}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, po) => sum + po.ppcCost, 0))}
                </TableCell>
                <TableCell className={`text-right font-mono ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfit)}
                </TableCell>
                <TableCell className={`text-right font-mono ${summary.avgMargin < 0 ? 'text-red-600' : ''}`}>
                  {formatPercent(summary.avgMargin)}
                </TableCell>
                <TableCell className={`text-right font-mono ${summary.avgROI < 0 ? 'text-red-600' : ''}`}>
                  {formatPercent(summary.avgROI)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SortButton({
  field,
  current,
  direction,
  onClick,
  children,
}: {
  field: SortField
  current: SortField
  direction: SortDirection
  onClick: (field: SortField) => void
  children: React.ReactNode
}) {
  const isActive = current === field
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className="flex items-center gap-1 text-xs font-medium hover:text-foreground"
    >
      {children}
      {isActive && (direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  )
}

function StatusBadge({ status }: { status: POStatus }) {
  const styles: Record<POStatus, string> = {
    ARRIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    CLOSED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    IN_TRANSIT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    PRODUCTION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    PLANNED: 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}

function exportChart(name: string, filter: string) {
  const chartElement = document.querySelector('.recharts-wrapper svg') as SVGElement
  if (!chartElement) return
  const data = new XMLSerializer().serializeToString(chartElement)
  const blob = new Blob([data], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${filter.toLowerCase()}.svg`
  a.click()
  URL.revokeObjectURL(url)
}
