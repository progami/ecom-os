'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSalesPlanningFocus } from '@/components/sheets/sales-planning-grid'

type SalesRow = {
  weekNumber: string
  weekLabel: string
  weekDate: string
  arrivalDetail?: string
  [key: string]: string | undefined
}

type ColumnMeta = Record<string, { productId: string; field: string }>

interface SalesPlanningVisualProps {
  rows: SalesRow[]
  columnMeta: ColumnMeta
  columnKeys: string[]
  productOptions: Array<{ id: string; name: string }>
}

type ShipmentMarker = {
  weekNumber: number
  weekDate: string
  arrivalDetail: string
}

export function SalesPlanningVisual({ rows, columnMeta, columnKeys, productOptions }: SalesPlanningVisualProps) {
  const searchParams = useSearchParams()
  const productSetupHref = searchParams ? `/1-product-setup?${searchParams.toString()}` : '/1-product-setup'
  const defaultProductId = productOptions[0]?.id ?? ''

  const focusContext = useSalesPlanningFocus()
  const contextProductId = focusContext?.focusProductId

  const selectedProductId = contextProductId && contextProductId !== 'ALL'
    ? contextProductId
    : defaultProductId

  const [showShipments, setShowShipments] = useState(true)
  const [showStockLine, setShowStockLine] = useState(true)

  const weekLabelByWeekNumber = useMemo(() => {
    const map = new Map<number, string>()
    rows.forEach((row) => {
      const week = Number(row.weekNumber)
      if (!Number.isFinite(week)) return
      map.set(week, row.weekLabel ?? row.weekNumber)
    })
    return map
  }, [rows])

  const stockDataPoints = useMemo(() => {
    if (!selectedProductId) return []

    const productColumnKey = columnKeys.find(
      (key) => columnMeta[key]?.productId === selectedProductId && columnMeta[key]?.field === 'stockEnd'
    )

    if (!productColumnKey) return []

    return rows.map((row) => {
      const stockValue = row[productColumnKey]
      const weekNumber = Number(row.weekNumber)
      return {
        weekNumber,
        weekLabel: `W${weekLabelByWeekNumber.get(weekNumber) ?? weekNumber}`,
        weekDate: row.weekDate,
        stockEnd: stockValue ? Number(stockValue) : 0,
      }
    }).filter((point) => Number.isFinite(point.weekNumber) && Number.isFinite(point.stockEnd))
  }, [selectedProductId, rows, columnKeys, columnMeta, weekLabelByWeekNumber])

  const shipmentMarkers = useMemo(() => {
    return rows
      .filter((row) => row.arrivalDetail && row.arrivalDetail.trim().length > 0)
      .map((row) => ({
        weekNumber: Number(row.weekNumber),
        weekDate: row.weekDate,
        arrivalDetail: row.arrivalDetail || '',
      }))
      .filter((marker) => Number.isFinite(marker.weekNumber))
  }, [rows])

  const shipmentByWeek = useMemo(() => {
    const map = new Map<number, ShipmentMarker>()
    shipmentMarkers.forEach((marker) => {
      if (!map.has(marker.weekNumber)) {
        map.set(marker.weekNumber, marker)
      }
    })
    return map
  }, [shipmentMarkers])

  // Transform for Recharts
  const chartData = useMemo(() => {
    return stockDataPoints.map((point) => ({
      ...point,
      hasShipment: shipmentByWeek.has(point.weekNumber),
    }))
  }, [stockDataPoints, shipmentByWeek])

  if (productOptions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-lg font-semibold mb-2">No Products Available</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Set up your first product in the Product Setup sheet to start tracking stock levels.
          </p>
          <Link
            href={productSetupHref}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Product Setup →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => exportChart('sales-planning', selectedProductId)}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Chart Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stock Level Over Time</CardTitle>
          <CardDescription>Tracking inventory levels with shipment arrival markers</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">{data.weekLabel} · {data.weekDate}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {Math.round(data.stockEnd).toLocaleString()} units
                        </p>
                        {data.hasShipment && (
                          <p className="text-xs text-emerald-600">Shipment arrives</p>
                        )}
                      </div>
                    )
                  }}
                />
                {/* Shipment reference lines */}
                {showShipments && shipmentMarkers.map((marker) => {
                  const dataIndex = chartData.findIndex(d => d.weekNumber === marker.weekNumber)
                  if (dataIndex === -1) return null
                  return (
                    <ReferenceLine
                      key={marker.weekNumber}
                      x={chartData[dataIndex]?.weekLabel}
                      stroke="hsl(var(--chart-2))"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                    />
                  )
                })}
                {showStockLine && (
                  <Area
                    type="monotone"
                    dataKey="stockEnd"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#stockGradient)"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowStockLine(!showStockLine)}
              className="flex items-center gap-2"
            >
              <div
                className="h-3 w-6 rounded-sm transition-opacity"
                style={{
                  backgroundColor: 'hsl(var(--chart-1))',
                  opacity: showStockLine ? 1 : 0.3
                }}
              />
              <span className={`text-xs ${showStockLine ? 'text-foreground' : 'text-muted-foreground'}`}>
                Stock Level
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowShipments(!showShipments)}
              className="flex items-center gap-2"
            >
              <div
                className="h-3 w-6 rounded-sm border-2 border-dashed transition-opacity"
                style={{
                  borderColor: 'hsl(var(--chart-2))',
                  opacity: showShipments ? 1 : 0.3
                }}
              />
              <span className={`text-xs ${showShipments ? 'text-foreground' : 'text-muted-foreground'}`}>
                Shipment Arrival
              </span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function exportChart(name: string, productId: string) {
  const chartElement = document.querySelector('.recharts-wrapper svg') as SVGElement
  if (!chartElement) return
  const data = new XMLSerializer().serializeToString(chartElement)
  const blob = new Blob([data], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${productId}.svg`
  a.click()
  URL.revokeObjectURL(url)
}
