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

// Each row represents a single product/batch within a PO
export interface POProfitabilityData {
  id: string
  orderCode: string
  batchCode: string | null
  productId: string
  productName: string
  quantity: number
  status: POStatus
  sellingPrice: number
  manufacturingCost: number
  freightCost: number
  tariffCost: number
  landedUnitCost: number
  supplierCostTotal: number
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

  // Get unique products for SKU dropdown
  const productOptions = useMemo(() => {
    const productMap = new Map<string, string>()
    data.forEach((row) => {
      if (!productMap.has(row.productId)) {
        productMap.set(row.productId, row.productName)
      }
    })
    return Array.from(productMap.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  // When "All SKUs" selected, aggregate to per-PO view
  // When specific SKU selected, show per-batch view filtered to that SKU
  const filteredData = useMemo(() => {
    let result = data

    // Apply status filter first
    if (statusFilter !== 'ALL') {
      result = result.filter((row) => row.status === statusFilter)
    }

    // If specific SKU selected, filter to that SKU (per-batch view)
    if (skuFilter !== 'ALL') {
      result = result.filter((row) => row.productId === skuFilter)
      return [...result].sort((a, b) => {
        const dateA = a.availableDate ? new Date(a.availableDate).getTime() : 0
        const dateB = b.availableDate ? new Date(b.availableDate).getTime() : 0
        return dateA - dateB
      })
    }

    // Aggregate to per-PO view when "All SKUs" selected
    const poMap = new Map<string, POProfitabilityData>()
    result.forEach((row) => {
      const existing = poMap.get(row.orderCode)
      if (existing) {
        // Aggregate values
        existing.quantity += row.quantity
        existing.grossRevenue += row.grossRevenue
        existing.supplierCostTotal += row.supplierCostTotal
        existing.amazonFeesTotal += row.amazonFeesTotal
        existing.ppcCost += row.ppcCost
        existing.grossProfit += row.grossProfit
        existing.netProfit += row.netProfit
        // Recalculate percentages based on aggregated values
        existing.grossMarginPercent = existing.grossRevenue > 0
          ? (existing.grossProfit / existing.grossRevenue) * 100 : 0
        existing.netMarginPercent = existing.grossRevenue > 0
          ? (existing.netProfit / existing.grossRevenue) * 100 : 0
        existing.roi = existing.supplierCostTotal > 0
          ? (existing.netProfit / existing.supplierCostTotal) * 100 : 0
        // Combine product names
        if (!existing.productName.includes(row.productName)) {
          existing.productName = existing.productName + ', ' + row.productName
        }
      } else {
        poMap.set(row.orderCode, { ...row })
      }
    })

    return Array.from(poMap.values()).sort((a, b) => {
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
  // filteredData is already aggregated by PO when "All SKUs" selected
  const chartData = useMemo(() => {
    return filteredData.map((row) => ({
      name: skuFilter !== 'ALL' ? `${row.orderCode} - ${row.productName}` : row.orderCode,
      grossMarginPercent: row.grossMarginPercent,
      netMarginPercent: row.netMarginPercent,
      roi: row.roi,
    }))
  }, [filteredData, skuFilter])

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
    const totalRevenue = filteredData.reduce((sum, row) => sum + row.grossRevenue, 0)
    const totalProfit = filteredData.reduce((sum, row) => sum + row.netProfit, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgROI = filteredData.reduce((sum, row) => sum + row.roi, 0) / filteredData.length
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

        {productOptions.length > 0 && (
          <div className={SHEET_TOOLBAR_GROUP}>
            <span className="text-xs font-medium text-muted-foreground">SKU</span>
            <select
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All SKUs</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
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
              <CardDescription>
                {skuFilter !== 'ALL' ? 'Filtered by SKU' : 'Aggregated by purchase order'}
              </CardDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Total Revenue: <span className="font-semibold text-foreground">{formatCurrency(summary.totalRevenue)}</span></div>
              <div>Total Profit: <span className={`font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(summary.totalProfit)}</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">
                  <SortButton field="orderCode" current={sortField} direction={sortDirection} onClick={handleSort}>
                    PO Code
                  </SortButton>
                </TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Units</TableHead>
                <TableHead className="w-[100px] text-right">
                  <SortButton field="grossRevenue" current={sortField} direction={sortDirection} onClick={handleSort} align="right">
                    Revenue
                  </SortButton>
                </TableHead>
                <TableHead className="w-[90px] text-right">COGS</TableHead>
                <TableHead className="w-[90px] text-right">Amz Fees</TableHead>
                <TableHead className="w-[80px] text-right">PPC</TableHead>
                <TableHead className="w-[100px] text-right">
                  <SortButton field="netProfit" current={sortField} direction={sortDirection} onClick={handleSort} align="right">
                    Net Profit
                  </SortButton>
                </TableHead>
                <TableHead className="w-[80px] text-right">
                  <SortButton field="netMarginPercent" current={sortField} direction={sortDirection} onClick={handleSort} align="right">
                    Margin
                  </SortButton>
                </TableHead>
                <TableHead className="w-[70px] text-right">
                  <SortButton field="roi" current={sortField} direction={sortDirection} onClick={handleSort} align="right">
                    ROI
                  </SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableSortedData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.orderCode}</div>
                    <div className="truncate text-xs text-muted-foreground max-w-[160px]" title={row.productName}>
                      {row.productName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.grossRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.supplierCostTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.amazonFeesTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.ppcCost)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${row.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(row.netProfit)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${row.netMarginPercent < 0 ? 'text-red-600' : ''}`}>
                    {formatPercent(row.netMarginPercent)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${row.roi < 0 ? 'text-red-600' : ''}`}>
                    {formatPercent(row.roi)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">Total ({filteredData.length} {skuFilter !== 'ALL' ? 'batches' : 'POs'})</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">
                  {filteredData.reduce((sum, row) => sum + row.quantity, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(summary.totalRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, row) => sum + row.supplierCostTotal, 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, row) => sum + row.amazonFeesTotal, 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, row) => sum + row.ppcCost, 0))}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfit)}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${summary.avgMargin < 0 ? 'text-red-600' : ''}`}>
                  {formatPercent(summary.avgMargin)}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${summary.avgROI < 0 ? 'text-red-600' : ''}`}>
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
  align = 'left',
}: {
  field: SortField
  current: SortField
  direction: SortDirection
  onClick: (field: SortField) => void
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const isActive = current === field
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${align === 'right' ? 'justify-end w-full' : ''}`}
    >
      {children}
      {isActive && (direction === 'asc' ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />)}
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
