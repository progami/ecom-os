'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSalesPlanningFocus } from '@/components/sheets/sales-planning-grid';

type SalesRow = {
  weekNumber: string;
  weekLabel: string;
  weekDate: string;
  arrivalDetail?: string;
  [key: string]: string | undefined;
};

type ColumnMeta = Record<string, { productId: string; field: string }>;

interface SalesPlanningVisualProps {
  rows: SalesRow[];
  columnMeta: ColumnMeta;
  columnKeys: string[];
  productOptions: Array<{ id: string; name: string }>;
}

type ShipmentMarker = {
  weekNumber: number;
  weekDate: string;
  arrivalDetail: string;
};

export function SalesPlanningVisual({
  rows,
  columnMeta,
  columnKeys,
  productOptions,
}: SalesPlanningVisualProps) {
  const searchParams = useSearchParams();
  const productSetupHref = searchParams
    ? `/1-product-setup?${searchParams.toString()}`
    : '/1-product-setup';
  const defaultProductId = productOptions[0]?.id ?? '';

  const focusContext = useSalesPlanningFocus();
  const contextProductId = focusContext?.focusProductId;

  const selectedProductId =
    contextProductId && contextProductId !== 'ALL' ? contextProductId : defaultProductId;

  const [showShipments, setShowShipments] = useState(true);
  const [showStockLine, setShowStockLine] = useState(true);

  const weekLabelByWeekNumber = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row) => {
      const week = Number(row.weekNumber);
      if (!Number.isFinite(week)) return;
      map.set(week, row.weekLabel ?? row.weekNumber);
    });
    return map;
  }, [rows]);

  const stockDataPoints = useMemo(() => {
    if (!selectedProductId) return [];

    const productColumnKey = columnKeys.find(
      (key) =>
        columnMeta[key]?.productId === selectedProductId && columnMeta[key]?.field === 'stockEnd',
    );

    if (!productColumnKey) return [];

    return rows
      .map((row) => {
        const stockValue = row[productColumnKey];
        const weekNumber = Number(row.weekNumber);
        return {
          weekNumber,
          weekLabel: String(weekLabelByWeekNumber.get(weekNumber) ?? weekNumber),
          weekDate: row.weekDate,
          stockEnd: stockValue ? Number(stockValue) : 0,
        };
      })
      .filter((point) => Number.isFinite(point.weekNumber) && Number.isFinite(point.stockEnd));
  }, [selectedProductId, rows, columnKeys, columnMeta, weekLabelByWeekNumber]);

  const shipmentMarkers = useMemo(() => {
    return rows
      .filter((row) => row.arrivalDetail && row.arrivalDetail.trim().length > 0)
      .map((row) => ({
        weekNumber: Number(row.weekNumber),
        weekDate: row.weekDate,
        arrivalDetail: row.arrivalDetail || '',
      }))
      .filter((marker) => Number.isFinite(marker.weekNumber));
  }, [rows]);

  const shipmentByWeek = useMemo(() => {
    const map = new Map<number, ShipmentMarker>();
    shipmentMarkers.forEach((marker) => {
      if (!map.has(marker.weekNumber)) {
        map.set(marker.weekNumber, marker);
      }
    });
    return map;
  }, [shipmentMarkers]);

  // Transform for Recharts
  const chartData = useMemo(() => {
    return stockDataPoints.map((point) => ({
      ...point,
      hasShipment: shipmentByWeek.has(point.weekNumber),
    }));
  }, [stockDataPoints, shipmentByWeek]);

  // Calculate Y-axis bounds and zero offset for split gradients (red below 0)
  const yAxisBounds = useMemo(() => {
    const allValues = stockDataPoints.map((p) => p.stockEnd).filter(Number.isFinite);
    if (allValues.length === 0) return { min: 0, max: 0, zeroOffset: 0.5 };
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    // zeroOffset is where 0 falls as a percentage from top (max) to bottom (min)
    const zeroOffset = range > 0 ? max / range : 0.5;
    return { min, max, zeroOffset: Math.max(0, Math.min(1, zeroOffset)) };
  }, [stockDataPoints]);

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
    );
  }

  return (
    <div className="space-y-4">
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
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <defs>
                  <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                    {yAxisBounds.min < 0 ? (
                      <>
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop
                          offset={`${yAxisBounds.zeroOffset * 100}%`}
                          stopColor="hsl(var(--chart-1))"
                          stopOpacity={0.05}
                        />
                        <stop
                          offset={`${yAxisBounds.zeroOffset * 100}%`}
                          stopColor="#dc2626"
                          stopOpacity={0.25}
                        />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                      </>
                    ) : (
                      <>
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </>
                    )}
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={3}
                  label={{
                    value: 'Week',
                    position: 'bottom',
                    offset: 10,
                    fontSize: 12,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()
                  }
                  width={60}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">
                          Week {data.weekLabel} · {data.weekDate}
                        </p>
                        <p
                          className={`text-xs ${
                            data.stockEnd < 0
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          Stock: {Math.round(data.stockEnd).toLocaleString()} units
                        </p>
                        {data.hasShipment && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-300">
                            Shipment arrives
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Shipment reference lines */}
                {showShipments &&
                  shipmentMarkers.map((marker) => {
                    const dataIndex = chartData.findIndex(
                      (d) => d.weekNumber === marker.weekNumber,
                    );
                    if (dataIndex === -1) return null;
                    return (
                      <ReferenceLine
                        key={marker.weekNumber}
                        x={chartData[dataIndex]?.weekLabel}
                        stroke="hsl(var(--chart-2))"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                      />
                    );
                  })}
                {/* Zero reference line when stock goes negative */}
                {yAxisBounds.min < 0 && (
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                )}
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200/60 pt-4 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setShowStockLine(!showStockLine)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showStockLine
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full transition-transform duration-200 ${
                    showStockLine ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ backgroundColor: 'hsl(var(--chart-1))' }}
                />
                {showStockLine && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-1))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showStockLine
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Stock Level
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowShipments(!showShipments)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showShipments
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full border-2 border-dashed transition-transform duration-200 ${
                    showShipments ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ borderColor: 'hsl(var(--chart-2))' }}
                />
                {showShipments && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-2))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showShipments
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Shipment Arrival
              </span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
